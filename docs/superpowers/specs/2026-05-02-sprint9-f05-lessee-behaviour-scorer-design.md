# Sprint 9 F05 — Lessee Behaviour Scorer Design

## Goal

Add a `"Behaviour"` tab to `LesseeProfilePanel.tsx` that provides full explainability of each sub-score with itemised evidence, 12-month sparklines, consistent "Observed Contractual Performance Indicator" framing, and an audited manual override mechanism.

---

## Background

The Counterparties page already shows a behavior score radar chart and 4 horizontal score bars in the Overview tab. This gives the number but not the evidence trail. Analysts reviewing a Stage 3 lessee need to be able to show an auditor exactly which contractual events drove each sub-score, how those scores have moved over time, and — when judgment overrides a model output — who approved the change, when, and why.

**Target audience:** Portfolio managers evidencing IFRS 9 subjective-judgment overrides; credit analysts building lessee risk memos; compliance officers reviewing model governance.

---

## Architecture

### File changes

| Action | Path | Change |
|--------|------|--------|
| **Modify** | `src/app/components/counterparties/LesseeProfilePanel.tsx` | Add types, data fields, `BehaviourTab` component, wire 6th tab |

No new files. All data stays co-located with the existing `PROFILE_DATA` structure. File will grow from ~835 → ~1350 lines — still within the established cohesion pattern.

---

## New Types

```ts
type SubScoreKey = "punctuality" | "restructuringCoop" | "govtInterference" | "litigationPropensity";

interface EvidenceEvent {
  date: string;         // YYYY-MM-DD
  event: string;        // observed event label, e.g. "Late payment — 47 DPD"
  outcome: string;      // contractual consequence, e.g. "SICR trigger § B5.5.17 met"
  weight: number;       // score contribution, signed integer; positive = score-improving
}

interface BehaviourEvidence {
  punctuality: EvidenceEvent[];
  restructuringCoop: EvidenceEvent[];
  govtInterference: EvidenceEvent[];
  litigationPropensity: EvidenceEvent[];
}

interface ScoreHistoryPoint {
  month: string;        // "May '25" … "Apr '26"
  punctuality: number;
  restructuringCoop: number;
  govtInterference: number;  // raw score (higher = higher risk)
  litigationPropensity: number; // raw score (higher = higher propensity)
}

interface OverrideEntry {
  id: string;
  timestamp: string;    // ISO string
  user: string;
  subScore: string;     // human-readable label
  oldValue: number;
  newValue: number;
  reason: string;
}
```

---

## Updated `LesseeProfile` Interface

Add two fields to the existing interface:

```ts
interface LesseeProfile {
  // ...existing fields...
  behaviourEvidence: BehaviourEvidence;
  scoreHistory: ScoreHistoryPoint[];   // 12 entries, May '25 → Apr '26
}
```

---

## Synthetic Data

### Score history narrative
- **IndiGo (INDIGO):** All four scores deteriorating. Punctuality drops from 62 → 28 over 12 months as DPD worsens.
- **Aeromexico (AEROMEX):** Most distressed. Punctuality: 55 → 18. Restructuring coop collapses after Chapter 11 filing.
- **SriLankan (SRILNKN):** Government interference creeping up. Litigation propensity already elevated from prior disputes.
- **Azul (AZUL):** Stable-to-mild deterioration. Punctuality holds at ~70 until Jan 2026 DPD event pulls it to 68.
- **Air Transat (TRANSATCA):** Stable. Restructuring coop improving as discussions progress constructively.
- **Emirates (EMIRATES):** All scores stable at 90+. Minor govt-interference uptick in Apr '26 due to UAE fiscal policy change, still low risk.

### Evidence events (3–5 per sub-score per lessee)
Each evidence event reflects a real contractual moment:
- Punctuality: on-time payments (+weight), late payments (−weight), missed payments (−weight)
- Restructuring Coop: constructive engagement (+), non-response (−), good-faith deferral acceptance (+)
- Govt Interference: court-ordered stay (−), nationalisation risk event (−), stable sovereign record (+)
- Litigation Propensity: prior litigation (−), arbitration waiver (+), no legal action on record (+)

