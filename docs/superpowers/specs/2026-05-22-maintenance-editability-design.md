# Maintenance Editability & Event Log — Design Spec

**Date:** 2026-05-22
**Feature:** Close the servicer report loop + Maintenance Event Log with direct calculation impact

---

## 1. Overview

Two connected improvements to the Maintenance section:

1. **Close the servicer report loop** — the Maintenance page (`/maintenance`) currently ignores saved servicer reports from Supabase. `MRPortfolioGrid`, `ScenarioModellingTab`, and `AircraftBalanceChart` all call `buildProjections` against raw static data. This PR wires them to the same `servicer_reports` table that `MaintenanceForecastTab` already writes to.

2. **Maintenance Event Log** — a new per-aircraft event log where users can record unusual maintenance circumstances (shop visits, AOGs, LLP replacements, supplemental claims, free-text notes). Each event can span multiple components and directly adjusts MR balance calculations: cost drawdowns reduce `cumulativeBalance` and remaining unit resets update `remainingUnits`, which in turn change EOL shortfall projections throughout the Maintenance section.

---

## 2. Database

### 2.1 New table: `maintenance_events`

```sql
create table maintenance_events (
  id                uuid        primary key default gen_random_uuid(),
  org_id            uuid        not null references organisations(id) on delete cascade,
  lease_id          text        not null,
  event_date        date        not null,
  event_type        text        not null
                    check (event_type in ('shop_visit','aog','llp_replacement','supplemental_claim','note')),
  notes             text,
  component_impacts jsonb       not null default '[]',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index maintenance_events_org_lease_idx
  on maintenance_events(org_id, lease_id);
```

**`component_impacts` JSONB structure** — array of objects, one per affected component:

```json
[
  { "component": "Engine PR", "cost_paid_usd": 5400000, "remaining_units_after": 18000 },
  { "component": "LLPs",      "cost_paid_usd": 890000,  "remaining_units_after": null  }
]
```

`remaining_units_after: null` means the event records a cost drawdown without resetting the maintenance clock.

---

## 3. TypeScript Types

```typescript
// src/app/utils/maintenanceEvents.ts

export interface ComponentImpact {
  component:           string;         // "Engine PR" | "LLPs" | "Airframe HSI" | "Landing Gear" | "APU"
  costPaidUSD:         number;         // balance drawdown — always required
  remainingUnitsAfter: number | null;  // null = no clock reset
}

export interface MaintenanceEvent {
  id:               string;
  leaseId:          string;
  eventDate:        string;            // "YYYY-MM-DD"
  eventType:        "shop_visit" | "aog" | "llp_replacement" | "supplemental_claim" | "note";
  notes:            string | null;
  componentImpacts: ComponentImpact[];
}
```

---

## 4. Core Logic

### 4.1 `applyEvents(lease, events): LeaseSDMR`

Pure function in `src/app/utils/maintenanceEvents.ts`. Sorts events oldest-to-newest, then for each `mrComponent`:

- Subtracts all `costPaidUSD` for that component across all events from `cumulativeBalance`
- Takes the most recent `remainingUnitsAfter` (non-null) as the new `remainingUnits`; earlier events are overridden by later ones

```typescript
export function applyEvents(lease: LeaseSDMR, events: MaintenanceEvent[]): LeaseSDMR {
  const sorted = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const updatedComponents = lease.mrComponents.map(comp => {
    let balance   = comp.cumulativeBalance;
    let remaining = comp.remainingUnits;

    for (const evt of sorted) {
      for (const impact of evt.componentImpacts) {
        if (impact.component === comp.component) {
          balance -= impact.costPaidUSD;
          if (impact.remainingUnitsAfter !== null) {
            remaining = impact.remainingUnitsAfter;
          }
        }
      }
    }

    return { ...comp, cumulativeBalance: balance, remainingUnits: remaining };
  });

  return { ...lease, mrComponents: updatedComponents };
}
```

`buildProjections` is unchanged — it receives an already-adjusted `LeaseSDMR`.

### 4.2 `applyServicerReport(lease, report): LeaseSDMR`

