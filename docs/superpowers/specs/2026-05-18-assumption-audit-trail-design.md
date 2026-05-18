# Assumption Audit Trail — Design Spec

**Date:** 2026-05-18
**Status:** Approved

---

## Goal

Log every PD curve and LGD recovery factor override/reset with who changed it, when, and what changed — and surface that log in the Settings → Audit Log tab. Closes the IFRS 9 requirement that assumption changes are traceable.

---

## Background

`pd_curve_overrides` and `lgd_recovery_overrides` are single-row upsert tables — every save overwrites the previous value. No history is retained. `updated_by` and `updated_at` fields exist but capture only the latest change.

The Settings → Audit Log tab already has a UI shell (table, styling, tab routing) but renders hardcoded mock data. Zero real infrastructure.

**Scope:** Assumption changes only — PD curve overrides and LGD recovery factor. Scenario runs, exports, and logins are out of scope.

---

## Architecture

Three units, one page modification:

| File | Action |
|------|--------|
| `supabase/migrations/005_assumption_change_log.sql` | **Create** — new append-only table |
| `src/app/utils/assumptionLog.ts` | **Create** — shared log-write utility |
| `src/app/hooks/useAssumptionLog.ts` | **Create** — read hook for Settings |
| `src/app/hooks/usePdCurves.ts` | **Modify** — call log on save/reset |
| `src/app/hooks/useLgdCurves.ts` | **Modify** — call log on save/reset |
| `src/app/pages/Settings.tsx` | **Modify** — replace mock with live data |

---

## Unit 1: Database Migration

**File:** `supabase/migrations/005_assumption_change_log.sql`

```sql
-- assumption audit trail: append-only log of PD and LGD assumption changes
create table if not exists assumption_change_log (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  assumption_type  text not null
                   check (assumption_type in ('pd_curve', 'lgd_recovery')),
  segment          text
                   check (segment in ('network', 'lcc', 'regional', 'charter')),
  action           text not null
                   check (action in ('override', 'reset')),
  previous_value   jsonb,
  new_value        jsonb,
  notes            text,
  changed_by       text not null default 'unknown',
  changed_at       timestamptz not null default now()
);

create index if not exists assumption_change_log_org_id_idx
  on assumption_change_log(org_id, changed_at desc);
```

**Constraints:**
- `segment` nullable — null for `lgd_recovery`, required for `pd_curve` (enforced in application layer, not DB check, to keep migration simple)
- `previous_value` null on first-ever override (no prior row to read)
- `new_value` null on reset to default
- Append-only — no updates or deletes

---

## Unit 2: assumptionLog utility

**File:** `src/app/utils/assumptionLog.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AssumptionChangePayload {
  orgId:           string;
  assumptionType:  "pd_curve" | "lgd_recovery";
  segment?:        string | null;
  action:          "override" | "reset";
  previousValue:   Record<string, number> | null;
  newValue:        Record<string, number> | null;
  notes?:          string | null;
  changedBy:       string;
}

/**
 * Appends one row to assumption_change_log.
 * Non-blocking — a failed insert logs a console warning but never throws.
 */
export async function logAssumptionChange(
  supabase: SupabaseClient,
  payload: AssumptionChangePayload,
): Promise<void> {
  const { error } = await supabase.from("assumption_change_log").insert({
    org_id:          payload.orgId,
    assumption_type: payload.assumptionType,
    segment:         payload.segment ?? null,
    action:          payload.action,
    previous_value:  payload.previousValue,
    new_value:       payload.newValue,
    notes:           payload.notes ?? null,
    changed_by:      payload.changedBy,
  });
  if (error) {
    console.warn("[assumptionLog] failed to write audit entry:", error.message);
  }
}
```

---

## Unit 3: useAssumptionLog hook

**File:** `src/app/hooks/useAssumptionLog.ts`

```typescript
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface AssumptionLogEntry {
  id:              string;
  assumptionType:  "pd_curve" | "lgd_recovery";
  segment:         string | null;
  action:          "override" | "reset";
  previousValue:   Record<string, number> | null;
  newValue:        Record<string, number> | null;
  notes:           string | null;
  changedBy:       string;
  changedAt:       string;  // ISO timestamp string
}

interface Result {
  entries:   AssumptionLogEntry[];
  isLoading: boolean;
}

export function useAssumptionLog(): Result {
  const [entries, setEntries]     = useState<AssumptionLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("assumption_change_log")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (!error && data) {
        setEntries(data.map((r) => ({
          id:             r.id,
          assumptionType: r.assumption_type,
          segment:        r.segment,
          action:         r.action,
          previousValue:  r.previous_value,
          newValue:       r.new_value,
          notes:          r.notes,
          changedBy:      r.changed_by,
          changedAt:      r.changed_at,
        })));
      }
      setIsLoading(false);
    }
    fetch();
    return () => { cancelled = true; };
  }, []);

  return { entries, isLoading };
}
```

Fetches 50 most recent entries for the org (RLS handles org scoping). No pagination — 50 rows covers months of assumption changes for a typical lessor.

---

## Unit 4: usePdCurves modifications

**File:** `src/app/hooks/usePdCurves.ts`

Two additions:

### Import
```typescript
import { logAssumptionChange } from "../utils/assumptionLog";
```

### In `saveOverride(segment, values)` — after successful upsert:

`orgId` is already in scope from `useData()`. `curves` holds the current effective values (including any existing override) before the upsert. `isOverridden[segment]` indicates whether a previous override existed.