---

## `BehaviourTab` Component

### Props
```ts
function BehaviourTab({ meta, behaviourEvidence, scoreHistory }: {
  meta: LesseeMeta;
  behaviourEvidence: BehaviourEvidence;
  scoreHistory: ScoreHistoryPoint[];
})
```

### Layout (top → bottom)

**1. OCPI Header Banner**
- Thin dark blue (`#002147`) banner: `"Observed Contractual Performance Indicator (OCPI) — IFRS 9 §B5.5.17 compliance scoring framework"`
- Sub-line: `"All scores derived exclusively from observable contractual events. Cultural, national, or subjective proxies are excluded."`

**2. 12-Month Sparkline Grid (2×2)**
- Four cards in a 2-column grid
- Each card title: `"OCPI — [Sub-Score Name]"`
- Each card: small `AreaChart` (height 80px, no axes, just area fill) showing 12-month trend
- Current score shown as a badge top-right of each card
- Colour: score ≥ 70 green, 50–69 amber, < 50 red (using existing colour constants)
- For `govtInterference` and `litigationPropensity`, displayed score = `100 − raw` (lower risk = higher display score), chart inverts accordingly

**3. Evidence Table Accordion (4 sections)**
- Section label: `"OCPI — [Sub-Score Name]"` with current score badge
- Each section is a collapsible (chevron toggle)
- Table columns: `Date | Event | Observed Outcome | Weight`
- Weight column: `+15` in green, `−12` in red, styled with `fontVariantNumeric: "tabular-nums"`
- Row hover: `#FAFAFA` background
- Default: first section open, remaining collapsed

**4. Manual Override Panel**
Card title: `"Score Override — Governance & Audit Log"`
- Override form (top):
  - Sub-score selector (4 options)
  - New value input (0–100 number field)
  - Reason textarea
  - "Submit Override" button (Oxford Blue)
  - User hardcoded as `"analyst@aeroinsights.com"` (simulated)
- Audit log table (below form):
  - Columns: `Timestamp | User | Sub-Score | Old → New | Reason`
  - Pre-populated with zero entries initially; grows as overrides are submitted
  - Override values reflected in the sparkline grid (active override replaces the current score display)

---

## Label Enforcement Rules

| Location | Required label |
|----------|---------------|
| Tab name | `"Behaviour"` |
| Card titles for sparklines | `"OCPI — Payment Punctuality"` etc. |
| Accordion section headers | `"OCPI — Restructuring Cooperation"` etc. |
| Override card | `"Score Override — Governance & Audit Log"` |
| Banner subtitle | must not use cultural, national, or organisational proxies |

The existing score bar labels in the **Overview tab** already read correctly (`"Payment Punctuality"`, `"Restructuring Cooperation"` etc.) — no changes required to Overview.

---

## Tab Wiring

Current `TABS`: `["Overview", "Leases", "ECL", "Timeline", "Scenarios"]`
New `TABS`: `["Overview", "Leases", "ECL", "Timeline", "Scenarios", "Behaviour"]`

```tsx
{activeTab === "Behaviour" && (
  <BehaviourTab
    meta={meta}
    behaviourEvidence={behaviourEvidence}
    scoreHistory={scoreHistory}
  />
)}
```

`useEffect` that resets `activeTab` to "Overview" on `lesseeId` change already handles the new tab correctly — no change needed.

---

## Success Criteria

1. `npm run build` zero errors
2. All 6 lessees have a "Behaviour" tab that renders without crashing
3. Sparklines show 12-month trend with correct colour coding
4. All 4 evidence accordions expand/collapse; evidence events render with signed weight colours
5. Submitting an override appends a row to the audit log and updates the active score badge
6. No evidence card or section uses cultural or nationality-based language — only contractual event labels
7. Emirates shows all-green OCPI scores; Aeromexico shows all-red

---

## Out of Scope

- Persisting overrides to backend / localStorage
- Real user authentication for override user field
- Exporting the audit log
- Changes to Overview tab score bars