Pure function extracted from the existing `utilOverride` logic in `MaintenanceForecastTab`. Applies `annualFH`, `annualCy`, and `componentOverrides` as `remainingUnits` overrides. Returns adjusted `LeaseSDMR`.

> **Note:** Servicer report is applied first (sets utilization + remaining units from last operator report), then events are applied on top (drawdowns and resets from subsequent events).

### 4.3 `adjustedLease(raw, report, events): LeaseSDMR`

```typescript
export function adjustedLease(
  raw:    LeaseSDMR,
  report: ServicerReport | null,
  events: MaintenanceEvent[],
): LeaseSDMR {
  const afterReport = report ? applyServicerReport(raw, report) : raw;
  return applyEvents(afterReport, events);
}
```

---

## 5. New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/014_maintenance_events.sql` | New `maintenance_events` table |
| `src/app/utils/maintenanceEvents.ts` | `applyEvents`, `applyServicerReport`, `adjustedLease` pure functions + types |
| `src/app/utils/maintenanceEvents.test.ts` | Unit tests for all three pure functions |
| `src/app/hooks/useAllServicerReports.ts` | Bulk fetch `Map<leaseId, ServicerReport>` for an org |
| `src/app/hooks/useAllMaintenanceEvents.ts` | Bulk fetch `Map<leaseId, MaintenanceEvent[]>` for an org |
| `src/app/hooks/useMaintenanceEvents.ts` | Per-lease hook: `logEvent`, `deleteEvent`, optimistic updates |
| `src/app/components/maintenance/MaintenanceEventLog.tsx` | Event timeline + "Log Event" form for Aircraft Detail tab |

---

## 6. Modified Files

| File | Change |
|------|--------|
| `src/app/pages/Maintenance.tsx` | Fetch bulk reports + events; compute `adjustedLeases`; pass to all tabs |
| `src/app/components/maintenance/MRPortfolioGrid.tsx` | Accept `leases: LeaseSDMR[]` prop instead of importing `sdmrData` directly |
| `src/app/components/maintenance/ScenarioModellingTab.tsx` | Accept `leases: LeaseSDMR[]` prop instead of importing `sdmrData` directly |
| `src/app/components/maintenance/AircraftDetailTab.tsx` | Accept `leases: LeaseSDMR[]` + `selectedLeaseEvents: MaintenanceEvent[]`; render `MaintenanceEventLog` below projection table; pass adjusted projections to `AircraftBalanceChart` |

`MaintenanceForecastTab.tsx` is **not modified** — it continues to handle its own `useServicerReport` call and `utilOverride` logic as before.

---

## 7. New Hooks

### 7.1 `useAllServicerReports()`

```typescript
// src/app/hooks/useAllServicerReports.ts
export function useAllServicerReports(): {
  reports: Map<string, ServicerReport>;  // leaseId → ServicerReport
  loading: boolean;
}
```

Single Supabase query: `select * from servicer_reports where org_id = $orgId`.

Returns empty `Map` when `!orgId` (demo mode — no Supabase call).

### 7.2 `useAllMaintenanceEvents()`

```typescript
// src/app/hooks/useAllMaintenanceEvents.ts
export function useAllMaintenanceEvents(): {
  eventsMap: Map<string, MaintenanceEvent[]>;  // leaseId → events[]
  loading:   boolean;
}
```

Single Supabase query: `select * from maintenance_events where org_id = $orgId order by event_date asc`.

Returns empty `Map` when `!orgId` (demo mode — no Supabase call).

### 7.3 `useMaintenanceEvents(leaseId)`

```typescript
// src/app/hooks/useMaintenanceEvents.ts
export function useMaintenanceEvents(leaseId: string | null): {
  events:      MaintenanceEvent[];
  saving:      boolean;
  logEvent:    (data: Omit<MaintenanceEvent, "id">) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}
```

Optimistic updates on both `logEvent` and `deleteEvent` (rollback on error). `logEvent` inserts; `deleteEvent` hard-deletes (events are explicit records — no soft delete needed).

---

## 8. User Interface

### 8.1 `MaintenanceEventLog` component

Rendered at the bottom of `AircraftDetailTab` for the currently-selected aircraft.

