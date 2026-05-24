# `api/risk-engine/` — per-lease IFRS-9 ECL engine

## What this is

A Vercel Python Function that loads a tenant's portfolio from Supabase and
computes per-lease IFRS-9 Expected Credit Loss (`PD × LGD × EAD`),
returning per-lease rows and stage-bucketed aggregates.

It is the **per-lease counterpart** to `api/scenarios/run.py`, not a
replacement. The two engines do different jobs:

| Function | Job | Math |
|---|---|---|
| `api/scenarios/run.py` | Macro **scenario** engine | Apply macro shocks to a scalar baseline (NumPy MC) |
| `api/risk-engine/compute.py` (this) | Build the baseline | `Σ_leases PD × LGD × EAD` from live Supabase data |

Eventually the frontend will pipe this function's `total_ecl` into the
scenarios engine as `baseECL`. Until then the scenarios engine uses the
demo constant `BASE_ECL = 47.2`.

Background: [`docs/ADR-001-backend-architecture.md`](../../docs/ADR-001-backend-architecture.md)
explains why FastAPI was killed and why Vercel Python Functions are the
chosen home for compute. This module is the second condition-#2 build
under that ADR: "rebuild fresh against the actual Supabase schema, not
the stale Alembic one."

## Required env vars

| Var | Purpose | Example |
|---|---|---|
| `SUPABASE_URL` | Project URL | `https://abcd1234.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side service-role key (bypasses RLS — keep secret) | `eyJhbGciOiJIUzI1...` |
| `SUPABASE_ANON_KEY` | Optional fallback if service role isn't available | `eyJhbGciOiJIUzI1...` |

`GET /api/risk-engine/compute` is a non-fatal health probe — when either
env var is missing it returns `{"ok": false, "reason": "..."}` with HTTP
200 rather than crashing.

## Request / response

### `POST /api/risk-engine/compute`

Request body:

```json
{
  "org_id":       "uuid-string-required",
  "persist":      false,
  "period_label": "2026-Q2",
  "locked_by":    "user@example.com"
}
```

Headers (interim auth model — see "Known gaps"):

```
Content-Type: application/json
X-Org-Id: <same uuid as org_id in body>
```

Response (200):

```json
{
  "engine":       "python-numpy-supabase",
  "org_id":       "…",
  "lease_count":  173,
  "total_ecl":    47200000,
  "stage1_ecl":    8400000,
  "stage2_ecl":   17200000,
  "stage3_ecl":   21600000,
  "ecl_12m":       8400000,
  "coverage_pct":      1.66,
  "book_value":  2840000000,
  "ecl_rows":    [ { /* …per-lease row… */ } ],
  "duration_ms":     120,
  "snapshot_id":     null
}
```

Per-lease row shape:

```json
{
  "lease_id":         "...",
  "asset_id":         "...",
  "lessee_id":        "...",
  "registration":     "N100AA",
  "msn":              "MSN-001",
  "lessee_name":      "NetworkCo",
  "segment":          "network",
  "stage":            1,
  "tenor_years":      2.0,
  "remaining_months": 24,
  "monthly_rental":   400000,
  "pd":               0.0085,
  "lgd":              0.55,
  "ead_usd":          9600000,
  "ecl_usd":          44880,
  "drivers": {
    "pd_source":            "pd_curve_overrides.network",
    "pd_at_lifetime_tenor": 0.0165,
    "lgd_source":           "default_aviation_55",
    "stage_source":         "leases.stage",
    "ead_source":           "from_end_date",
    "tenor_source":         "lease_start_to_end"
  }
}
```

Errors:

| Status | Trigger |
|---|---|
| 400 | Missing `org_id`, mismatched header/body, missing `period_label` when `persist=true`, invalid JSON |
| 409 | `ecl_period_snapshots` insert refused (e.g. immutability trigger) |
| 500 | Supabase env vars missing at request time |
| 502 | Supabase read failed (network / API error) |

### `GET /api/risk-engine/compute`

Health probe. Always 200. Returns:

```json
{"ok": true,  "engine": "python-numpy-supabase"}
```
or
```json
{"ok": false, "engine": "python-numpy-supabase", "reason": "SUPABASE_URL not set"}
```

## Schema assumptions

The engine reads the following columns. All filters are `org_id = $1`.
Migration references point to the file under `supabase/migrations/`.

| Table | Column | Used for | Source migration |
|---|---|---|---|
| `assets` | `id, registration, msn, aircraft_type, manufacturer, vintage, current_operator` | Lookup, response decoration | `20260513105046_data_activation.sql` |
| `lessees` | `id, name, country, credit_rating, watchlist_status` | Lookup, response decoration | `20260513105046_data_activation.sql` |
| `lessees` | `carrier_segment` (`network`/`lcc`/`regional`/`charter`) | PD curve selection | `20260523113150_aviation_pd_curves.sql` |
| `leases` | `id, asset_id, lessee_id, start_date, end_date, monthly_rental, currency, stage` | All per-lease math | `20260513105046_data_activation.sql` |
| `provisions` | `lease_id, stage, reporting_date` | Stage fallback when `leases.stage` is null | `20260513105046_data_activation.sql` |
| `pd_curve_overrides` | `segment, pd1yr, pd2yr, pd3yr, pd5yr, pd_lifetime` | PD curve override per org per segment | `20260523113150_aviation_pd_curves.sql` |
| `lgd_recovery_overrides` | `recovery_factor` | LGD override per org (LGD = 1 − recovery) | `20260523113152_lgd_curves.sql` |
| `ecl_period_snapshots` | `org_id, period_label, locked_by, stage*_ecl, total_ecl, ecl_12m, coverage_pct, scenario_inputs, weights, scenario_summary, weighted, sicr_config, ecl_rows, currency` | Snapshot writes when `persist=true` | `20260523113158_ecl_period_snapshots.sql` + `20260523113200_ecl_period_snapshots_immutable.sql` |

### Defaults applied when overrides absent

- **PD** — hardcoded `DEFAULT_PD_CURVES` in `engine.py` (one curve per segment, 5 tenor points).
- **LGD** — `1 − DEFAULT_RECOVERY_FACTOR` = `0.55` (aviation industry baseline).
- **Stage** — Stage 1 when `leases.stage` is null and there are no provisions.
- **Currency** — USD assumed throughout. The `leases.currency` column is read but not converted.

### Stage 1 vs Stage 2/3 PD treatment

- Stage 1 → 12-month PD: `pd_curve.pd1yr` (or default 1y for segment).
- Stage 2/3 → lifetime PD: linearly interpolated against original lease tenor (start→end).

This is a deliberate simplification of IFRS-9 §5.5.5 — full lifetime PD
curve integration is a Phase-2 enhancement (see Known gaps below).

## Known gaps

| Gap | Maps to roadmap task |
|---|---|
| No currency conversion — assumes USD; the `leases.currency` column is ignored. | **T-5.4** (live currency engine) |
| Stage assignment is naive — does not run SICR triggers. | **T-1.6** (SICR triggers ingestion) |
| Lifetime PD uses linear interpolation across only 5 tenor anchors rather than survival-curve integration. | **T-1.5** (IFRS-9 parameter ingestion) |
| `pd_curve_overrides` schema lacks per-rating-band granularity — only segment-wide curves. Required to honour `lessees.credit_rating` and `lessees.pd_estimate`. | **T-1.5** + a future migration (`pd_curve_overrides` add `rating_band text`) |
| Sequential Supabase reads — supabase-py is sync. Latency dominated by 6 round-trips. | Cosmetic — switch to `httpx.AsyncClient` + `asyncio.gather` if the function exceeds Vercel's cold-start budget. |
| Auth: trusts `X-Org-Id` header. No JWT verification. | **T-4.1** (RLS audit and lockdown) |
| No write of per-lease ECL back to `provisions` — engine is read-only for individual rows. | **T-3.1** (persist scenario runs) + **T-3.2** (persist ECL snapshots) |
| `ecl_period_snapshots` has no unique constraint on `(org_id, period_label)` — re-locking the same period inserts a duplicate row. | Future migration; not blocking. |
| `scenario_inputs` / `weights` / `sicr_config` written as empty JSONB on snapshot — these are populated by the scenarios engine, not this function. | **T-3.2** (the join point lives in the frontend lock action) |
| No audit-log emission on snapshot writes. | **T-3.4** (universal audit log) |

## How to run locally

From the repo root, with a Python that has `numpy` available:

```bash
# Unit tests (no network — pure compute):
python api/risk-engine/test_engine.py

# Local HTTP server (Vercel emulates this in dev):
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
python -m http.server --cgi
# … or use `vercel dev` if vercel.json routes are configured.
```

## How to invoke deployed

```bash
curl -sS -X POST https://<your-app>.vercel.app/api/risk-engine/compute \
  -H 'Content-Type: application/json' \
  -H 'X-Org-Id: 00000000-0000-0000-0000-000000000000' \
  -d '{
    "org_id":       "00000000-0000-0000-0000-000000000000",
    "persist":      false
  }' | jq '.total_ecl, .lease_count, .duration_ms'
```

Health probe:

```bash
curl -sS https://<your-app>.vercel.app/api/risk-engine/compute | jq
```
