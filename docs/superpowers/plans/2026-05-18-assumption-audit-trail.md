# Assumption Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log every PD curve and LGD recovery factor override/reset with who changed it, when, and what changed — and surface that log in the Settings → Audit Log tab in place of the existing hardcoded mock data.

**Architecture:** Append-only `assumption_change_log` Supabase table; a shared `logAssumptionChange` utility called by `usePdCurves` and `useLgdCurves` after each successful save/reset; a `useAssumptionLog` read hook; Settings.tsx updated to render live entries.

**Tech Stack:** React 18, TypeScript, Supabase JS v2, Vitest.

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/005_assumption_change_log.sql` | Create — new table |
| `src/app/utils/assumptionLog.ts` | Create — shared write utility |
| `src/app/utils/assumptionLog.test.ts` | Create — unit tests |
| `src/app/hooks/useAssumptionLog.ts` | Create — read hook for Settings |
| `src/app/hooks/usePdCurves.ts` | Modify — call log after save/reset |
| `src/app/hooks/useLgdCurves.ts` | Modify — call log after save/reset |
| `src/app/pages/Settings.tsx` | Modify — replace mock with live data |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/005_assumption_change_log.sql`

> **Background:** The project uses a `supabase/migrations/` directory with numbered SQL files. The previous migration is `004_lgd_curves.sql`. You are creating `005_assumption_change_log.sql`. This migration does NOT need to be run as part of this task — just create the file. The team runs migrations manually against the Supabase project.

- [ ] **Step 1: Verify tests are green before touching anything**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: `Tests  412 passed (412)`

- [ ] **Step 2: Create the migration file**

Create `supabase/migrations/005_assumption_change_log.sql` with this exact content:

```sql
-- assumption audit trail: append-only log of PD and LGD assumption changes
-- migration: 005_assumption_change_log

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

- [ ] **Step 3: Verify tests still green**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: `Tests  412 passed (412)`

- [ ] **Step 4: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add supabase/migrations/005_assumption_change_log.sql && git commit -m "feat: add assumption_change_log migration"
```

---

### Task 2: assumptionLog utility + tests

**Files:**
- Create: `src/app/utils/assumptionLog.ts`
- Create: `src/app/utils/assumptionLog.test.ts`

> **Background:** This is a pure async utility with no React dependencies. It takes a Supabase client and a payload, inserts one row, and swallows errors (non-blocking). The test mocks the Supabase client. Look at `src/app/utils/jurisdictionRisk.test.ts` for the project's Vitest style — plain `describe/it/expect`, no testing-library.

- [ ] **Step 1: Write the failing tests**

Create `src/app/utils/assumptionLog.test.ts`:

```typescript
// src/app/utils/assumptionLog.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logAssumptionChange } from "./assumptionLog";
import type { AssumptionChangePayload } from "./assumptionLog";

const mockInsert = vi.fn();
const mockFrom   = vi.fn(() => ({ insert: mockInsert }));
const mockSupabase = { from: mockFrom } as any;

const basePayload: AssumptionChangePayload = {
  orgId:          "org-123",
  assumptionType: "pd_curve",
  segment:        "lcc",
  action:         "override",
  previousValue:  null,
  newValue:       { pd1yr: 0.05, pd2yr: 0.09, pd3yr: 0.13, pd5yr: 0.18, pd_lifetime: 0.35 },
  notes:          "test override",
  changedBy:      "analyst@example.com",
};

describe("logAssumptionChange", () => {
  beforeEach(() => {
    mockInsert.mockReset();
    mockFrom.mockReset();
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts the correct fields into assumption_change_log", async () => {
    mockInsert.mockResolvedValue({ error: null });

    await logAssumptionChange(mockSupabase, basePayload);

    expect(mockFrom).toHaveBeenCalledWith("assumption_change_log");
    expect(mockInsert).toHaveBeenCalledWith({
      org_id:          "org-123",
      assumption_type: "pd_curve",
      segment:         "lcc",
      action:          "override",
      previous_value:  null,
      new_value:       { pd1yr: 0.05, pd2yr: 0.09, pd3yr: 0.13, pd5yr: 0.18, pd_lifetime: 0.35 },
      notes:           "test override",
      changed_by:      "analyst@example.com",
    });
  });

  it("does not throw when the insert fails — logs a console warning instead", async () => {
    mockInsert.mockResolvedValue({ error: { message: "DB unavailable" } });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(logAssumptionChange(mockSupabase, basePayload)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[assumptionLog]"),
      expect.stringContaining("DB unavailable"),
    );
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/assumptionLog.test.ts --reporter=verbose 2>&1
```

