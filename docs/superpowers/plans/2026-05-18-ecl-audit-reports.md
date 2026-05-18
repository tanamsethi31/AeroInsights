# ECL Audit Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded §5/§6 in the IFRS 9 Auditor Evidence Pack with live computed data, add a "Close Period" snapshot mechanism for re-download and roll-forward computation, and surface a snapshot log in Settings.

**Architecture:** Pure utility functions (`eclRollForward`, `creditQualityMatrix`) compute §5 and §6 from ECL row arrays. A `useEclSnapshots` hook writes/reads `ecl_period_snapshots` in Supabase. A `ClosePeriodModal` lets the user explicitly lock a period; the Settings ECL Snapshots tab lists all locked periods with re-download.

**Tech Stack:** React, TypeScript, Supabase JS v2, Vitest, Framer Motion, inline styles (no CSS modules).

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/006_ecl_period_snapshots.sql` | Create |
| `src/app/utils/eclRollForward.ts` | Create |
| `src/app/utils/eclRollForward.test.ts` | Create |
| `src/app/utils/creditQualityMatrix.ts` | Create |
| `src/app/utils/creditQualityMatrix.test.ts` | Create |
| `src/app/hooks/useEclSnapshots.ts` | Create |
| `src/app/components/risk-ecl/ClosePeriodModal.tsx` | Create |
| `src/app/services/reportGenerators.ts` | Modify |
| `src/app/components/risk-ecl/AuditorPackModal.tsx` | Modify |
| `src/app/pages/RiskECL.tsx` | Modify |
| `src/app/pages/Settings.tsx` | Modify |
| `src/app/pages/Reports.tsx` | Modify |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/006_ecl_period_snapshots.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/006_ecl_period_snapshots.sql
-- ECL period snapshots: append-only log of locked reporting periods

create table if not exists ecl_period_snapshots (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  period_label     text not null,
  locked_at        timestamptz not null default now(),
  locked_by        text not null default 'unknown',
  -- aggregates for log display
  stage1_ecl       numeric not null,
  stage2_ecl       numeric not null,
  stage3_ecl       numeric not null,
  total_ecl        numeric not null,
  ecl_12m          numeric not null,
  coverage_pct     numeric not null,
  -- full state for re-download and roll-forward diff
  scenario_inputs  jsonb not null,
  weights          jsonb not null,
  scenario_summary jsonb not null,
  weighted         jsonb not null,
  sicr_config      jsonb not null,
  ecl_rows         jsonb not null,
  currency         text not null default 'USD'
);

create index if not exists ecl_period_snapshots_org_idx
  on ecl_period_snapshots(org_id, locked_at desc);
```

- [ ] **Step 2: Verify file exists**

```bash
cat supabase/migrations/006_ecl_period_snapshots.sql
```

Expected: file contents printed without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_ecl_period_snapshots.sql
git commit -m "feat: add ecl_period_snapshots migration"
```

---

### Task 2: eclRollForward utility

**Files:**
- Create: `src/app/utils/eclRollForward.ts`
- Create: `src/app/utils/eclRollForward.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/utils/eclRollForward.test.ts`:

```typescript
// src/app/utils/eclRollForward.test.ts
import { describe, it, expect } from "vitest";
import { computeRollForward, type EclRow } from "./eclRollForward";

function row(id: string, stage: "1" | "2" | "3", eclLT: number): EclRow {
  return { id, lessee: "TestAir", aircraft: "A320", ead: eclLT * 10, pd12m: 1, lgd: 50, ecl12m: eclLT / 2, eclLT, stage };
}