**Empty state:**
```
No events logged for this aircraft.
[+ Log event]
```

**Event timeline** (when events exist): chronological list, newest at top. Each event card shows:
- Date + event type badge (colour-coded: shop_visit=blue, aog=red, llp_replacement=amber, supplemental_claim=amber, note=slate)
- Affected components as chips: `Engine PR  −$5.4M  → 18,000 FH`
- Free-text notes (if present)
- Delete button (× icon, with confirmation)

**"+ Log Event" form** — inline expanded panel (same visual style as the servicer report form in `MaintenanceForecastTab`):

```
Event date       [date input — required]
Event type       [select: Shop Visit | AOG | LLP Replacement | Supplemental Claim | Note]
Notes            [textarea — optional]

Component impacts                          [+ Add component]
┌────────────────────────────────────────────────────────────┐
│ Component     [select]                                     │
│ Cost paid ($) [number input — required]                    │
│ Remaining units after [number input — optional]  [× remove]│
└────────────────────────────────────────────────────────────┘

[Save]   [Cancel]
```

- Component selector: dropdown of "Airframe HSI", "Engine PR", "LLPs", "Landing Gear", "APU"
- "+ Add component" appends a new component impact row
- At least one component impact is required (except for event_type `note`)
- `remaining_units_after` is optional per row — leave blank if the event doesn't reset the clock
- Validation: event date required; cost_paid_usd must be > 0 per impact row

### 8.2 Overview tab (MRPortfolioGrid)

No UI changes — receives adjusted lease data, renders correctly with real balances.

### 8.3 Scenario Modelling tab

No UI changes — receives adjusted lease data as starting baseline.

---

## 9. Data Flow in `Maintenance.tsx`

```
Maintenance.tsx
  ├── useAllServicerReports()  →  Map<leaseId, ServicerReport>
  ├── useAllMaintenanceEvents() →  Map<leaseId, MaintenanceEvent[]>
  ├── adjustedLeases = sdmrData.map(raw =>
  │     adjustedLease(raw, reportMap.get(raw.leaseId) ?? null, eventsMap.get(raw.leaseId) ?? [])
  │   )
  ├── <MRPortfolioGrid leases={adjustedLeases} />
  ├── <AircraftDetailTab leases={adjustedLeases} eventsMap={eventsMap} />
  └── <ScenarioModellingTab leases={adjustedLeases} />
```

Loading state: while either bulk hook is loading, show skeleton rows in all three tabs (same skeleton pattern as Lease Register).

---

## 10. Demo Mode Behaviour

When `!hasUpload` (no org upload):
- `useAllServicerReports` returns `{ reports: new Map(), loading: false }` — no Supabase call
- `useAllMaintenanceEvents` returns `{ eventsMap: new Map(), loading: false }` — no Supabase call
- `adjustedLeases === sdmrData` — demo data unchanged
- Event log panel shows empty state with "+ Log event" (form works; saves to Supabase if `orgId` present, otherwise no-ops)

---

## 11. Testing

### 11.1 `applyEvents` (unit tests)

- No events → returns lease unchanged
- Single event: balance reduced by `costPaidUSD`, remaining units updated when `remainingUnitsAfter` non-null
- `remainingUnitsAfter: null` → remaining units unchanged, balance still reduced
- Multiple events on same component → balance reduced by sum; remaining units = most recent non-null `remainingUnitsAfter`
- Event with no `componentImpacts` → lease unchanged
- Events sorted oldest-to-newest regardless of input order

### 11.2 `applyServicerReport` (unit tests)

- No report → lease unchanged
- Report with `annualFH`/`annualCy` propagates to utilization
- `componentOverrides` sets `remainingUnits` per named component

### 11.3 `adjustedLease` (unit tests)

- Servicer report applied before events (events can override report's `remainingUnits`)

---

## 12. Out of Scope

- Editing an existing event (delete + re-log is the workflow)
- Event-triggered notifications or alerts
- Bulk event import
- MR claim reconciliation against actual invoices
- Changes to `MaintenanceForecastTab.tsx` (Portfolio → SD/MR view is unaffected)
