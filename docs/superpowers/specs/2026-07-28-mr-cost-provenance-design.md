# MR Cost Provenance Layer

**Goal:** Close the credibility gap Zack raised at the SkyWorks demo — per-component maintenance costs (Engine PR, Airframe HSI, LLPs, Landing Gear, APU) on the Maintenance Forecast tab are silently hardcoded industry heuristics with no way to see where they came from or correct them with real evidence. This adds a source tag to every cost figure and a per-component, per-lease override with an audit trail — turning "hardcoded, no link" into "configurable and provenance-tracked."

**Context:** `src/app/data/maintenanceHeuristics.ts`'s `TYPE_HEURISTICS` table (costs sourced from "IATA MCTF, IAWG published cost ranges, Cirium MRO forecast 2024" per its own header comment) feeds `MaintenanceForecastTab.tsx`'s `buildProjections()` at exactly one line — `heuristicEventCost = h ? h.costUSD : comp.fullIntervalUnits * comp.rateAmount` — from which every downstream figure in the Component Projection Table (shortfall/surplus at event, EOL obligation, EOL position, portfolio totals) is derived. There's no real external cost data source connected anywhere in the codebase (`Settings.tsx` already honestly lists Cirium as `not-connected, 0 records`), and no licensing deal exists to change that. This pass doesn't fake a live feed — it makes the existing heuristic honest about being a heuristic, and gives a lessor a legitimate way to correct it per-aircraft when they have real evidence (an MRO quote, an actual invoice), the same way `useServicerReport` already lets them override utilization assumptions.

