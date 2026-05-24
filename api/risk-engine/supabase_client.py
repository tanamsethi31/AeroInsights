"""
api/risk-engine/supabase_client.py — Thin wrapper over supabase-py.

Two responsibilities:
  1. `fetch_portfolio(org_id)` — load the 6 tables the risk engine needs,
     all scoped to a single org_id.
  2. `write_snapshot(org_id, period_label, locked_by, payload)` — insert one
     row into `ecl_period_snapshots`, surfacing the immutability-trigger
     error clearly if the engine tries to overwrite an existing period.

The `supabase` package is only imported lazily inside the functions so
that `engine.py` and `test_engine.py` can be exercised without the
dependency installed (CI smoke tests, local TDD loops, etc).

Env vars required:
    SUPABASE_URL                 e.g. https://abcd.supabase.co
    SUPABASE_SERVICE_ROLE_KEY    server-side service role (NOT the anon key)

TODO(T-4.1): When RLS lockdown lands, switch to forwarding the user's
JWT and using SUPABASE_ANON_KEY instead, so per-row policies enforce
tenant isolation at the database. Until then the service role bypasses
RLS and we rely on the application-layer `org_id` filter below.
"""
from __future__ import annotations

import os
from typing import Any


class SupabaseConfigError(RuntimeError):
    """Raised when required env vars are missing or the client cannot init."""


class SnapshotWriteError(RuntimeError):
    """Raised when ecl_period_snapshots refuses an insert (immutability / unique)."""


def _get_client():
    """Lazily build a supabase client using env-var credentials."""
    url = os.environ.get("SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
    )
    if not url:
        raise SupabaseConfigError("SUPABASE_URL is not set")
    if not key:
        raise SupabaseConfigError(
            "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) is not set"
        )

    try:
        from supabase import create_client  # type: ignore
    except ImportError as exc:  # pragma: no cover — install gate
        raise SupabaseConfigError(
            "supabase package not installed; add it to requirements.txt"
        ) from exc

    return create_client(url, key)


# ───────────────────────────────────────────────────────────────────────────────
# Reads
# ───────────────────────────────────────────────────────────────────────────────

# Columns we pull for each table. Explicit lists keep the contract obvious and
# avoid pulling unrelated columns (e.g. created_at noise) into the wire payload.
_ASSETS_COLS    = "id,org_id,registration,msn,aircraft_type,manufacturer,vintage,current_operator"
_LESSEES_COLS   = "id,org_id,name,iata_code,country,credit_rating,pd_estimate,watchlist_status,carrier_segment"
_LEASES_COLS    = "id,org_id,asset_id,lessee_id,start_date,end_date,monthly_rental,currency,stage"
_PROVS_COLS     = "id,org_id,asset_id,lease_id,stage,ecl_amount,pd,lgd,ead,reporting_date"
_PD_OVR_COLS    = "id,org_id,segment,pd1yr,pd2yr,pd3yr,pd5yr,pd_lifetime,notes,updated_by,updated_at"
_LGD_OVR_COLS   = "id,org_id,recovery_factor,notes,updated_by,updated_at"


def fetch_portfolio(org_id: str) -> dict[str, list[dict[str, Any]]]:
    """
    Fetch the 6 portfolio tables for `org_id` and return them as a dict.

    Returns keys: assets, lessees, leases, provisions, pd_curve_overrides,
    lgd_recovery_overrides — each a list of row dicts.

    Note: supabase-py is synchronous and not natively parallel. We issue the
    6 queries sequentially; for a single-org payload the latency cost is
    dominated by Supabase round-trips (~30 ms each warm). If this becomes a
    hot path, switch to httpx + asyncio.gather against the REST URL directly.
    """
    if not org_id:
        raise ValueError("org_id is required")

    client = _get_client()

    def _select(table: str, cols: str) -> list[dict]:
        resp = client.table(table).select(cols).eq("org_id", org_id).execute()
        return list(resp.data or [])

    return {
        "assets":                 _select("assets",                 _ASSETS_COLS),
        "lessees":                _select("lessees",                _LESSEES_COLS),
        "leases":                 _select("leases",                 _LEASES_COLS),
        "provisions":             _select("provisions",             _PROVS_COLS),
        "pd_curve_overrides":     _select("pd_curve_overrides",     _PD_OVR_COLS),
        "lgd_recovery_overrides": _select("lgd_recovery_overrides", _LGD_OVR_COLS),
    }


# ───────────────────────────────────────────────────────────────────────────────
# Writes
# ───────────────────────────────────────────────────────────────────────────────

def write_snapshot(
    org_id: str,
    period_label: str,
    locked_by: str,
    payload: dict[str, Any],
) -> str:
    """
    Insert one row into `ecl_period_snapshots`.

    Returns the new snapshot's UUID (as a string).

    The table is append-only at the DB level (BEFORE UPDATE/DELETE triggers,
    migration 007). It does NOT have a unique constraint on (org_id, period_label),
    so re-locking the same period creates a second row — the caller is responsible
    for enforcing single-lock semantics if required.
    """
    if not org_id:
        raise ValueError("org_id is required")
    if not period_label:
        raise ValueError("period_label is required")

    aggregates = payload.get("aggregates", {})
    row = {
        "org_id":           org_id,
        "period_label":     period_label,
        "locked_by":        locked_by or "unknown",
        "stage1_ecl":       float(aggregates.get("stage1_ecl", 0) or 0),
        "stage2_ecl":       float(aggregates.get("stage2_ecl", 0) or 0),
        "stage3_ecl":       float(aggregates.get("stage3_ecl", 0) or 0),
        "total_ecl":        float(aggregates.get("total_ecl",  0) or 0),
        "ecl_12m":          float(aggregates.get("ecl_12m",    0) or 0),
        "coverage_pct":     float(aggregates.get("coverage_pct", 0) or 0),
        "scenario_inputs":  payload.get("scenario_inputs",  {}),
        "weights":          payload.get("weights",          {}),
        "scenario_summary": payload.get("scenario_summary", {}),
        "weighted":         payload.get("weighted",         {}),
        "sicr_config":      payload.get("sicr_config",      {}),
        "ecl_rows":         payload.get("ecl_rows",         []),
        "currency":         payload.get("currency", "USD"),
    }

    client = _get_client()

    try:
        resp = client.table("ecl_period_snapshots").insert(row).execute()
    except Exception as exc:  # supabase-py raises APIError subclasses
        msg = str(exc)
        if "restrict_violation" in msg or "append-only" in msg:
            raise SnapshotWriteError(
                f"ecl_period_snapshots refused write (immutability trigger): {msg}"
            ) from exc
        raise SnapshotWriteError(f"insert into ecl_period_snapshots failed: {msg}") from exc

    data = resp.data or []
    if not data:
        raise SnapshotWriteError("insert returned no row")
    snap_id = data[0].get("id")
    if not snap_id:
        raise SnapshotWriteError("insert response missing id")
    return str(snap_id)