Expected: FAIL — `Cannot find module './assumptionLog'`

- [ ] **Step 3: Create the utility**

Create `src/app/utils/assumptionLog.ts`:

```typescript
// src/app/utils/assumptionLog.ts
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

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/assumptionLog.test.ts --reporter=verbose 2>&1
```

Expected:
```
✓ logAssumptionChange > inserts the correct fields into assumption_change_log
✓ logAssumptionChange > does not throw when the insert fails — logs a console warning instead
Tests  2 passed (2)
```

- [ ] **Step 5: Run full suite — verify no regressions**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: `Tests  414 passed (414)`

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/utils/assumptionLog.ts src/app/utils/assumptionLog.test.ts && git commit -m "feat: add logAssumptionChange utility with tests"
```

---

### Task 3: useAssumptionLog hook

**Files:**
- Create: `src/app/hooks/useAssumptionLog.ts`

> **Background:** This is a read-only React hook. It fetches the 50 most recent rows from `assumption_change_log`, ordered newest-first. Uses the stale-closure guard pattern (`let cancelled = false`) already used by `usePdCurves` and `useLgdCurves`. Import `supabase` from `"../lib/supabase"` (note: NOT `supabaseClient`). Supabase RLS handles org scoping — no `org_id` filter needed in the query.

- [ ] **Step 1: Create the hook**

Create `src/app/hooks/useAssumptionLog.ts`:

```typescript
// src/app/hooks/useAssumptionLog.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface AssumptionLogEntry {
  id:             string;
  assumptionType: "pd_curve" | "lgd_recovery";
  segment:        string | null;
  action:         "override" | "reset";
  previousValue:  Record<string, number> | null;
  newValue:       Record<string, number> | null;
  notes:          string | null;
  changedBy:      string;
  changedAt:      string;  // ISO timestamp string
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
    async function load() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("assumption_change_log")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (!error && data) {
        setEntries(
          data.map((r) => ({
            id:             r.id,
            assumptionType: r.assumption_type as "pd_curve" | "lgd_recovery",
            segment:        r.segment,
            action:         r.action as "override" | "reset",
            previousValue:  r.previous_value,
            newValue:       r.new_value,
            notes:          r.notes,
            changedBy:      r.changed_by,
            changedAt:      r.changed_at,
          }))
        );
      }
      setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { entries, isLoading };
}
```

- [ ] **Step 2: Run full suite — verify no regressions**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: `Tests  414 passed (414)`

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/hooks/useAssumptionLog.ts && git commit -m "feat: add useAssumptionLog read hook"
```

---

### Task 4: Wire usePdCurves to log assumption changes

**Files:**
- Modify: `src/app/hooks/usePdCurves.ts`

> **Background:** The full file is at `src/app/hooks/usePdCurves.ts`. Key facts:
> - `orgId` comes from `useData()` context — already in scope in `saveOverride` and `resetToDefault` via closure
> - `curves` (state) holds the current effective values including any existing override; `isOverridden` (state) is a `Record<CarrierSegment, boolean>`
> - `saveOverride` signature: `(segment: CarrierSegment, values: Pick<PdTermStructure, "pd1yr"|"pd2yr"|"pd3yr"|"pd5yr"|"pdLifetime"> & { notes?: string; updatedBy?: string }) => Promise<void>`
> - `resetToDefault` signature: `(segment: CarrierSegment) => Promise<void>`
> - Log call goes AFTER the successful Supabase operation (after `if (error) throw error`) and BEFORE `fetchOverrides()`
> - `supabase` is already imported from `"../lib/supabase"`