Scope, per user decision: Maintenance Forecast tab only (not `SDMRTab.tsx`'s separate hardcoded per-lease costs — a different data shape, different UI surface, explicitly out of scope for this pass). Override granularity, per user decision: per-lease, not per-aircraft-type — matches how real evidence works (a quote is always for one specific aircraft), and one lease's override never silently changes another lease's numbers.

---

## Data layer

New table `mr_cost_overrides`, modeled directly on the existing `servicer_reports` table (`supabase/migrations/20260523113205_servicer_reports.sql`) — same org-scoping, same per-lease upsert-target pattern:

```sql
-- supabase/migrations/<timestamp>_mr_cost_overrides.sql
-- One row per (org_id, lease_id, component). Upserted from useCostOverrides hook.
-- Overrides a single component's event cost on one specific lease's aircraft —
-- the heuristic in maintenanceHeuristics.ts remains the fleet-wide default;
-- this table only ever affects the one lease/component pair it targets.

create table if not exists mr_cost_overrides (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references organisations(id) on delete cascade,
  lease_id     text        not null,
  component    text        not null,   -- "Engine PR", "Airframe HSI", "LLPs", "Landing Gear", "APU"
  cost_usd     numeric     not null,
  note         text,                   -- optional free-text evidence, e.g. "Per MRO quote dated 2026-06-15"
  created_by   text        not null,   -- actor email, mirrors audit_log.actor
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists mr_cost_overrides_org_lease_component_uidx
  on mr_cost_overrides(org_id, lease_id, component);

create index if not exists mr_cost_overrides_org_idx
  on mr_cost_overrides(org_id);

alter table mr_cost_overrides enable row level security;
alter table mr_cost_overrides force  row level security;

create policy mr_cost_overrides_select_own_org on mr_cost_overrides
  for select to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy mr_cost_overrides_insert_own_org on mr_cost_overrides
  for insert to public with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy mr_cost_overrides_update_own_org on mr_cost_overrides
  for update to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid))
                          with check (org_id = ((auth.jwt() ->> 'org_id')::uuid));
create policy mr_cost_overrides_delete_own_org on mr_cost_overrides
  for delete to public using (org_id = ((auth.jwt() ->> 'org_id')::uuid));
```

**RLS correction found while planning:** the original draft of this spec copied `audit_log`'s `to authenticated using (true)` policy shape, relying on client-side `.eq("org_id", orgId)` filtering for tenant isolation — the same pattern `servicer_reports`/`useServicerReport.ts` also uses. Checking the full migration history turned up `supabase/migrations/20260528120000_security_audit_rls_lockdown.sql`, a real remediation for exactly this bug class: two other override-style tables (`pd_curve_overrides`, `lgd_recovery_overrides`) shipped with `using (true)` and any authenticated user — not just members of the owning org — could read and write every tenant's data via PostgREST directly, bypassing the client entirely (client-side `.eq()` filtering is not a security boundary; it's just what the client happens to ask for). `mr_cost_overrides` is a new table of the same shape (an org-scoped override table), so it now follows that migration's corrected pattern instead: `enable row level security` + `force row level security`, with every policy scoped to `org_id = ((auth.jwt() ->> 'org_id')::uuid)`. This table needs update/delete (unlike `audit_log`, which is append-only) since overrides are editable/removable — it's the corrected value itself, not an immutable event log entry. The audit trail of *who changed what and when* is the separate `audit_log` table, per below, which already has this correct scoping.

New hook `src/app/hooks/useCostOverrides.ts`, structurally a near-mirror of `useServicerReport.ts`:

```ts
export interface CostOverride {
  id:        string;
  leaseId:   string;
  component: string;
  costUSD:   number;
  note:      string | null;
  createdBy: string;
  updatedAt: string;
}

export interface UseCostOverridesReturn {
  /** Keyed by component name for O(1) lookup in buildProjections(). */
  overrides:      Record<string, CostOverride>;
  loading:        boolean;
  saving:         boolean;
  /** Batched — mirrors the panel's single Save button covering every changed component at once. */
  saveOverrides:  (changes: Record<string, number>, note: string | null) => Promise<void>;
  /** Clears every cost override for this lease — paired with the panel's existing "Reset to heuristic". */
  clearOverrides: () => Promise<void>;
}

export function useCostOverrides(leaseId: string | null): UseCostOverridesReturn
```

Load: `select * from mr_cost_overrides where org_id = :orgId and lease_id = :leaseId` (no `.single()` — unlike `servicer_reports`, which is one row per lease, this is one row per lease+component, so a lease can have 0–5 override rows). Map to a `Record<string, CostOverride>` keyed by `component`.

`saveOverrides(changes, note)`: takes a map of only the components the user actually edited (e.g. `{ "Engine PR": 6_100_000 }`), matching the panel's existing `componentOverrides`-building pattern (`handleSave`'s "omit empty fields" loop) for utilization. Optimistically updates the local record for each changed component, then `upsert`s one row per changed component onto `mr_cost_overrides` with `onConflict: "org_id,lease_id,component"` (a single `.upsert([...])` call with an array handles all of them in one round trip). For each changed component, fire-and-forget `logAudit({ orgId, entityType: "mr_cost_override", entityId: \`${leaseId}:${component}\`, action: "override", before: <that component's previous value or null>, after: { costUSD, note }, note })` — reusing the **existing** `logAudit()` service (`src/app/services/auditLog.ts`) exactly as-is; `"override"` is already a valid `AuditAction`. No new audit infrastructure. One audit row per changed component (not one row for the whole batch) — matches the table's own one-row-per-component grain, so the audit trail for "Engine PR" stays traceable independent of whatever else was saved alongside it.

`clearOverrides()`: optimistically clears the whole local record, `delete from mr_cost_overrides where org_id=:orgId and lease_id=:leaseId` (all components for this lease in one statement), then one `logAudit({ ..., action: "reset", ... })` per component that existed before the clear — `"reset"` is also already a valid `AuditAction`.

Both mutations follow `useServicerReport`'s exact error-handling shape: swallow permission-denied errors (`code 42501` / "permission denied" — the existing pattern for demo-mode/RLS-blocked writes), roll back the optimistic update on any other error, rethrow so the caller's try/catch can show a message.

---

## Calculation layer

`buildProjections()` in `MaintenanceForecastTab.tsx` gains one new optional parameter:

```ts
export function buildProjections(
  lease: LeaseSDMR,
  aircraftType: string,
  leaseEndDate: Date,
  utilOverride?: UtilOverride,
  costOverrides?: Record<string, CostOverride>,   // NEW — keyed by component name
): ComponentProjection[] {
```

The single injection point, `MaintenanceForecastTab.tsx`'s `buildProjections()` (currently line 101):

```ts
// Before:
const heuristicEventCost = h ? h.costUSD : comp.fullIntervalUnits * comp.rateAmount;

// After:
const override = costOverrides?.[comp.component];
const heuristicEventCost = override ? override.costUSD : (h ? h.costUSD : comp.fullIntervalUnits * comp.rateAmount);
const costSource: "heuristic" | "override" = override ? "override" : "heuristic";
```

`ComponentProjection` gains `costSource: "heuristic" | "override"` (and, when `costSource === "override"`, the UI needs `createdBy`/`updatedAt`/`note` for the tooltip — simplest to also add `costOverrideMeta?: { createdBy: string; updatedAt: string; note: string | null }` to the projection, populated only when overridden, rather than have the UI re-look-up the override map by component name a second time).

No other calculation changes — `shortfallAtEvent`, `eolObligation`, `eolShortfall`, `distressedEOLShortfall`, and every portfolio-total `reduce()` in the component already consume `heuristicEventCost`/derived fields, so they automatically pick up the override with zero further changes.

---

## UI layer

**Design refinement found while planning:** the original draft specified click-to-edit table cells modeled on `ModelParametersTab.tsx`'s dirty-row grid. Re-reading `MaintenanceForecastTab.tsx` in full turned up a closer, simpler fit already in the file: the Servicer Report panel (lines 336-368) already has a collapsible **"Component remaining units (optional)"** sub-section — one labeled numeric input per component, exactly the shape a per-component cost override needs. Adding a parallel sub-section reuses proven markup/state patterns wholesale instead of building new inline-cell-edit/hover/click state machinery the table doesn't have today, and keeps both kinds of per-component override (utilization, cost) in the same, single place a user already knows to look.

Concretely: add a second collapsible sub-section, **"Component cost overrides (optional)"**, directly below "Component remaining units" inside the same Servicer Report panel — same collapsible-toggle styling, same per-component `<label>`/`<input>` layout, but each input is a cost value (pre-filled with the current effective cost as its placeholder, matching how the remaining-units inputs already use `comp.remainingUnits` as their placeholder) plus one shared optional free-text note field below the component inputs (not per-component — one note explains whichever costs were changed in that save, matching the panel's existing single-note-per-save granularity rather than adding five separate note fields). The panel's existing Save button now saves both utilization and cost overrides together in one action (two Supabase writes — `servicer_reports` unchanged, plus a `mr_cost_overrides` upsert per changed component); "Reset to heuristic" (already present) additionally clears any cost overrides for that lease.

The Component Projection Table's "Event Cost (Heuristic)" column header becomes just **"Event Cost"** (the word "Heuristic" baked into the header stops being universally true once a row can be overridden). Each row's cost cell gets a small badge next to the figure — `Heuristic` (grey, matching the existing muted-text styling used for the table's "Source: IATA MCTF..." footer note) or `Override` (navy, matching the existing `LIVE` badge styling already used one section up for servicer-report utilization overrides). Hovering the `Override` badge shows a tooltip: who set it and when (`createdBy` / `updatedAt`), plus the note if present. No click-to-edit in the table itself — editing happens in the panel, viewing happens in the table, matching how utilization overrides already split those two responsibilities in this exact file.

The table's existing footer note ("Source: IATA MCTF / IAWG heuristic · Cirium adapter in Phase 3") gets one clause appended: "· Per-component overrides shown above when evidenced" — so the honest state of the whole table (mixed heuristic + evidenced figures) is stated once, not just implied by badges a reader might miss.

The existing "Methodology footnote" at the bottom of the tab (`Assumptions: Heuristic event costs sourced from IATA MCTF & IAWG published cost ranges.`) gets a second sentence when any override is present on the currently-viewed lease: listing which components are overridden, e.g. "Engine PR cost overridden from evidence — see table above for detail."

---

## Data flow

```
mr_cost_overrides (Supabase, org-scoped RLS)
  ↕ useCostOverrides(leaseId)
  ↓ Record<string, CostOverride>
MaintenanceForecastTab.tsx
  → buildProjections(lease, aircraftType, leaseEndDate, utilOverride, costOverrides)
    → per component: override ?? heuristic.costUSD ?? fallback
  → ComponentProjection[] (each carries costSource + costOverrideMeta)
  → Component Projection Table (badge only, per row — view surface)
  → Servicer Report panel's new "Component cost overrides" sub-section (edit surface)
  → saveOverrides()/clearOverrides() → mr_cost_overrides upsert/delete + logAudit() per component
```

## Error handling

- `useCostOverrides` mirrors `useServicerReport`'s exact permission-denied-swallowing pattern — a demo-mode or RLS-blocked user sees the heuristic value with no error toast, not a broken UI.
- `logAudit()` already never throws (fire-and-forget, console-only on failure per its own header comment) — an audit-log outage doesn't block a cost-override save.
- If `saveOverrides`' Supabase call fails for a real reason (not permission-denied), the optimistic update rolls back and the existing "Save error" text pattern (already present in the Servicer Report panel) shows a message.

## Testing

- Unit test `buildProjections()` with a `costOverrides` fixture — assert `heuristicEventCost` uses the override value when present, the heuristic/fallback when absent, and `costSource` is set correctly in both cases. Assert overriding one component doesn't affect any other component's `costSource`/cost in the same projection array.
- Manual verification: open the Servicer Report-adjacent new cost-override UI on one lease, override one component, confirm the table's downstream figures (shortfall, EOL obligation, EOL position, portfolio totals) recompute correctly, confirm a *different* lease of the same aircraft type is unaffected (per-lease scoping), confirm "Reset to heuristic" reverts exactly to the pre-override figures, confirm the audit trail (Settings → Audit Log, per the existing `AuditTrailPanel`) shows the override/reset events.

## Explicitly out of scope for this pass
- `SDMRTab.tsx`'s separate hardcoded per-lease `evidencedCost` data — different shape, different tab, not touched.
- Fleet-wide (per-aircraft-type) overrides — per-lease only.
- Any real external data connection (Cirium/IBA/Ishka/AVAC) — still requires a licensing deal that doesn't exist yet; this pass makes the platform *ready* to wire one in (a future live feed would just become a third `costSource` value alongside `heuristic`/`override`), not a live connection itself.
