# ECL Audit Reports — Design Spec

**Date:** 2026-05-18
**Status:** Approved

---

## Goal

Replace the two hardcoded sections in the IFRS 9 Auditor Evidence Pack (§5 Roll-Forward, §6 Credit Quality) with live computed data, add an explicit "Close Period" mechanism that stores ECL snapshots for re-download and roll-forward computation, surface a snapshot log in Settings, and fix the Reports.tsx wiring so RPT-001 uses real data.

---

## Background

`AuditorPackModal` already exists — 8 sections, PDF + DOCX download, wired into RiskECL. Real data flows through §1–§4, §7–§8 via `AuditorPackData`. The gaps:

- **§5 Roll-Forward** (IFRS 7 §35H): 100% hardcoded static numbers
- **§6 Credit Quality** (IFRS 7 §35I): 100% hardcoded static numbers
- **Reports.tsx RPT-001**: "Generate" opens `ReportFormatModal` — not the `AuditorPackModal`
- **Currency**: hardcoded `"USD"` in `RiskECL.tsx` data prop
- **Period label**: hardcoded `"Q1 2026"` in modal header

No existing `ecl_period_snapshots` table or period tracking of any kind.

---

## Architecture

| File | Action |
|------|--------|
| `supabase/migrations/006_ecl_period_snapshots.sql` | **Create** — append-only snapshot table |
| `src/app/utils/eclRollForward.ts` | **Create** — diff utility for §5 movement lines |
| `src/app/utils/creditQualityMatrix.ts` | **Create** — §6 rating × stage × EAD matrix |
| `src/app/hooks/useEclSnapshots.ts` | **Create** — read/write hook |
| `src/app/components/risk-ecl/ClosePeriodModal.tsx` | **Create** — period lock modal |
| `src/app/pages/RiskECL.tsx` | **Modify** — Close Period button, snapshot wiring, currency fix |
| `src/app/services/reportGenerators.ts` | **Modify** — replace hardcoded §5/§6 with live data |
| `src/app/components/risk-ecl/AuditorPackModal.tsx` | **Modify** — accept computed §5/§6 data, dynamic period label |
| `src/app/pages/Settings.tsx` | **Modify** — new ECL Snapshots tab |
| `src/app/pages/Reports.tsx` | **Modify** — RPT-001 routes to AuditorPackModal via latest snapshot |

---

## Unit 1: Database Migration

**File:** `supabase/migrations/006_ecl_period_snapshots.sql`

```sql
create table if not exists ecl_period_snapshots (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  period_label     text not null,           -- e.g. "Q1 2026"
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

`ecl_rows` stores the full lease-level ECL array at close:
`[{ id, lessee, aircraft, ead, pd12m, lgd, ecl12m, eclLT, stage }]`

Append-only by convention. No updates or deletes.

---

## Unit 2: eclRollForward utility

**File:** `src/app/utils/eclRollForward.ts`

```typescript
export interface EclRow {
  id:       string;
  lessee:   string;
  aircraft: string;
  ead:      number;
  pd12m:    number;
  lgd:      number;
  ecl12m:   number;
  eclLT:    number;
  stage:    string;  // "1" | "2" | "3"
}

export interface RollForwardLine {
  label:  string;
  stage1: number;   // $ millions
  stage2: number;
  stage3: number;
  total:  number;
}