- [ ] **Step 1: Add the import**

In `src/app/hooks/usePdCurves.ts`, find the existing imports block at the top. Add one new import line after the existing imports:

```typescript
import { logAssumptionChange } from "../utils/assumptionLog";
```

The imports block should then look like:

```typescript
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import {
  DEFAULT_PD_CURVES,
  mergeCurves,
  type CarrierSegment,
  type PdCurveLibrary,
  type PdTermStructure,
} from "../data/pdCurves";
import { logAssumptionChange } from "../utils/assumptionLog";
```

- [ ] **Step 2: Add log call in saveOverride**

Find the `saveOverride` callback. Currently it ends with:

```typescript
      if (error) throw error;
      await fetchOverrides();
    },
    [orgId, fetchOverrides]
  );
```

Replace with:

```typescript
      if (error) throw error;
      const user = (await supabase.auth.getUser()).data.user;
      const prevCurve = curves[segment];
      await logAssumptionChange(supabase, {
        orgId,
        assumptionType:  "pd_curve",
        segment,
        action:          "override",
        previousValue:   isOverridden[segment]
                           ? { pd1yr: prevCurve.pd1yr, pd2yr: prevCurve.pd2yr,
                               pd3yr: prevCurve.pd3yr, pd5yr: prevCurve.pd5yr,
                               pd_lifetime: prevCurve.pdLifetime }
                           : null,
        newValue:        { pd1yr: values.pd1yr, pd2yr: values.pd2yr,
                           pd3yr: values.pd3yr, pd5yr: values.pd5yr,
                           pd_lifetime: values.pdLifetime },
        notes:           values.notes ?? null,
        changedBy:       user?.email ?? "unknown",
      });
      await fetchOverrides();
    },
    [orgId, fetchOverrides, curves, isOverridden]
  );
```

Note: `curves` and `isOverridden` are added to the dependency array.

- [ ] **Step 3: Add log call in resetToDefault**

Find the `resetToDefault` callback. Currently it ends with:

```typescript
      if (error) throw error;
      await fetchOverrides();
    },
    [orgId, fetchOverrides]
  );
```

Replace with:

```typescript
      if (error) throw error;
      const user = (await supabase.auth.getUser()).data.user;
      const prevCurve = curves[segment];
      await logAssumptionChange(supabase, {
        orgId,
        assumptionType:  "pd_curve",
        segment,
        action:          "reset",
        previousValue:   { pd1yr: prevCurve.pd1yr, pd2yr: prevCurve.pd2yr,
                           pd3yr: prevCurve.pd3yr, pd5yr: prevCurve.pd5yr,
                           pd_lifetime: prevCurve.pdLifetime },
        newValue:        null,
        notes:           null,
        changedBy:       user?.email ?? "unknown",
      });
      await fetchOverrides();
    },
    [orgId, fetchOverrides, curves]
  );
```

Note: `curves` added to the dependency array.

- [ ] **Step 4: Run full suite — verify no regressions**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: `Tests  414 passed (414)`

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/hooks/usePdCurves.ts && git commit -m "feat: log PD curve assumption changes in usePdCurves"
```

---

### Task 5: Wire useLgdCurves to log assumption changes

**Files:**
- Modify: `src/app/hooks/useLgdCurves.ts`

> **Background:** The full file is at `src/app/hooks/useLgdCurves.ts`. Key facts:
> - `orgId` from `useData()` — already in closure
> - `recoveryFactor` (state, number) and `isOverridden` (state, boolean) are already in scope
> - `saveRecoveryOverride` signature: `(factor: number, notes?: string, updatedBy?: string) => Promise<void>`
> - `resetToDefault` signature: `() => Promise<void>`
> - Log call goes AFTER `if (error) throw error` and BEFORE the inline post-save refresh
> - `supabase` already imported from `"../lib/supabase"`

- [ ] **Step 1: Add the import**

In `src/app/hooks/useLgdCurves.ts`, add after the existing imports:

```typescript
import { logAssumptionChange } from "../utils/assumptionLog";
```

The imports block becomes:

```typescript
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { DEFAULT_RECOVERY_FACTOR } from "../data/lgdCurves";
import { logAssumptionChange } from "../utils/assumptionLog";
```

- [ ] **Step 2: Add log call in saveRecoveryOverride**

Find `saveRecoveryOverride`. Currently after the upsert error check:

```typescript
      if (error) throw error;
      // Inline post-save refresh — no fetchOverride callback needed
      const { data } = await supabase
