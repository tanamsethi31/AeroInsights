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
drop policy if exists mr_cost_overrides_select on mr_cost_overrides;
create policy mr_cost_overrides_select on mr_cost_overrides for select to authenticated using (true);
drop policy if exists mr_cost_overrides_insert on mr_cost_overrides;
create policy mr_cost_overrides_insert on mr_cost_overrides for insert to authenticated with check (true);
drop policy if exists mr_cost_overrides_update on mr_cost_overrides;
create policy mr_cost_overrides_update on mr_cost_overrides for update to authenticated using (true);
drop policy if exists mr_cost_overrides_delete on mr_cost_overrides;
create policy mr_cost_overrides_delete on mr_cost_overrides for delete to authenticated using (true);
```

(RLS policy shape matches `audit_log`'s migration — `to authenticated using (true)`/`with check (true)`, with org-scoping enforced client-side via `.eq("org_id", orgId)` on every query, the same pattern `useServicerReport.ts` already uses. Unlike `audit_log`, this table needs update/delete since overrides are editable/removable — it's the corrected value itself, not an immutable event log entry. The audit trail of *who changed what and when* is the separate `audit_log` table, per below.)

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
  overrides:     Record<string, CostOverride>;
  loading:       boolean;
  saving:        boolean;
  saveOverride:  (component: string, costUSD: number, note: string | null) => Promise<void>;
  clearOverride: (component: string) => Promise<void>;
}

export function useCostOverrides(leaseId: string | null): UseCostOverridesReturn
```

Load: `select * from mr_cost_overrides where org_id = :orgId and lease_id = :leaseId` (no `.single()` — unlike `servicer_reports`, which is one row per lease, this is one row per lease+component, so a lease can have 0–5 override rows). Map to a `Record<string, CostOverride>` keyed by `component`.

`saveOverride(component, costUSD, note)`: optimistic-update the local record, `upsert` on `mr_cost_overrides` with `onConflict: "org_id,lease_id,component"`, then fire-and-forget `logAudit({ orgId, entityType: "mr_cost_override", entityId: \`${leaseId}:${component}\`, action: "override", before: <previous value or null>, after: { costUSD, note }, note })` — reusing the **existing** `logAudit()` service (`src/app/services/auditLog.ts`) exactly as-is; `"override"` is already a valid `AuditAction`. No new audit infrastructure.

`clearOverride(component)`: optimistic-remove locally, `delete from mr_cost_overrides where org_id=:orgId and lease_id=:leaseId and component=:component`, then `logAudit({ ..., action: "reset", before: <previous value>, after: null })` — `"reset"` is also already a valid `AuditAction`.

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

The single injection point (currently `exportService.ts`... no — `MaintenanceForecastTab.tsx` line 101):

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

The Component Projection Table's "Event Cost (Heuristic)" column header becomes just **"Event Cost"** (the word "Heuristic" baked into the header stops being universally true once a row can be overridden) — a per-row source badge replaces it as the per-value signal.

Each row's Event Cost cell becomes click-to-edit, following the same interaction pattern already established in `ModelParametersTab.tsx` (dirty-row state, inline Save) rather than inventing a new one:
- **Default state:** shows the effective cost (`fmtUSD(p.heuristicEventCost)`) with a small badge — `Heuristic` (grey, e.g. matching the existing muted-text styling used for the table's "Source: IATA MCTF..." footer note) or `Override` (navy, matching the existing `LIVE` badge styling already used for servicer-report utilization overrides in the same file). Hovering the `Override` badge shows a tooltip: who set it and when (`createdBy` / `updatedAt`), plus the note if present.
- **Click to edit:** the cell becomes a numeric input pre-filled with the current effective cost, plus a small optional note field (matching the Servicer Report panel's "optional" labeling convention). Save writes via `saveOverride`; a "Reset to heuristic" affordance (styling matches the existing "Reset to heuristic" button already present in the Servicer Report panel — same label, same destructive-outline styling) calls `clearOverride` and reverts to the heuristic value.

The table's existing footer note ("Source: IATA MCTF / IAWG heuristic · Cirium adapter in Phase 3") gets one clause appended: "· Per-component overrides shown above when evidenced" — so the honest state of the whole table (mixed heuristic + evidenced figures) is stated once, not just implied by badges a reader might miss.

The existing "Methodology footnote" at the bottom of the tab (`Assumptions: Heuristic event costs sourced from IATA MCTF & IAWG published cost ranges.`) gets a second sentence when any override is present on the currently-viewed lease: listing which components are overridden, e.g. "Engine PR cost overridden from evidence — see table above for detail."

---

## Data flow

```
mr_cost_overrides (Supabase)
  ↕ useCostOverrides(leaseId)
  ↓ Record<string, CostOverride>
MaintenanceForecastTab.tsx
  → buildProjections(lease, aircraftType, leaseEndDate, utilOverride, costOverrides)
    → per component: override ?? heuristic.costUSD ?? fallback
  → ComponentProjection[] (each carries costSource + costOverrideMeta)
  → Component Projection Table (badge + click-to-edit per row)
  → saveOverride()/clearOverride() → mr_cost_overrides upsert/delete + logAudit()
```

## Error handling

- `useCostOverrides` mirrors `useServicerReport`'s exact permission-denied-swallowing pattern — a demo-mode or RLS-blocked user sees the heuristic value with no error toast, not a broken UI.
- `logAudit()` already never throws (fire-and-forget, console-only on failure per its own header comment) — an audit-log outage doesn't block a cost-override save.
- If `saveOverride`'s Supabase call fails for a real reason (not permission-denied), the optimistic update rolls back and the existing "Save error" text pattern (already present in the Servicer Report panel) shows a message.

## Testing

- Unit test `buildProjections()` with a `costOverrides` fixture — assert `heuristicEventCost` uses the override value when present, the heuristic/fallback when absent, and `costSource` is set correctly in both cases. Assert overriding one component doesn't affect any other component's `costSource`/cost in the same projection array.
- Manual verification: open the Servicer Report-adjacent new cost-override UI on one lease, override one component, confirm the table's downstream figures (shortfall, EOL obligation, EOL position, portfolio totals) recompute correctly, confirm a *different* lease of the same aircraft type is unaffected (per-lease scoping), confirm "Reset to heuristic" reverts exactly to the pre-override figures, confirm the audit trail (Settings → Audit Log, per the existing `AuditTrailPanel`) shows the override/reset events.

## Explicitly out of scope for this pass
- `SDMRTab.tsx`'s separate hardcoded per-lease `evidencedCost` data — different shape, different tab, not touched.
- Fleet-wide (per-aircraft-type) overrides — per-lease only.
- Any real external data connection (Cirium/IBA/Ishka/AVAC) — still requires a licensing deal that doesn't exist yet; this pass makes the platform *ready* to wire one in (a future live feed would just become a third `costSource` value alongside `heuristic`/`override`), not a live connection itself.