export function computeRollForward(
  previousRows: EclRow[],
  currentRows:  EclRow[],
): RollForwardLine[]
```

**Computation steps:**

1. **Opening ECL** — sum `eclLT` from `previousRows` grouped by `stage`
2. **New originations** — leases in `currentRows` whose `id` is absent from `previousRows`; `eclLT` allocated to Stage 1 (new leases always start Stage 1)
3. **SICR transfers S1 → S2** — leases present in both where previous `stage === "1"` and current `stage === "2"`; value = `currentEclLT - previousEclLT`; negative in Stage 1 column, positive in Stage 2
4. **SICR transfers S2 → S3** — same pattern for `"2"` → `"3"`
5. **Derecognition / repayments** — leases in `previousRows` absent from `currentRows`; negative values, split by their previous stage
6. **Model / FX / other** — per-stage balancing item: `closing[s] - opening[s] - sum(lines 2–5)[s]`; always makes the table reconcile
7. **Closing ECL** — sum `eclLT` from `currentRows` grouped by `stage`

Returns all 7 lines. Total column = Stage 1 + Stage 2 + Stage 3.

Pure function — no side effects, no imports beyond TypeScript types. Exported and unit-tested.

---

## Unit 3: creditQualityMatrix utility

**File:** `src/app/utils/creditQualityMatrix.ts`

```typescript
export interface CreditQualityRow {
  grade:        string;
  s1Ead:        number;
  s2Ead:        number;
  s3Ead:        number;
  totalEad:     number;
  pctPortfolio: number;
}