```

Replace that section with:

```typescript
      if (error) throw error;
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
      // Inline post-save refresh — no fetchOverride callback needed
      const { data } = await supabase
```

Also add `recoveryFactor` and `isOverridden` to the `useCallback` dependency array:

```typescript
    [orgId, recoveryFactor, isOverridden]
```

- [ ] **Step 3: Add log call in resetToDefault**

Find `resetToDefault`. Currently:

```typescript
      if (error) throw error;
      setRecoveryFactor(DEFAULT_RECOVERY_FACTOR);
      setIsOverridden(false);
    },
    [orgId]
  );
```

Replace with:

```typescript
      if (error) throw error;
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
      setRecoveryFactor(DEFAULT_RECOVERY_FACTOR);
      setIsOverridden(false);
    },
    [orgId, recoveryFactor]
  );
```

- [ ] **Step 4: Run full suite — verify no regressions**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: `Tests  414 passed (414)`

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/hooks/useLgdCurves.ts && git commit -m "feat: log LGD recovery factor assumption changes in useLgdCurves"
```

---

### Task 6: Wire Settings.tsx Audit Log tab to live data

**Files:**
- Modify: `src/app/pages/Settings.tsx`

> **Background:** `src/app/pages/Settings.tsx` currently has:
> - A hardcoded `const auditLog = [...]` array at the top (lines 53–62, 8 mock entries)
> - An Audit Log tab (lines 748–779) that renders this mock with a 6-column table: "Event ID", "Timestamp", "User", "Action", "Resource", "IP Address"
>
> You will: (1) remove the mock array, (2) add `useAssumptionLog` import and call, (3) replace the table body with live data using new columns: "Timestamp", "User", "Action", "Assumption", "Before → After".
>
> **Do not touch any other Settings tab** (tenant, users, data sources, model params, alerts).

- [ ] **Step 1: Add the import**

In `src/app/pages/Settings.tsx`, find the existing imports at the top. Add one new import after the existing local imports:

```typescript
import { useAssumptionLog } from "../hooks/useAssumptionLog";
```

- [ ] **Step 2: Remove the hardcoded mock array**

Find and delete these lines (the entire `auditLog` constant, lines ~53–62):

```typescript
const auditLog = [
  { id: "AUD-9814", timestamp: "29 Apr 2026, 09:20", user: "Alex Johnson", action: "Export: Auditor Evidence Pack", resource: "RUN-2024-0847", ip: "10.0.1.44" },
  { id: "AUD-9813", timestamp: "29 Apr 2026, 09:14", user: "Alex Johnson", action: "Run Scenario", resource: "Baseline Q1 2026", ip: "10.0.1.44" },
  { id: "AUD-9812", timestamp: "29 Apr 2026, 09:05", user: "John Williams", action: "Login", resource: "—", ip: "10.0.1.12" },
  { id: "AUD-9811", timestamp: "28 Apr 2026, 17:22", user: "Sarah Chen", action: "Export: Portfolio Register", resource: "XLSX", ip: "10.0.1.31" },
  { id: "AUD-9810", timestamp: "28 Apr 2026, 16:32", user: "Alex Johnson", action: "Run Scenario", resource: "Fuel Spike +40%", ip: "10.0.1.44" },
  { id: "AUD-9809", timestamp: "28 Apr 2026, 14:30", user: "Sarah Chen", action: "Export: ECL Disclosure Pack", resource: "PDF", ip: "10.0.1.31" },
  { id: "AUD-9808", timestamp: "28 Apr 2026, 11:05", user: "John Williams", action: "Update Model Param", resource: "Scenario weights", ip: "10.0.1.12" },
  { id: "AUD-9807", timestamp: "27 Apr 2026, 16:00", user: "John Williams", action: "Export: Watchlist Report", resource: "PDF", ip: "10.0.1.12" },
];
```