```typescript
const user = (await supabase.auth.getUser()).data.user;
const prevCurve = curves[segment];
await logAssumptionChange(supabase, {
  orgId,
  assumptionType:  "pd_curve",
  segment,
  action:          "override",
  previousValue:   isOverridden[segment]
                     ? { pd1yr: prevCurve.pd1yr, pd2yr: prevCurve.pd2yr, pd3yr: prevCurve.pd3yr,
                         pd5yr: prevCurve.pd5yr, pd_lifetime: prevCurve.pdLifetime }
                     : null,
  newValue:        { pd1yr: values.pd1yr, pd2yr: values.pd2yr, pd3yr: values.pd3yr,
                     pd5yr: values.pd5yr, pd_lifetime: values.pdLifetime },
  notes:           values.notes ?? null,
  changedBy:       user?.email ?? "unknown",
});
```

### In `resetToDefault(segment)` — after successful delete:
```typescript
const user = (await supabase.auth.getUser()).data.user;
const prevCurve = curves[segment];
await logAssumptionChange(supabase, {
  orgId,
  assumptionType:  "pd_curve",
  segment,
  action:          "reset",
  previousValue:   { pd1yr: prevCurve.pd1yr, pd2yr: prevCurve.pd2yr, pd3yr: prevCurve.pd3yr,
                     pd5yr: prevCurve.pd5yr, pd_lifetime: prevCurve.pdLifetime },
  newValue:        null,
  notes:           null,
  changedBy:       user?.email ?? "unknown",
});
```

---

## Unit 5: useLgdCurves modifications

**File:** `src/app/hooks/useLgdCurves.ts`

Same pattern as usePdCurves:

### Import
```typescript
import { logAssumptionChange } from "../utils/assumptionLog";
```

### In `saveRecoveryOverride(factor, notes)` — after successful upsert:

`orgId` is already in scope from `useData()`. `recoveryFactor` and `isOverridden` are already in hook state.

```typescript
const user = (await supabase.auth.getUser()).data.user;
await logAssumptionChange(supabase, {
  orgId,
  assumptionType:  "lgd_recovery",
  segment:         null,
  action:          "override",
  previousValue:   isOverridden ? { recovery_factor: recoveryFactor } : null,
  newValue:        { recovery_factor: factor },
  notes:           notes ?? null,
  changedBy:       user?.email ?? "unknown",
});
```

### In `resetToDefault()` — after successful delete:
```typescript
const user = (await supabase.auth.getUser()).data.user;
await logAssumptionChange(supabase, {
  orgId,
  assumptionType:  "lgd_recovery",
  segment:         null,
  action:          "reset",
  previousValue:   { recovery_factor: recoveryFactor },
  newValue:        null,
  notes:           null,
  changedBy:       user?.email ?? "unknown",
});
```

---

## Unit 6: Settings.tsx modifications

**File:** `src/app/pages/Settings.tsx`

Two changes:

### Replace hardcoded mock
Remove the `const auditLog = [...]` array (8 hardcoded rows).

Add at component level:
```typescript
const { entries: auditEntries, isLoading: auditLoading } = useAssumptionLog();
```

### Replace the audit tab render

Replace the existing `{auditLog.map(...)}` render with:

**Loading state** (3 skeleton rows):
```tsx
{auditLoading && Array.from({ length: 3 }).map((_, i) => (
  <tr key={i}>
    <td colSpan={5} style={{ padding: "0.75rem", background: i % 2 === 0 ? "#F8FAFC" : "#FFFFFF" }}>
      <div style={{ height: "1rem", background: "#E2E8F0", borderRadius: "0.25rem", width: "60%" }} />
    </td>
  </tr>
))}
```

**Empty state:**
```tsx
{!auditLoading && auditEntries.length === 0 && (
  <tr>
    <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
      No assumption changes recorded yet.
    </td>
  </tr>
)}
```

**Live rows** — each `AssumptionLogEntry` maps to:
- **Timestamp**: `new Date(entry.changedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })`
- **User**: `entry.changedBy`
- **Action chip**: `entry.action === "override"` → amber chip "Override"; `"reset"` → grey chip "Reset to Default"
- **Assumption**: `entry.assumptionType === "pd_curve"` → `"PD Curve · " + segmentLabel(entry.segment)`; `"lgd_recovery"` → `"LGD Recovery Factor"`
- **Before → After**: collapsible inline detail showing the key numeric fields from `previousValue` / `newValue`, or "—" if null

`segmentLabel` maps: `network → "Network"`, `lcc → "LCC"`, `regional → "Regional"`, `charter → "Charter"`.

The **table header** stays the same as the existing mock (ID/Ref column removed — assumption log has no short ID meaningful to users; timestamp + user + action + assumption + change is sufficient).

---

## Data Flow

```
User saves PD override in CurveOverrideDrawer
        ↓
usePdCurves.saveOverride(segment, values, notes)
        ↓
supabase.upsert(pd_curve_overrides)          [existing]
        ↓
logAssumptionChange(supabase, payload)       [new]
        ↓
supabase.insert(assumption_change_log)
        ↓
Settings → Audit Log tab
        ↓
useAssumptionLog() → SELECT * ORDER BY changed_at DESC LIMIT 50
```

---

## Testing

**`src/app/utils/assumptionLog.test.ts`** — two tests:
1. Successful insert: mock supabase client, assert correct fields passed to `.insert()`
2. Failed insert: mock supabase returning error, assert no throw, assert `console.warn` called

No tests needed for `useAssumptionLog` (trivial fetch/map) or the Settings display changes (pure rendering).

Existing 412 tests must remain green.

---

## What is NOT in scope

- Scenario run logging
- Export / login event logging
- Pagination of the audit log (50-row limit is sufficient)
- Per-lessee or per-asset assumption overrides (not yet built)
- Email notifications on assumption changes
- Supabase RLS policies (existing org_id pattern applies)