export function computeCreditQualityMatrix(
  eclRows: EclRow[],
  lessees: Array<{ name: string; credit_rating: string | null }>,
): CreditQualityRow[]
```

**Grade buckets** (in display order):

| Bucket label | Ratings matched (case-insensitive prefix) |
|---|---|
| `"A / A−"` | A, A+, A- |
| `"BBB"` | BBB, BBB+, BBB- |
| `"BB / BB−"` | BB, BB+, BB- |
| `"B+"` | B+ |
| `"B / B−"` | B, B- |
| `"CCC and below"` | CCC, CC, C, D |
| `"Unrated"` | null, "—", or no match |

**Logic:**
1. Build a lookup map: `lesseeNameLower → credit_rating` from `lessees`
2. For each `eclRow`, find rating from lookup (match on `row.lessee.toLowerCase()`)
3. Bucket rating into grade band
4. Sum `row.ead` into `s1Ead`, `s2Ead`, or `s3Ead` based on `row.stage`
5. Compute `totalEad = s1 + s2 + s3` and `pctPortfolio = totalEad / portfolioTotalEad * 100`
6. Return rows sorted by grade band order above; omit rows where `totalEad === 0`

Pure function. Returns `CreditQualityRow[]`.

---

## Unit 4: useEclSnapshots hook

**File:** `src/app/hooks/useEclSnapshots.ts`

```typescript
export interface EclSnapshot {
  id:              string;
  periodLabel:     string;
  lockedAt:        string;     // ISO timestamp
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

interface ScenarioSummaryEntry { ecl12m: number; eclLifetime: number; coverage: number }

export interface SicrConfig {
  dpdEnabled:              boolean;
  dpdDays:                 number;
  upgradeEnabled:          boolean;
  upgradeNotches:          number;
  countryWatchlistEnabled: boolean;
  insolvencyEnabled:       boolean;
}

interface Result {
  snapshots:  EclSnapshot[];
  isLoading:  boolean;
  lockPeriod: (payload: Omit<EclSnapshot, 'id' | 'lockedAt'>) => Promise<void>;
}

export function useEclSnapshots(): Result
```

- Fetches 20 most recent snapshots for `orgId` (`.eq("org_id", orgId).order("locked_at", { ascending: false }).limit(20)`)
- Returns early with `isLoading: false` if `!orgId`
- `lockPeriod` does a single `.insert()` (append-only, never upsert), then re-fetches to update state
- `locked_by`: `(await supabase.auth.getUser()).data.user?.email ?? "unknown"`
- Cancelled-flag pattern for cleanup (same as `useAssumptionLog`)

---

## Unit 5: ClosePeriodModal component

**File:** `src/app/components/risk-ecl/ClosePeriodModal.tsx`

**Props:**
```typescript
interface ClosePeriodModalProps {
  open:          boolean;
  onClose:       () => void;
  onLocked:      () => void;   // called after successful lock
  liveData:      ClosePeriodPayload;
}

interface ClosePeriodPayload {
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
```

**Behaviour:**
- Calls `useEclSnapshots()` internally to get `lockPeriod` — the modal is a hook consumer, not a pure display component
- Period label `<input>`, pre-filled with current quarter computed from today: `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`
- Summary strip (read-only): Total ECL · Stage 1/2/3 · Coverage — from `liveData`
- Confirm button disabled if `periodLabel.trim() === ""` or `liveData.eclRows.length === 0`
- On confirm: calls `lockPeriod({ periodLabel, lockedBy: currentUser, ...liveData })`, shows inline success message ("Period locked ✓"), then calls `onClose` + `onLocked` after 1 second
- Escape key closes modal
- Framer Motion entrance/exit animation (same pattern as `AuditorPackModal`)

---

## Unit 6: AuditorPackData extension + AuditorPackModal modifications

**File:** `src/app/services/reportGenerators.ts` — `AuditorPackData` interface:

Add two fields:
```typescript
rollForwardLines:  RollForwardLine[] | null;  // null = no prior snapshot (first period)
creditQualityRows: CreditQualityRow[];
periodLabel:       string;                    // "Q1 2026" or "Live Preview — Q2 2026"
```

**`AuditorPackModal.tsx` — §5 change:**

Replace the hardcoded `PreviewTable` rows in §5 with:
```tsx
{data.rollForwardLines === null ? (
  <p style={{ color: "#94A3B8", fontSize: "0.875rem" }}>
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

**§6 change:** Replace hardcoded rows with:
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

**Header period label:** Replace hardcoded `"Q1 2026"` with `data.periodLabel`.

**`reportGenerators.ts` RPT-001 DOCX** — same replacement for §5 and §6 in the DOCX generator, using `auditData.rollForwardLines` and `auditData.creditQualityRows`. When `rollForwardLines === null`, write single row: `["Opening period — no prior snapshot", "—", "—", "—", "—"]`.

---

## Unit 7: RiskECL.tsx modifications

Four additions:

**Imports:**
```typescript
import { ClosePeriodModal } from "../components/risk-ecl/ClosePeriodModal";
import { useEclSnapshots } from "../hooks/useEclSnapshots";
import { computeRollForward } from "../utils/eclRollForward";
import { computeCreditQualityMatrix } from "../utils/creditQualityMatrix";
import { useCurrency } from "../contexts/CurrencyContext";
```

**Hook calls** (after existing hooks):
```typescript
const { currency } = useCurrency();
const { snapshots, lockPeriod } = useEclSnapshots();
const [closePeriodOpen, setClosePeriodOpen] = useState(false);
```

**Derived values** (after `sortedECL` is defined):
```typescript
const rollForwardLines = useMemo(() => {
  const prev = snapshots[0] ?? null;
  if (!prev) return null;
  return computeRollForward(prev.eclRows, sortedECL.map(r => ({
    id: r.id, lessee: r.lessee, aircraft: r.aircraft,
    ead: r.eadNum, pd12m: r.pd12m, lgd: r.lgd,
    ecl12m: r.ecl12m, eclLT: r.eclLifetime,
    stage: stageOverrides[r.id] ?? r.stage,
  })));
}, [snapshots, sortedECL, stageOverrides]);

const creditQualityRows = useMemo(
  () => computeCreditQualityMatrix(
    sortedECL.map(r => ({
      id: r.id, lessee: r.lessee, aircraft: r.aircraft,
      ead: r.eadNum, pd12m: r.pd12m, lgd: r.lgd,
      ecl12m: r.ecl12m, eclLT: r.eclLifetime,
      stage: stageOverrides[r.id] ?? r.stage,
    })),
    lessees,
  ),
  [sortedECL, lessees, stageOverrides]
);
```

**"Close Period" button** — placed alongside the existing "Generate Auditor Pack" button in the RiskECL header area:
```tsx
<button onClick={() => setClosePeriodOpen(true)} style={{ /* same styling pattern as existing header buttons */ }}>
  Close Period
</button>
```

**AuditorPackModal data prop** — add the three new fields + fix currency:
```typescript
data={{
  // ...existing fields...
  currency,                  // was hardcoded "USD"
  rollForwardLines,
  creditQualityRows,
  periodLabel: `Live Preview — Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
}}
```

**ClosePeriodModal** — mount at the bottom of the page:
```tsx
<ClosePeriodModal
  open={closePeriodOpen}
  onClose={() => setClosePeriodOpen(false)}
  onLocked={() => setClosePeriodOpen(false)}
  liveData={{
    stage1Ecl:  sortedECL.filter(r => (stageOverrides[r.id] ?? r.stage) === "1").reduce((s, r) => s + r.eclLifetime, 0),
    stage2Ecl:  sortedECL.filter(r => (stageOverrides[r.id] ?? r.stage) === "2").reduce((s, r) => s + r.eclLifetime, 0),
    stage3Ecl:  sortedECL.filter(r => (stageOverrides[r.id] ?? r.stage) === "3").reduce((s, r) => s + r.eclLifetime, 0),
    totalEcl:   weighted.eclLifetime,
    ecl12m:     weighted.ecl12m,
    coveragePct: weighted.coverage,
    scenarioInputs,
    weights,
    scenarioSummary,
    weighted,
    sicrConfig,
    eclRows:    sortedECL.map(r => ({
      id: r.id, lessee: r.lessee, aircraft: r.aircraft,
      ead: r.eadNum, pd12m: r.pd12m, lgd: r.lgd,
      ecl12m: r.ecl12m, eclLT: r.eclLifetime,
      stage: stageOverrides[r.id] ?? r.stage,
    })),
    currency,
  }}
/>
```

---

## Unit 8: Settings.tsx — ECL Snapshots tab

Add `"ECL Snapshots"` to the existing tabs array (alongside `"Audit Log"`, `"General"`, etc.).

**Imports:**
```typescript
import { useEclSnapshots, type EclSnapshot } from "../hooks/useEclSnapshots";
import { AuditorPackModal } from "../components/risk-ecl/AuditorPackModal";
import { computeRollForward } from "../utils/eclRollForward";
import { computeCreditQualityMatrix } from "../utils/creditQualityMatrix";
```

**Hook call:**
```typescript
const { snapshots, isLoading: snapshotsLoading } = useEclSnapshots();
const [redownloadSnapshot, setRedownloadSnapshot] = useState<EclSnapshot | null>(null);
```

**Re-download AuditorPackData construction** (when `redownloadSnapshot` is set):
```typescript
const redownloadData = useMemo(() => {
  if (!redownloadSnapshot) return null;
  const idx = snapshots.findIndex(s => s.id === redownloadSnapshot.id);
  const prevSnapshot = snapshots[idx + 1] ?? null;
  const rollForwardLines = prevSnapshot
    ? computeRollForward(prevSnapshot.eclRows, redownloadSnapshot.eclRows)
    : null;
  const creditQualityRows = computeCreditQualityMatrix(redownloadSnapshot.eclRows, []);
  return {
    ...redownloadSnapshot,
    rollForwardLines,
    creditQualityRows,
    periodLabel: redownloadSnapshot.periodLabel,
    managementOverlay: "",
  };
}, [redownloadSnapshot, snapshots]);
```

Note: `computeCreditQualityMatrix` receives `[]` for lessees when called from Settings (no portfolio context available). Ratings were baked into the snapshot `ecl_rows` for future use, but credit quality will show "Unrated" for all leases if re-downloaded from Settings. This is acceptable for V1 — the primary download path is from RiskECL where lessees are in scope.

**Tab render** — table with columns: Period · Locked · By · Total ECL · Stage 1 / Stage 2 / Stage 3 · Coverage · Action

- Loading: 3 skeleton rows
- Empty: "No periods locked yet. Close a period from the Risk ECL page to create your first snapshot."
- Re-download button per row: sets `redownloadSnapshot`, opens `AuditorPackModal`

**AuditorPackModal** mounted at bottom of Settings:
```tsx
{redownloadData && (
  <AuditorPackModal
    open={!!redownloadSnapshot}
    onClose={() => setRedownloadSnapshot(null)}
    data={redownloadData}
  />
)}
```

---

## Unit 9: Reports.tsx — RPT-001 fix

**Imports:**
```typescript
import { useEclSnapshots } from "../hooks/useEclSnapshots";
import { AuditorPackModal } from "../components/risk-ecl/AuditorPackModal";
import { computeRollForward } from "../utils/eclRollForward";
import { computeCreditQualityMatrix } from "../utils/creditQualityMatrix";
```

**Hook call:**
```typescript
const { snapshots } = useEclSnapshots();
const [auditorPackOpen, setAuditorPackOpen] = useState(false);
```

**RPT-001 "Generate" button** — replace `setFormatModal` call:
```tsx
onClick={() => {
  if (report.id === "RPT-001") {
    if (snapshots.length === 0) {
      // show inline notice — no snapshot yet
    } else {
      setAuditorPackOpen(true);
    }
  } else if (report.id === "RPT-002") {
    setBoardPackModal({ id: report.id, name: report.name });
  } else {
    setFormatModal({ id: report.id, name: report.name });
  }
}}
```

When `snapshots.length === 0`: render a small amber notice below the RPT-001 card — "No periods locked. Close a period from Risk ECL to generate this report."

**AuditorPackData for Reports.tsx** (latest snapshot):
```typescript
const reportsAuditorData = useMemo(() => {
  if (snapshots.length === 0) return null;
  const latest = snapshots[0];
  const prev   = snapshots[1] ?? null;
  return {
    ...latest,
    rollForwardLines:  prev ? computeRollForward(prev.eclRows, latest.eclRows) : null,
    creditQualityRows: computeCreditQualityMatrix(latest.eclRows, []),
    periodLabel:       latest.periodLabel,
    managementOverlay: "",
  };
}, [snapshots]);
```

Mount `AuditorPackModal` at the bottom of Reports.tsx, passing `reportsAuditorData`.

---

## Data Flow

```
User clicks "Close Period" on RiskECL
        ↓
ClosePeriodModal — confirms period label + shows ECL summary
        ↓
useEclSnapshots.lockPeriod()
        ↓
supabase.insert(ecl_period_snapshots) — full state stored
        ↓
Settings → ECL Snapshots tab
        ↓
Re-download button → AuditorPackModal with stored data
        ↓
§5 = computeRollForward(prev.eclRows, this.eclRows)
§6 = computeCreditQualityMatrix(this.eclRows, [])
```

---

## Testing

**`src/app/utils/eclRollForward.test.ts`** — four tests:
1. New origination correctly allocated to Stage 1
2. SICR transfer S1→S2: negative Stage 1 delta, positive Stage 2 delta
3. Derecognition: negative in correct stage column
4. Model/FX balancing line: table always foots (opening + movements = closing)

**`src/app/utils/creditQualityMatrix.test.ts`** — three tests:
1. Rating buckets correctly (BBB- → "BBB" bucket, BB+ → "BB / BB−")
2. EAD split correctly by stage
3. Unrated lessees go to "Unrated" row

Existing 414 tests must remain green.

---

## What is NOT in scope

- Write-off event tracking (write-offs are absorbed into the "Model / FX / other" balancing line)
- Credit quality re-download from Settings uses live lessees rating lookup (shown as "Unrated" without portfolio context — acceptable V1)
- Period comparison view (comparing two snapshots side-by-side)
- Snapshot deletion or period re-opening
- Email delivery of locked packs