- [ ] **Step 3: Add hook call inside the component**

Find the `export default function Settings() {` function body. Add this line after the existing state declarations (e.g., after the `alertReadIds` state):

```typescript
  const { entries: auditEntries, isLoading: auditLoading } = useAssumptionLog();
```

- [ ] **Step 4: Replace the audit tab table**

Find this block in the audit tab section (lines ~757–777):

```tsx
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                    {["Event ID", "Timestamp", "User", "Action", "Resource", "IP Address"].map(h => (
                      <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry, i) => (
                    <tr key={entry.id} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>{entry.id}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569", whiteSpace: "nowrap" }}>{entry.timestamp}</td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{entry.user}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>{entry.action}</td>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>{entry.resource}</td>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#94A3B8" }}>{entry.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
```

Replace with:

```tsx
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                    {["Timestamp", "User", "Action", "Assumption", "Before → After"].map(h => (
                      <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLoading && Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
                      <td colSpan={5} style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ height: "1rem", background: "#E2E8F0", borderRadius: "0.25rem", width: `${50 + i * 15}%` }} />
                      </td>
                    </tr>
                  ))}
                  {!auditLoading && auditEntries.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
                        No assumption changes recorded yet.
                      </td>
                    </tr>
                  )}
                  {!auditLoading && auditEntries.map((entry, i) => {
                    const segmentLabel: Record<string, string> = {
                      network: "Network", lcc: "LCC", regional: "Regional", charter: "Charter",
                    };
                    const assumptionLabel = entry.assumptionType === "pd_curve"
                      ? `PD Curve · ${segmentLabel[entry.segment ?? ""] ?? entry.segment}`
                      : "LGD Recovery Factor";
                    const prevStr = entry.previousValue
                      ? Object.entries(entry.previousValue).map(([k, v]) => `${k}: ${typeof v === "number" ? (v * 100).toFixed(2) + "%" : v}`).join(", ")
                      : "—";
                    const newStr = entry.newValue
                      ? Object.entries(entry.newValue).map(([k, v]) => `${k}: ${typeof v === "number" ? (v * 100).toFixed(2) + "%" : v}`).join(", ")
                      : "Reset to default";
                    return (
                      <tr key={entry.id} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569", whiteSpace: "nowrap" }}>
                          {new Date(entry.changedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{entry.changedBy}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{
                            background: entry.action === "override" ? "#FEF3C7" : "#F1F5F9",
                            color:      entry.action === "override" ? "#B45309"  : "#475569",
                            fontSize: "0.75rem", fontWeight: 600,
                            padding: "0.2rem 0.5rem", borderRadius: "9999px",
                          }}>
                            {entry.action === "override" ? "Override" : "Reset to Default"}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>{assumptionLabel}</td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#475569", fontFamily: "monospace" }}>
                          {prevStr} → {newStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
```

- [ ] **Step 5: Run full suite — verify no regressions**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: `Tests  414 passed (414)`

- [ ] **Step 6: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/pages/Settings.tsx && git commit -m "feat: wire Settings Audit Log tab to live assumption_change_log data"
```

---

## Self-Review Checklist (already run)

- ✅ **Spec coverage:** Migration ✓, `logAssumptionChange` utility ✓, `useAssumptionLog` hook ✓, `usePdCurves` save+reset ✓, `useLgdCurves` save+reset ✓, Settings display ✓, loading state ✓, empty state ✓
- ✅ **No placeholders:** All code blocks complete with exact field names and values
- ✅ **Type consistency:** `AssumptionChangePayload` defined in Task 2, used identically in Tasks 4 & 5. `AssumptionLogEntry` defined in Task 3, consumed in Task 6. `pd_lifetime` key used consistently in both PD tasks.
- ✅ **Dependency arrays:** `curves` and `isOverridden` added to `saveOverride` dep array; `curves` to `resetToDefault`; `recoveryFactor`/`isOverridden` to LGD equivalents — no stale closure risk.