describe("computeRollForward", () => {
  it("allocates new originations entirely to Stage 1 column", () => {
    const prev: EclRow[] = [];
    const curr = [row("L1", "1", 5.0)];
    const lines = computeRollForward(prev, curr);
    const newOrig = lines.find(l => l.label.includes("New originations"))!;
    expect(newOrig.stage1).toBe(5.0);
    expect(newOrig.stage2).toBe(0);
    expect(newOrig.stage3).toBe(0);
    expect(newOrig.total).toBe(5.0);
  });

  it("splits SICR transfer Stage 1 → 2 as negative S1, positive S2", () => {
    const prev = [row("L1", "1", 4.0)];
    const curr = [row("L1", "2", 6.0)];
    const lines = computeRollForward(prev, curr);
    const sicr = lines.find(l => l.label.includes("1 → 2"))!;
    expect(sicr.stage1).toBe(-4.0);
    expect(sicr.stage2).toBe(6.0);
    expect(sicr.stage3).toBe(0);
  });

  it("assigns derecognition as negative in the correct stage column", () => {
    const prev = [row("L1", "2", 3.0)];
    const curr: EclRow[] = [];
    const lines = computeRollForward(prev, curr);
    const derecog = lines.find(l => l.label.includes("Derecognition"))!;
    expect(derecog.stage1).toBe(0);
    expect(derecog.stage2).toBe(-3.0);
    expect(derecog.stage3).toBe(0);
  });

  it("balancing line makes closing = opening + all movements", () => {
    const prev = [row("L1", "1", 10.0), row("L2", "2", 5.0)];
    const curr = [row("L1", "1", 11.0), row("L2", "2", 6.0), row("L3", "1", 2.0)];
    const lines = computeRollForward(prev, curr);
    const opening = lines[0];
    const closing = lines[lines.length - 1];
    const sumMovements = lines.slice(1, -1).reduce(
      (s, l) => ({ s1: s.s1 + l.stage1, s2: s.s2 + l.stage2, s3: s.s3 + l.stage3 }),
      { s1: 0, s2: 0, s3: 0 }
    );
    expect(closing.stage1).toBeCloseTo(opening.stage1 + sumMovements.s1, 10);
    expect(closing.stage2).toBeCloseTo(opening.stage2 + sumMovements.s2, 10);
    expect(closing.stage3).toBeCloseTo(opening.stage3 + sumMovements.s3, 10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/eclRollForward.test.ts 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module './eclRollForward'"

- [ ] **Step 3: Create the utility**

Create `src/app/utils/eclRollForward.ts`:

```typescript
// src/app/utils/eclRollForward.ts

export interface EclRow {
  id:       string;
  lessee:   string;
  aircraft: string;
  ead:      number;
  pd12m:    number;
  lgd:      number;
  ecl12m:   number;
  eclLT:    number;
  stage:    "1" | "2" | "3";
}

export interface RollForwardLine {
  label:  string;
  stage1: number;
  stage2: number;
  stage3: number;
  total:  number;
}

export function computeRollForward(
  previousRows: EclRow[],
  currentRows:  EclRow[],
): RollForwardLine[] {
  const prevMap = new Map(previousRows.map(r => [r.id, r]));
  const currMap = new Map(currentRows.map(r => [r.id, r]));

  const stageBucket = (rows: EclRow[]) =>
    rows.reduce((acc, r) => {
      if (r.stage === "1") acc.s1 += r.eclLT;
      else if (r.stage === "2") acc.s2 += r.eclLT;
      else acc.s3 += r.eclLT;
      return acc;
    }, { s1: 0, s2: 0, s3: 0 });

  const opening = stageBucket(previousRows);
  const closing = stageBucket(currentRows);

  // New originations — in current but not in previous, always allocated to S1
  const newOrig = { s1: 0, s2: 0, s3: 0 };
  for (const r of currentRows) {
    if (!prevMap.has(r.id)) newOrig.s1 += r.eclLT;
  }

  // SICR Stage 1 → 2
  const sicrS1S2 = { s1: 0, s2: 0, s3: 0 };
  // SICR Stage 2 → 3
  const sicrS2S3 = { s1: 0, s2: 0, s3: 0 };
  for (const curr of currentRows) {
    const prev = prevMap.get(curr.id);
    if (!prev) continue;
    if (prev.stage === "1" && curr.stage === "2") {
      sicrS1S2.s1 -= prev.eclLT;
      sicrS1S2.s2 += curr.eclLT;
    } else if (prev.stage === "2" && curr.stage === "3") {
      sicrS2S3.s2 -= prev.eclLT;
      sicrS2S3.s3 += curr.eclLT;
    }
  }

  // Derecognition — in previous but not in current, negative in their original stage
  const derecog = { s1: 0, s2: 0, s3: 0 };
  for (const r of previousRows) {
    if (!currMap.has(r.id)) {
      if (r.stage === "1") derecog.s1 -= r.eclLT;
      else if (r.stage === "2") derecog.s2 -= r.eclLT;
      else derecog.s3 -= r.eclLT;
    }
  }

  // Model / FX / other — balancing item so closing = opening + all movements
  const knownMovements = [newOrig, sicrS1S2, sicrS2S3, derecog];
  const sumKnown = knownMovements.reduce(
    (acc, m) => ({ s1: acc.s1 + m.s1, s2: acc.s2 + m.s2, s3: acc.s3 + m.s3 }),
    { s1: 0, s2: 0, s3: 0 }
  );
  const modelFx = {
    s1: closing.s1 - opening.s1 - sumKnown.s1,
    s2: closing.s2 - opening.s2 - sumKnown.s2,
    s3: closing.s3 - opening.s3 - sumKnown.s3,
  };

  const toLine = (label: string, v: { s1: number; s2: number; s3: number }): RollForwardLine => ({
    label, stage1: v.s1, stage2: v.s2, stage3: v.s3, total: v.s1 + v.s2 + v.s3,
  });

  return [
    toLine("Opening ECL balance",           opening),
    toLine("New originations (Stage 1)",    newOrig),
    toLine("SICR transfers — Stage 1 → 2", sicrS1S2),
    toLine("SICR transfers — Stage 2 → 3", sicrS2S3),
    toLine("Derecognition / repayments",    derecog),
    toLine("Model / FX / other movements", modelFx),
    toLine("Closing ECL balance",           closing),
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/eclRollForward.test.ts 2>&1 | tail -10
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/eclRollForward.ts src/app/utils/eclRollForward.test.ts
git commit -m "feat: add computeRollForward utility with IFRS 7 §35H movement lines"
```

---

### Task 3: creditQualityMatrix utility

**Files:**
- Create: `src/app/utils/creditQualityMatrix.ts`
- Create: `src/app/utils/creditQualityMatrix.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/utils/creditQualityMatrix.test.ts`:

```typescript
// src/app/utils/creditQualityMatrix.test.ts
import { describe, it, expect } from "vitest";
import { computeCreditQualityMatrix } from "./creditQualityMatrix";
import type { EclRow } from "./eclRollForward";

function row(id: string, stage: "1" | "2" | "3", ead: number, lessee: string): EclRow {
  return { id, lessee, aircraft: "A320", ead, pd12m: 1, lgd: 50, ecl12m: 0.1, eclLT: 0.2, stage };
}

describe("computeCreditQualityMatrix", () => {
  it("buckets BBB- rating into BBB grade", () => {
    const rows = [row("L1", "1", 100, "AirA")];
    const lessees = [{ name: "AirA", credit_rating: "BBB-" }];
    const result = computeCreditQualityMatrix(rows, lessees);
    expect(result).toHaveLength(1);
    expect(result[0].grade).toBe("BBB");
    expect(result[0].s1Ead).toBe(100);
    expect(result[0].s2Ead).toBe(0);
    expect(result[0].s3Ead).toBe(0);
  });

  it("buckets BB+ rating into BB / BB− grade", () => {
    const rows = [row("L1", "2", 50, "AirB")];
    const lessees = [{ name: "AirB", credit_rating: "BB+" }];
    const result = computeCreditQualityMatrix(rows, lessees);
    expect(result[0].grade).toBe("BB / BB−");
    expect(result[0].s2Ead).toBe(50);
    expect(result[0].pctPortfolio).toBe(100);
  });

  it("places null-rated lessee in Unrated row", () => {
    const rows = [row("L1", "3", 30, "AirC")];
    const lessees = [{ name: "AirC", credit_rating: null }];
    const result = computeCreditQualityMatrix(rows, lessees);
    expect(result[0].grade).toBe("Unrated");
    expect(result[0].s3Ead).toBe(30);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/creditQualityMatrix.test.ts 2>&1 | tail -10
```

Expected: FAIL — "Cannot find module './creditQualityMatrix'"

- [ ] **Step 3: Create the utility**

Create `src/app/utils/creditQualityMatrix.ts`:

```typescript
// src/app/utils/creditQualityMatrix.ts
import type { EclRow } from "./eclRollForward";

export interface CreditQualityRow {
  grade:        string;
  s1Ead:        number;
  s2Ead:        number;
  s3Ead:        number;
  totalEad:     number;
  pctPortfolio: number;
}

const GRADE_ORDER = [
  "A / A−",
  "BBB",
  "BB / BB−",
  "B+",
  "B / B−",
  "CCC and below",
  "Unrated",
] as const;

function toBucket(rating: string | null | undefined): string {
  if (!rating || rating === "—") return "Unrated";
  const r = rating.trim().toUpperCase();
  if (/^A[+-]?$/.test(r))         return "A / A−";
  if (/^BBB[+-]?$/.test(r))       return "BBB";
  if (/^BB[+-]?$/.test(r))        return "BB / BB−";
  if (r === "B+")                  return "B+";
  if (r === "B" || r === "B-")    return "B / B−";
  if (/^(CCC|CC|C|D)[+-]?$/.test(r)) return "CCC and below";
  return "Unrated";
}

export function computeCreditQualityMatrix(
  eclRows: EclRow[],
  lessees: Array<{ name: string; credit_rating: string | null }>,
): CreditQualityRow[] {
  const ratingMap = new Map(lessees.map(l => [l.name.toLowerCase(), l.credit_rating]));
  const totalEad  = eclRows.reduce((s, r) => s + r.ead, 0);
  const buckets   = new Map<string, { s1: number; s2: number; s3: number }>();

  for (const r of eclRows) {
    const grade = toBucket(ratingMap.get(r.lessee.toLowerCase()));
    const b = buckets.get(grade) ?? { s1: 0, s2: 0, s3: 0 };
    if (r.stage === "1") b.s1 += r.ead;
    else if (r.stage === "2") b.s2 += r.ead;
    else b.s3 += r.ead;
    buckets.set(grade, b);
  }

  const result: CreditQualityRow[] = [];
  for (const grade of GRADE_ORDER) {
    const b = buckets.get(grade);
    if (!b) continue;
    const t = b.s1 + b.s2 + b.s3;
    if (t === 0) continue;
    result.push({
      grade,
      s1Ead:        b.s1,
      s2Ead:        b.s2,
      s3Ead:        b.s3,
      totalEad:     t,
      pctPortfolio: totalEad > 0 ? (t / totalEad) * 100 : 0,
    });
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run src/app/utils/creditQualityMatrix.test.ts 2>&1 | tail -10
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -5
```

Expected: all existing tests pass, 7 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/utils/creditQualityMatrix.ts src/app/utils/creditQualityMatrix.test.ts
git commit -m "feat: add computeCreditQualityMatrix utility with IFRS 7 §35I grade buckets"
```

---

### Task 4: useEclSnapshots hook

**Files:**
- Create: `src/app/hooks/useEclSnapshots.ts`

No unit tests needed for this hook — it's a Supabase fetch/write with the same pattern as `useAssumptionLog`. Integration tested via the UI.

- [ ] **Step 1: Create the hook**

Create `src/app/hooks/useEclSnapshots.ts`:

```typescript
// src/app/hooks/useEclSnapshots.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import type { ScenarioInputs } from "../utils/eclCalculator";
import type { EclRow } from "../utils/eclRollForward";

export interface SicrConfig {
  dpdEnabled:              boolean;
  dpdDays:                 number;
  upgradeEnabled:          boolean;
  upgradeNotches:          number;
  countryWatchlistEnabled: boolean;
  insolvencyEnabled:       boolean;
}

export interface ScenarioSummaryEntry {
  ecl12m:      number;
  eclLifetime: number;
  coverage:    number;
}

export interface EclSnapshot {
  id:              string;
  periodLabel:     string;
  lockedAt:        string;
  lockedBy:        string;
  stage1Ecl:       number;
  stage2Ecl:       number;
  stage3Ecl:       number;
  totalEcl:        number;
  ecl12m:          number;
  coveragePct:     number;
  scenarioInputs:  { base: ScenarioInputs; adverse: ScenarioInputs; upside: ScenarioInputs };
  weights:         { base: number; adverse: number; upside: number };
  scenarioSummary: { base: ScenarioSummaryEntry; adverse: ScenarioSummaryEntry; upside: ScenarioSummaryEntry };
  weighted:        { ecl12m: number; eclLifetime: number; coverage: number };
  sicrConfig:      SicrConfig;
  eclRows:         EclRow[];
  currency:        string;
}

export type LockPeriodPayload = Omit<EclSnapshot, "id" | "lockedAt" | "lockedBy">;

interface Result {
  snapshots:  EclSnapshot[];
  isLoading:  boolean;
  lockPeriod: (payload: LockPeriodPayload) => Promise<void>;
}

function mapRow(r: Record<string, unknown>): EclSnapshot {
  return {
    id:              r.id as string,
    periodLabel:     r.period_label as string,
    lockedAt:        r.locked_at as string,
    lockedBy:        r.locked_by as string,
    stage1Ecl:       Number(r.stage1_ecl),
    stage2Ecl:       Number(r.stage2_ecl),
    stage3Ecl:       Number(r.stage3_ecl),
    totalEcl:        Number(r.total_ecl),
    ecl12m:          Number(r.ecl_12m),
    coveragePct:     Number(r.coverage_pct),
    scenarioInputs:  r.scenario_inputs as EclSnapshot["scenarioInputs"],
    weights:         r.weights         as EclSnapshot["weights"],
    scenarioSummary: r.scenario_summary as EclSnapshot["scenarioSummary"],
    weighted:        r.weighted        as EclSnapshot["weighted"],
    sicrConfig:      r.sicr_config     as SicrConfig,
    eclRows:         r.ecl_rows        as EclRow[],
    currency:        r.currency        as string,
  };
}

export function useEclSnapshots(): Result {
  const { orgId } = useData();
  const [snapshots, setSnapshots] = useState<EclSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSnapshots = useCallback(async () => {
    if (!orgId) { setIsLoading(false); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from("ecl_period_snapshots")
      .select("*")
      .eq("org_id", orgId)
      .order("locked_at", { ascending: false })
      .limit(20);
    if (!error && data) {
      setSnapshots((data as Record<string, unknown>[]).map(mapRow));
    }
    setIsLoading(false);
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!orgId) { setIsLoading(false); return; }
      setIsLoading(true);
      const { data, error } = await supabase
        .from("ecl_period_snapshots")
        .select("*")
        .eq("org_id", orgId)
        .order("locked_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (!error && data) {
        setSnapshots((data as Record<string, unknown>[]).map(mapRow));
      }
      setIsLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [orgId]);

  const lockPeriod = useCallback(
    async (payload: LockPeriodPayload) => {
      if (!orgId) return;
      const user = (await supabase.auth.getUser()).data.user;
      const lockedBy = user?.email ?? "unknown";
      const { error } = await supabase.from("ecl_period_snapshots").insert({
        org_id:          orgId,
        period_label:    payload.periodLabel,
        locked_by:       lockedBy,
        stage1_ecl:      payload.stage1Ecl,
        stage2_ecl:      payload.stage2Ecl,
        stage3_ecl:      payload.stage3Ecl,
        total_ecl:       payload.totalEcl,
        ecl_12m:         payload.ecl12m,
        coverage_pct:    payload.coveragePct,
        scenario_inputs: payload.scenarioInputs,
        weights:         payload.weights,
        scenario_summary: payload.scenarioSummary,
        weighted:        payload.weighted,
        sicr_config:     payload.sicrConfig,
        ecl_rows:        payload.eclRows,
        currency:        payload.currency,
      });
      if (error) throw error;
      await fetchSnapshots();
    },
    [orgId, fetchSnapshots]
  );

  return { snapshots, isLoading, lockPeriod };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from `useEclSnapshots.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/hooks/useEclSnapshots.ts
git commit -m "feat: add useEclSnapshots hook with lockPeriod and append-only inserts"
```

---

### Task 5: Extend AuditorPackData + fix AuditorPackModal §5 and §6

**Files:**
- Modify: `src/app/services/reportGenerators.ts`
- Modify: `src/app/components/risk-ecl/AuditorPackModal.tsx`

- [ ] **Step 1: Add three fields to `AuditorPackData` in `reportGenerators.ts`**

Open `src/app/services/reportGenerators.ts`. The `AuditorPackData` interface starts at line 12. Add three fields after `currency: CurrencyCode`:

```typescript
// Add these three lines to AuditorPackData:
  rollForwardLines:  RollForwardLine[] | null;
  creditQualityRows: CreditQualityRow[];
  periodLabel:       string;
```

Also add the two imports at the top of the file (after existing imports):

```typescript
import type { RollForwardLine } from "../utils/eclRollForward";
import type { CreditQualityRow } from "../utils/creditQualityMatrix";
```

The full updated `AuditorPackData` interface should be:

```typescript
export interface AuditorPackData {
  scenarioInputs: {
    base:    ScenarioInputs;
    adverse: ScenarioInputs;
    upside:  ScenarioInputs;
  };
  weights: { base: number; adverse: number; upside: number };
  weighted: { ecl12m: number; eclLifetime: number; coverage: number };
  scenarioSummary: {
    base:    { ecl12m: number; eclLifetime: number; coverage: number };
    adverse: { ecl12m: number; eclLifetime: number; coverage: number };
    upside:  { ecl12m: number; eclLifetime: number; coverage: number };
  };
  eclRows: Array<{
    id: string; lessee: string; aircraft: string;
    ead: number; pd12m: number; lgd: number;
    ecl12m: number; eclLT: number; stage: string;
  }>;
  sicrConfig: {
    dpdEnabled: boolean; dpdDays: number;
    upgradeEnabled: boolean; upgradeNotches: number;
    countryWatchlistEnabled: boolean;
    insolvencyEnabled: boolean;
  };
  managementOverlay: string;
  currency: CurrencyCode;
  rollForwardLines:  RollForwardLine[] | null;
  creditQualityRows: CreditQualityRow[];
  periodLabel:       string;
}
```

- [ ] **Step 2: Replace hardcoded §5 in the DOCX generator (RPT-001 case)**

In `reportGenerators.ts`, find the §5 block inside the `case "RPT-001":` switch arm. It starts with:
```typescript
// §5 IFRS 7 §35H Roll-Forward
```

Replace the entire §5 section (from that comment through `new Paragraph({ text: "" }),` after it) with:

```typescript
// §5 IFRS 7 §35H Roll-Forward
new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§5 — IFRS 7 §35H ECL Allowance Roll-Forward", bold: true, color: "002147" })] }),
...(auditData.rollForwardLines === null
  ? [new Paragraph({ children: [new TextRun({ text: "Opening period — no prior snapshot available.", size: 18, color: "64748B" })] })]
  : [makeTable(
      ["Movement", "Stage 1", "Stage 2", "Stage 3", "Total"],
      auditData.rollForwardLines.map(l => [
        l.label,
        fmtAmt(l.stage1), fmtAmt(l.stage2), fmtAmt(l.stage3), fmtAmt(l.total),
      ])
    )]
),
new Paragraph({ text: "" }),
```

- [ ] **Step 3: Replace hardcoded §6 in the DOCX generator**

In the same RPT-001 block, find the §6 section (starts with `// §6 IFRS 7 §35I Credit Quality`). Replace from that comment through the closing `new Paragraph({ text: "" }),` with:

```typescript
// §6 IFRS 7 §35I Credit Quality
new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "§6 — IFRS 7 §35I Credit Quality Distribution", bold: true, color: "002147" })] }),
makeTable(
  ["Rating Grade", "Stage 1 EAD", "Stage 2 EAD", "Stage 3 EAD", "Total EAD", "% Portfolio"],
  auditData.creditQualityRows.map(r => [
    r.grade,
    fmtAmt(r.s1Ead), fmtAmt(r.s2Ead), fmtAmt(r.s3Ead), fmtAmt(r.totalEad),
    `${r.pctPortfolio.toFixed(1)}%`,
  ])
),
new Paragraph({ text: "" }),
```

- [ ] **Step 4: Update AuditorPackModal.tsx — dynamic period label in header**

Open `src/app/components/risk-ecl/AuditorPackModal.tsx`. Find the line:
```tsx
<div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "0.125rem" }}>
  Q1 2026 · Generated {new Date().toLocaleDateString("en-IE", { dateStyle: "long" })}
</div>
```

Replace with:
```tsx
<div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "0.125rem" }}>
  {data.periodLabel} · Generated {new Date().toLocaleDateString("en-IE", { dateStyle: "long" })}
</div>
```

- [ ] **Step 5: Replace §5 hardcoded table in AuditorPackModal.tsx**

Find the `{/* §5 Roll-Forward */}` section. Replace the `<PreviewTable ... />` call inside it with:

```tsx
{data.rollForwardLines === null ? (
  <p style={{ fontSize: "0.875rem", color: "#94A3B8", margin: 0 }}>
    Opening period — no prior snapshot available. Lock a second period to generate the roll-forward.
  </p>
) : (
  <PreviewTable
    headers={["Movement", "Stage 1", "Stage 2", "Stage 3", "Total"]}
    rows={data.rollForwardLines.map(line => [
      line.label,
      fmtM(line.stage1), fmtM(line.stage2), fmtM(line.stage3), fmtM(line.total),
    ])}
  />
)}
```

- [ ] **Step 6: Replace §6 hardcoded table in AuditorPackModal.tsx**

Find the `{/* §6 Credit Quality */}` section. Replace the `<PreviewTable ... />` call with:

```tsx
<PreviewTable
  headers={["Rating Grade", "Stage 1 EAD", "Stage 2 EAD", "Stage 3 EAD", "Total EAD", "% Portfolio"]}
  rows={data.creditQualityRows.map(r => [
    r.grade,
    fmtM(r.s1Ead), fmtM(r.s2Ead), fmtM(r.s3Ead), fmtM(r.totalEad),
    `${r.pctPortfolio.toFixed(1)}%`,
  ])}
/>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 8: Run tests**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/app/services/reportGenerators.ts src/app/components/risk-ecl/AuditorPackModal.tsx
git commit -m "feat: replace hardcoded §5/§6 in AuditorPackModal with live computed data"
```

---

### Task 6: ClosePeriodModal component

**Files:**
- Create: `src/app/components/risk-ecl/ClosePeriodModal.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/components/risk-ecl/ClosePeriodModal.tsx`:

```typescript
// src/app/components/risk-ecl/ClosePeriodModal.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock } from "lucide-react";
import { useEclSnapshots, type LockPeriodPayload } from "../../hooks/useEclSnapshots";

function currentQuarterLabel(): string {
  const now = new Date();
  return `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
}

interface ClosePeriodModalProps {
  open:     boolean;
  onClose:  () => void;
  onLocked: () => void;
  liveData: LockPeriodPayload;
}

const fmtM = (n: number) => `$${Math.abs(n).toFixed(1)}M`;

export function ClosePeriodModal({ open, onClose, onLocked, liveData }: ClosePeriodModalProps) {
  const { lockPeriod } = useEclSnapshots();
  const [periodLabel, setPeriodLabel] = useState(currentQuarterLabel);
  const [saving, setSaving]           = useState(false);
  const [done, setDone]               = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPeriodLabel(currentQuarterLabel());
      setSaving(false);
      setDone(false);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const canConfirm = periodLabel.trim() !== "" && liveData.eclRows.length > 0 && !saving && !done;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSaving(true);
    try {
      await lockPeriod({ ...liveData, periodLabel: periodLabel.trim() });
      setDone(true);
      setTimeout(() => { onClose(); onLocked(); }, 1200);
    } catch (err) {
      console.error("[ClosePeriodModal] lockPeriod error:", err);
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", zIndex: 1000 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: "fixed", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: "480px", background: "#FFFFFF",
              borderRadius: "1rem",
              boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
              zIndex: 1001, overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", background: "#002147" }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF" }}>Close Period</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "0.125rem" }}>
                  Lock current ECL state for IFRS 9 reporting
                </div>
              </div>
              <button
                onClick={onClose}
                style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", cursor: "pointer", color: "#FFFFFF" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "1.5rem" }}>
              {/* Period label input */}
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", display: "block", marginBottom: "0.375rem" }}>
                Period Label
              </label>
              <input
                value={periodLabel}
                onChange={e => setPeriodLabel(e.target.value)}
                placeholder="e.g. Q2 2026"
                disabled={saving || done}
                style={{
                  width: "100%", boxSizing: "border-box",
                  border: "1px solid #E2E8F0", borderRadius: "0.5rem",
                  padding: "0.625rem 0.875rem", fontSize: "0.9375rem",
                  color: "#0F172A", outline: "none",
                  marginBottom: "1.25rem",
                  transition: "border-color 150ms ease",
                }}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#002147"; }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "#E2E8F0"; }}
              />

              {/* ECL summary strip */}
              <div style={{ background: "#F8FAFC", borderRadius: "0.75rem", padding: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
                {[
                  { label: "Total ECL",  value: fmtM(liveData.totalEcl) },
                  { label: "Stage 1",    value: fmtM(liveData.stage1Ecl) },
                  { label: "Stage 2",    value: fmtM(liveData.stage2Ecl) },
                  { label: "Stage 3",    value: fmtM(liveData.stage3Ecl) },
                  { label: "ECL 12-Mo",  value: fmtM(liveData.ecl12m) },
                  { label: "Coverage",   value: `${liveData.coveragePct.toFixed(2)}%` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: "0.6875rem", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.125rem" }}>{label}</div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>{value}</div>
                  </div>
                ))}
              </div>

              {liveData.eclRows.length === 0 && (
                <p style={{ fontSize: "0.8125rem", color: "#B45309", background: "#FEF3C7", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", marginBottom: "1rem", marginTop: 0 }}>
                  No leases in portfolio — add leases before closing a period.
                </p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  onClick={onClose}
                  disabled={saving}
                  style={{ padding: "0.625rem 1.25rem", borderRadius: "9999px", border: "1px solid #E2E8F0", background: "transparent", color: "#475569", fontSize: "0.875rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    padding: "0.625rem 1.375rem", borderRadius: "9999px", border: "none",
                    background: done ? "#15803D" : canConfirm ? "#002147" : "#CBD5E1",
                    color: "#FFFFFF", fontSize: "0.875rem", fontWeight: 600,
                    cursor: canConfirm ? "pointer" : "not-allowed",
                    transition: "background 150ms ease",
                  }}
                >
                  <Lock size={13} />
                  {done ? "Period locked ✓" : saving ? "Locking…" : "Lock Period"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/risk-ecl/ClosePeriodModal.tsx
git commit -m "feat: add ClosePeriodModal for explicit period locking"
```

---

### Task 7: RiskECL.tsx modifications

**Files:**
- Modify: `src/app/pages/RiskECL.tsx`

Four changes: new imports, two `useMemo` derivations, "Close Period" button in header, AuditorPackModal data prop fixes.

- [ ] **Step 1: Add imports**

At the top of `src/app/pages/RiskECL.tsx`, after the existing imports, add:

```typescript
import { useCurrency } from "../contexts/CurrencyContext";
import { useEclSnapshots } from "../hooks/useEclSnapshots";
import { computeRollForward } from "../utils/eclRollForward";
import { computeCreditQualityMatrix } from "../utils/creditQualityMatrix";
import { ClosePeriodModal } from "../components/risk-ecl/ClosePeriodModal";
```

Also add `Lock` to the existing lucide import line. Find the line starting `import { Download` and add `Lock` to the list.

- [ ] **Step 2: Add hook calls and state**

Find the line `const [auditorPackOpen, setAuditorPackOpen] = useState(false);` (around line 270). Add after it:

```typescript
const [closePeriodOpen, setClosePeriodOpen] = useState(false);
const { currency } = useCurrency();
const { snapshots } = useEclSnapshots();
```

- [ ] **Step 3: Add the `eclRowsMapped` useMemo**

Find the line `const { sorted: sortedECL, ...` (around line 384). After that block, add:

```typescript
const eclRowsMapped = useMemo(
  () => sortedECL.map((r) => ({
    id:       r.id,
    lessee:   r.lessee,
    aircraft: r.aircraft,
    ead:      r.eadNum,
    pd12m:    r.pd12m,
    lgd:      r.lgd,
    ecl12m:   r.ecl12m,
    eclLT:    r.eclLifetime,
    stage:    (stageOverrides[r.id] ?? r.stage) as "1" | "2" | "3",
  })),
  [sortedECL, stageOverrides]
);
```

- [ ] **Step 4: Add rollForwardLines and creditQualityRows useMemos**

Directly after `eclRowsMapped`, add:

```typescript
const rollForwardLines = useMemo(() => {
  const prev = snapshots[0] ?? null;
  if (!prev) return null;
  return computeRollForward(prev.eclRows, eclRowsMapped);
}, [snapshots, eclRowsMapped]);

const creditQualityRows = useMemo(
  () => computeCreditQualityMatrix(eclRowsMapped, lessees),
  [eclRowsMapped, lessees]
);
```

- [ ] **Step 5: Add "Close Period" button to the PageHeader**

Find the `<PageHeader` block with the existing "Auditor Evidence Pack" and "Export PDF + JSON" buttons. Add a third button after the "Export PDF + JSON" button but before `</PageHeader>`:

```tsx
<button
  onClick={() => setClosePeriodOpen(true)}
  style={{
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    background: "#F4F5F7",
    color: "#0F172A",
    border: "1px solid #E2E8F0",
    borderRadius: "9999px",
    padding: "0.625rem 1.25rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
  }}
>
  <Lock size={14} /> Close Period
</button>
```

- [ ] **Step 6: Fix the AuditorPackModal data prop**

Find the `<AuditorPackModal` block (around line 2180). Update the `data` prop:

```typescript
data={{
  scenarioInputs,
  weights,
  weighted,
  scenarioSummary,
  eclRows:          eclRowsMapped,
  sicrConfig,
  managementOverlay: "",
  currency,                    // was hardcoded "USD"
  rollForwardLines,
  creditQualityRows,
  periodLabel: `Live Preview — Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
}}
```

- [ ] **Step 7: Add ClosePeriodModal mount**

Find the `<RecoveryFactorDrawer` block near the bottom of the return JSX. Just before it, add:

```tsx
<ClosePeriodModal
  open={closePeriodOpen}
  onClose={() => setClosePeriodOpen(false)}
  onLocked={() => setClosePeriodOpen(false)}
  liveData={{
    periodLabel:    `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
    stage1Ecl:      sortedECL.filter(r => (stageOverrides[r.id] ?? r.stage) === "1").reduce((s, r) => s + r.eclLifetime, 0),
    stage2Ecl:      sortedECL.filter(r => (stageOverrides[r.id] ?? r.stage) === "2").reduce((s, r) => s + r.eclLifetime, 0),
    stage3Ecl:      sortedECL.filter(r => (stageOverrides[r.id] ?? r.stage) === "3").reduce((s, r) => s + r.eclLifetime, 0),
    totalEcl:       weighted.eclLifetime,
    ecl12m:         weighted.ecl12m,
    coveragePct:    weighted.coverage,
    scenarioInputs,
    weights,
    scenarioSummary,
    weighted,
    sicrConfig,
    eclRows:        eclRowsMapped,
    currency,
  }}
/>
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 9: Run full test suite**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/app/pages/RiskECL.tsx
git commit -m "feat: wire Close Period button, roll-forward and credit quality into RiskECL"
```

---

### Task 8: Settings — ECL Snapshots tab

**Files:**
- Modify: `src/app/pages/Settings.tsx`

- [ ] **Step 1: Add imports**

Open `src/app/pages/Settings.tsx`. Add to the existing imports:

```typescript
import { useEclSnapshots, type EclSnapshot } from "../hooks/useEclSnapshots";
import { AuditorPackModal } from "../components/risk-ecl/AuditorPackModal";
import { computeRollForward } from "../utils/eclRollForward";
import { computeCreditQualityMatrix } from "../utils/creditQualityMatrix";
import { useMemo, useState } from "react";
```

Note: `useState` is already imported — only add `useMemo` if not already there. Check the existing `import { useState, useEffect, useRef }` line and add `useMemo` to it.

Also add `History` to the existing lucide import: find the line starting `import { Building2, ...` and add `History` to the list.

- [ ] **Step 2: Add the ECL Snapshots tab to the tabs array**

Find `const tabs = [` in `Settings.tsx`. Add a new entry after the `audit` entry:

```typescript
{ id: "ecl-snapshots", label: "ECL Snapshots", icon: History },
```

The full tabs array should be:
```typescript
const tabs = [
  { id: "tenant",        label: "Tenant",          icon: Building2      },
  { id: "users",         label: "Users & RBAC",    icon: Users          },
  { id: "datasources",   label: "Data Sources",    icon: Database       },
  { id: "model",         label: "Model Params",    icon: Sliders        },
  { id: "audit",         label: "Audit Log",       icon: ClipboardList  },
  { id: "ecl-snapshots", label: "ECL Snapshots",   icon: History        },
  { id: "alerts",        label: "Alerts",          icon: Bell           },
  { id: "excel",         label: "Excel Add-in",    icon: FileSpreadsheet },
];
```

- [ ] **Step 3: Add hook calls and state inside the Settings component**

Find the line `const { entries: auditEntries, isLoading: auditLoading } = useAssumptionLog();` inside the `Settings` component. Add below it:

```typescript
const { snapshots, isLoading: snapshotsLoading } = useEclSnapshots();
const [redownloadSnapshot, setRedownloadSnapshot] = useState<EclSnapshot | null>(null);

const redownloadData = useMemo(() => {
  if (!redownloadSnapshot) return null;
  const idx     = snapshots.findIndex(s => s.id === redownloadSnapshot.id);
  const prevSnap = snapshots[idx + 1] ?? null;
  return {
    scenarioInputs:   redownloadSnapshot.scenarioInputs,
    weights:          redownloadSnapshot.weights,
    weighted:         redownloadSnapshot.weighted,
    scenarioSummary:  redownloadSnapshot.scenarioSummary,
    eclRows:          redownloadSnapshot.eclRows,
    sicrConfig:       redownloadSnapshot.sicrConfig,
    managementOverlay: "",
    currency:         redownloadSnapshot.currency as import("../contexts/CurrencyContext").CurrencyCode,
    rollForwardLines: prevSnap ? computeRollForward(prevSnap.eclRows, redownloadSnapshot.eclRows) : null,
    creditQualityRows: computeCreditQualityMatrix(redownloadSnapshot.eclRows, []),
    periodLabel:      redownloadSnapshot.periodLabel,
  };
}, [redownloadSnapshot, snapshots]);
```

- [ ] **Step 4: Add the ECL Snapshots tab render**

Find the block `{activeTab === "audit" && (` and after its closing `)}`, add the new tab content:

```tsx
{/* ECL Snapshots */}
{activeTab === "ecl-snapshots" && (
  <Card title="ECL Period Snapshots" subtitle="Locked reporting periods — re-download Auditor Evidence Pack for any period" noPadding>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
      <thead>
        <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
          {["Period", "Locked", "By", "Total ECL", "Stage 1", "Stage 2", "Stage 3", "Coverage", ""].map(h => (
            <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {snapshotsLoading && Array.from({ length: 3 }).map((_, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
            <td colSpan={9} style={{ padding: "0.75rem 1rem" }}>
              <div style={{ height: "1rem", background: "#E2E8F0", borderRadius: "0.25rem", width: `${40 + i * 15}%` }} />
            </td>
          </tr>
        ))}
        {!snapshotsLoading && snapshots.length === 0 && (
          <tr>
            <td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
              No periods locked yet. Close a period from the Risk ECL page to create your first snapshot.
            </td>
          </tr>
        )}
        {!snapshotsLoading && snapshots.map((snap, i) => (
          <tr key={snap.id} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
            <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{snap.periodLabel}</td>
            <td style={{ padding: "0.75rem 1rem", color: "#475569", whiteSpace: "nowrap" }}>
              {new Date(snap.lockedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </td>
            <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{snap.lockedBy}</td>
            <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>${snap.totalEcl.toFixed(1)}M</td>
            <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>${snap.stage1Ecl.toFixed(1)}M</td>
            <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>${snap.stage2Ecl.toFixed(1)}M</td>
            <td style={{ padding: "0.75rem 1rem", color: "#B91C1C" }}>${snap.stage3Ecl.toFixed(1)}M</td>
            <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{snap.coveragePct.toFixed(2)}%</td>
            <td style={{ padding: "0.75rem 1rem" }}>
              <button
                onClick={() => setRedownloadSnapshot(snap)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.25rem",
                  fontSize: "0.75rem", fontWeight: 500,
                  color: "#002147", background: "transparent",
                  border: "1px solid #E2E8F0", borderRadius: "9999px",
                  padding: "0.3rem 0.75rem", cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <Download size={11} /> Re-download
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
)}
```

- [ ] **Step 5: Mount the AuditorPackModal at the bottom of Settings**

Find the closing `</div>` at the very end of the Settings component's return. Just before it, add:

```tsx
{redownloadData && (
  <AuditorPackModal
    open={!!redownloadSnapshot}
    onClose={() => setRedownloadSnapshot(null)}
    data={redownloadData}
  />
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/Settings.tsx
git commit -m "feat: add ECL Snapshots tab to Settings with re-download per period"
```

---

### Task 9: Reports.tsx — wire RPT-001 to AuditorPackModal

**Files:**
- Modify: `src/app/pages/Reports.tsx`

- [ ] **Step 1: Add imports**

Open `src/app/pages/Reports.tsx`. Add after existing imports:

```typescript
import { useEclSnapshots } from "../hooks/useEclSnapshots";
import { AuditorPackModal } from "../components/risk-ecl/AuditorPackModal";
import { computeRollForward } from "../utils/eclRollForward";
import { computeCreditQualityMatrix } from "../utils/creditQualityMatrix";
import { useMemo } from "react";
```

Note: check the existing `import * as React from "react"` and `import { useState, useEffect }` — add `useMemo` to the destructured React import if it exists, or use the namespace import.

- [ ] **Step 2: Add hook calls and derived data inside the Reports component**

Inside the `Reports` function, after the existing `useState` calls, add:

```typescript
const { snapshots } = useEclSnapshots();
const [auditorPackOpen, setAuditorPackOpen] = useState(false);

const reportsAuditorData = useMemo(() => {
  if (snapshots.length === 0) return null;
  const latest = snapshots[0];
  const prev   = snapshots[1] ?? null;
  return {
    scenarioInputs:    latest.scenarioInputs,
    weights:           latest.weights,
    weighted:          latest.weighted,
    scenarioSummary:   latest.scenarioSummary,
    eclRows:           latest.eclRows,
    sicrConfig:        latest.sicrConfig,
    managementOverlay: "",
    currency:          latest.currency as import("../contexts/CurrencyContext").CurrencyCode,
    rollForwardLines:  prev ? computeRollForward(prev.eclRows, latest.eclRows) : null,
    creditQualityRows: computeCreditQualityMatrix(latest.eclRows, []),
    periodLabel:       latest.periodLabel,
  };
}, [snapshots]);
```

- [ ] **Step 3: Replace RPT-001 "Generate" button onClick handler**

Find the `onClick` handler on the "Generate" button inside the `filtered.map(...)` block. It currently reads:

```typescript
onClick={() => {
  if (report.id === "RPT-002") {
    setBoardPackModal({ id: report.id, name: report.name });
  } else {
    setFormatModal({ id: report.id, name: report.name });
  }
}}
```

Replace with:

```typescript
onClick={() => {
  if (report.id === "RPT-001") {
    if (snapshots.length > 0) setAuditorPackOpen(true);
    // if no snapshots, button is visually disabled (see Step 4)
  } else if (report.id === "RPT-002") {
    setBoardPackModal({ id: report.id, name: report.name });
  } else {
    setFormatModal({ id: report.id, name: report.name });
  }
}}
```

Also disable the button when `report.id === "RPT-001" && snapshots.length === 0`. Find the `style` prop on that button and add:

```typescript
opacity: report.id === "RPT-001" && snapshots.length === 0 ? 0.5 : 1,
cursor:  report.id === "RPT-001" && snapshots.length === 0 ? "not-allowed" : "pointer",
```

- [ ] **Step 4: Add "no snapshot" notice below RPT-001 card**

After the card `</motion.div>` inside `filtered.map(...)`, conditionally render a notice when the current report is RPT-001 and there are no snapshots. Add inside the card body, after the description paragraph and before the formats row:

```tsx
{report.id === "RPT-001" && snapshots.length === 0 && (
  <p style={{ fontSize: "0.75rem", color: "#B45309", background: "#FEF3C7", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", margin: "0 0 0.5rem" }}>
    No periods locked. Close a period from Risk ECL to generate this report.
  </p>
)}
```

- [ ] **Step 5: Mount AuditorPackModal at bottom of Reports**

Before the closing `</div>` at the end of the Reports component's return, add:

```tsx
{reportsAuditorData && (
  <AuditorPackModal
    open={auditorPackOpen}
    onClose={() => setAuditorPackOpen(false)}
    data={reportsAuditorData}
  />
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npx vitest run 2>&1 | tail -5
```

Expected: all tests PASS — existing count unchanged, 7 new tests added.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/Reports.tsx
git commit -m "feat: wire Reports RPT-001 to AuditorPackModal via latest ECL snapshot"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `006_ecl_period_snapshots.sql` migration | Task 1 |
| `eclRollForward` utility + 4 tests | Task 2 |
| `creditQualityMatrix` utility + 3 tests | Task 3 |
| `useEclSnapshots` hook with `lockPeriod` | Task 4 |
| `AuditorPackData` extended with 3 fields | Task 5 |
| §5 live roll-forward in modal + DOCX | Task 5 |
| §6 live credit quality in modal + DOCX | Task 5 |
| Dynamic `periodLabel` in modal header | Task 5 |
| `ClosePeriodModal` component | Task 6 |
| `Close Period` button in RiskECL header | Task 7 |
| Currency fix (`useCurrency`) | Task 7 |
| `rollForwardLines` + `creditQualityRows` in RiskECL | Task 7 |
| Settings ECL Snapshots tab | Task 8 |
| Re-download AuditorPackModal from Settings | Task 8 |
| Reports RPT-001 routes to AuditorPackModal | Task 9 |
| "No snapshots" notice in Reports | Task 9 |

All 16 requirements covered.

**Type consistency check:**
- `EclRow` defined once in `eclRollForward.ts`, imported everywhere else — consistent.
- `LockPeriodPayload = Omit<EclSnapshot, "id" | "lockedAt" | "lockedBy">` — used in `ClosePeriodModal` props and `useEclSnapshots.lockPeriod` signature — consistent.
- `rollForwardLines: RollForwardLine[] | null` — matches null check in modal and DOCX generator — consistent.
- `creditQualityRows: CreditQualityRow[]` — never null, always at least `[]` — consistent.
- `stageOverrides[r.id] ?? r.stage` cast to `"1" | "2" | "3"` — required by `EclRow.stage` type — consistent.

**Placeholder scan:** No TBDs, no "implement later", no vague steps. All code blocks complete.
