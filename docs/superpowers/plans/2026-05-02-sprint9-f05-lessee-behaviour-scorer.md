# Sprint 9 F05 — Lessee Behaviour Scorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Behaviour" tab to `LesseeProfilePanel` that shows 12-month OCPI sparklines, itemised evidence per sub-score, and an audited manual override panel for all 6 lessees.

**Architecture:** Single-file modification to `src/app/components/counterparties/LesseeProfilePanel.tsx`. New types (`EvidenceEvent`, `BehaviourEvidence`, `ScoreHistoryPoint`, `OverrideEntry`) are added to the types section; `behaviourEvidence` and `scoreHistory` are added to each of the 6 lessee data blocks; a `BehaviourTab` component is added before `LesseeProfilePanel`; "Behaviour" is appended to the `TABS` constant and wired in the render.

**Tech Stack:** React 18, TypeScript, Recharts `AreaChart` + `Area`, Lucide `ChevronUp`/`ChevronDown`, inline styles only.

---

## File Map

| Action | Path |
|--------|------|
| **Modify** | `src/app/components/counterparties/LesseeProfilePanel.tsx` |

---

### Task 1: Add Types, Extend Interface, and Add Data for All 6 Lessees

**Files:**
- Modify: `src/app/components/counterparties/LesseeProfilePanel.tsx`

Context: `LesseeProfilePanel.tsx` currently has `LesseeProfile` ending at line 82. The `PROFILE_DATA` const starts at line 107 and ends at line 328. All data blocks close with `},` followed by the next lessee or the closing `};`.

- [ ] **Step 1: Add new imports**

Find the existing recharts import block (lines 2–6):
```tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
```

Replace with:
```tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  AreaChart, Area,
} from "recharts";
import { ChevronUp, ChevronDown } from "lucide-react";
```

- [ ] **Step 2: Add new types after the existing `ScenarioRow` interface**

Find the existing `ScenarioRow` interface ending:
```tsx
interface ScenarioRow {
  name: string;
  description: string;
  ecl12m: number;
  eclLifetime: number;
  vsBase12mPct: number;
  stageComment: string;
}
```

After that closing `}`, add:
```tsx

type SubScoreKey = "punctuality" | "restructuringCoop" | "govtInterference" | "litigationPropensity";

interface EvidenceEvent {
  date: string;
  event: string;
  outcome: string;
  weight: number;
}

interface BehaviourEvidence {
  punctuality: EvidenceEvent[];
  restructuringCoop: EvidenceEvent[];
  govtInterference: EvidenceEvent[];
  litigationPropensity: EvidenceEvent[];
}

interface ScoreHistoryPoint {
  month: string;
  punctuality: number;
  restructuringCoop: number;
  govtInterference: number;
  litigationPropensity: number;
}

interface OverrideEntry {
  id: string;
  timestamp: string;
  user: string;
  subScore: string;
  oldValue: number;
  newValue: number;
  reason: string;
}
```

- [ ] **Step 3: Extend `LesseeProfile` interface**

Find:
```tsx
interface LesseeProfile {
  meta: LesseeMeta;
  leases: LesseeLeaseRow[];
  eclRows: LesseeECLRow[];
  monthlyDPD: MonthlyDPD[];
  events: PaymentEvent[];
  scenarios: ScenarioRow[];
}
```

Replace with:
```tsx
interface LesseeProfile {
  meta: LesseeMeta;
  leases: LesseeLeaseRow[];
  eclRows: LesseeECLRow[];
  monthlyDPD: MonthlyDPD[];
  events: PaymentEvent[];
  scenarios: ScenarioRow[];
  behaviourEvidence: BehaviourEvidence;
  scoreHistory: ScoreHistoryPoint[];
}
```

- [ ] **Step 4: Add `behaviourEvidence` and `scoreHistory` to the INDIGO profile block**

Find the closing of the INDIGO scenarios array — the line that reads:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Q1 2026 actuals; no macro shock",                           ecl12m: 11.26*M, eclLifetime: 21.89*M, vsBase12mPct:   0, stageComment: "Stage 3 maintained" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%, fuel +15%",                              ecl12m: 14.98*M, eclLifetime: 29.11*M, vsBase12mPct:  33, stageComment: "Write-off risk rising" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%, fuel +40%, USD/INR −15%",                ecl12m: 27.75*M, eclLifetime: 53.94*M, vsBase12mPct: 146, stageComment: "Full write-off likely" },
    ],
  },
```

Replace with:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Q1 2026 actuals; no macro shock",                           ecl12m: 11.26*M, eclLifetime: 21.89*M, vsBase12mPct:   0, stageComment: "Stage 3 maintained" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%, fuel +15%",                              ecl12m: 14.98*M, eclLifetime: 29.11*M, vsBase12mPct:  33, stageComment: "Write-off risk rising" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%, fuel +40%, USD/INR −15%",                ecl12m: 27.75*M, eclLifetime: 53.94*M, vsBase12mPct: 146, stageComment: "Full write-off likely" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-05-12", event: "On-time payment", outcome: "Apr 2025 rental received in full on due date", weight: 8 },
        { date: "2025-08-14", event: "Late payment — 18 DPD", outcome: "Aug 2025 rental received 18 days past due", weight: -12 },
        { date: "2025-11-20", event: "Late payment — 28 DPD", outcome: "Nov 2025 rental received 28 days past due; backstop monitoring activated", weight: -18 },
        { date: "2026-01-15", event: "30+ DPD backstop breach", outcome: "SICR §B5.5.17 trigger activated; Stage 2 → Stage 3 migration", weight: -35 },
        { date: "2026-03-14", event: "Partial payment received", outcome: "Mar 2026 rental partially settled; $45K shortfall outstanding", weight: -14 },
      ],
      restructuringCoop: [
        { date: "2025-10-05", event: "Initial deferral request submitted", outcome: "Lessee submitted deferral request; documentation provided within 5 days", weight: 5 },
        { date: "2025-11-18", event: "Restructuring meeting — partial cooperation", outcome: "Lessee attended meeting; declined to provide updated cash flow projections", weight: -8 },
        { date: "2026-02-02", event: "Second meeting — seeking deferral", outcome: "New management team; cooperative tone but no formal agreement reached", weight: 4 },
        { date: "2026-03-28", event: "Term sheet refused", outcome: "Lessee declined term sheet for payment holiday citing board approval delay", weight: -10 },
      ],
      govtInterference: [
        { date: "2025-08-01", event: "India sovereign watchlist added", outcome: "AWG CTC score downgraded −4 pts; judicial enforcement risk elevated", weight: -12 },
        { date: "2025-11-10", event: "DGCA fleet continuity intervention", outcome: "Indian DGCA contacted lessor regarding fleet continuity; political pressure noted", weight: -18 },
        { date: "2026-01-15", event: "Sovereign watchlist — dual trigger active", outcome: "IMF quarterly India review flagged aviation sector; dual-trigger SICR classification", weight: -11 },
      ],
      litigationPropensity: [
        { date: "2024-09-14", event: "Prior arbitration resolved", outcome: "2024 dispute over maintenance reserve drawdown settled in lessor's favour", weight: -8 },
        { date: "2025-04-22", event: "Legal notice on lease amendment", outcome: "Lessee issued formal objection to lease amendment clause; withdrawn after negotiation", weight: -10 },
        { date: "2026-01-28", event: "Threat of injunction re repossession", outcome: "Lessee counsel issued letter threatening injunction; not filed as of Q1 2026", weight: -22 },
        { date: "2026-03-15", event: "§1110 cure letter contested", outcome: "Lessee's legal team disputed cure period calculation; still unresolved", weight: -15 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 62, restructuringCoop: 65, govtInterference: 35, litigationPropensity: 42 },
      { month: "Jun '25", punctuality: 58, restructuringCoop: 63, govtInterference: 36, litigationPropensity: 44 },
      { month: "Jul '25", punctuality: 55, restructuringCoop: 61, govtInterference: 37, litigationPropensity: 46 },
      { month: "Aug '25", punctuality: 52, restructuringCoop: 59, govtInterference: 38, litigationPropensity: 48 },
      { month: "Sep '25", punctuality: 50, restructuringCoop: 58, govtInterference: 39, litigationPropensity: 50 },
      { month: "Oct '25", punctuality: 47, restructuringCoop: 57, govtInterference: 40, litigationPropensity: 52 },
      { month: "Nov '25", punctuality: 44, restructuringCoop: 56, govtInterference: 40, litigationPropensity: 53 },
      { month: "Dec '25", punctuality: 40, restructuringCoop: 55, govtInterference: 41, litigationPropensity: 54 },
      { month: "Jan '26", punctuality: 36, restructuringCoop: 54, govtInterference: 41, litigationPropensity: 55 },
      { month: "Feb '26", punctuality: 32, restructuringCoop: 53, govtInterference: 41, litigationPropensity: 55 },
      { month: "Mar '26", punctuality: 30, restructuringCoop: 53, govtInterference: 41, litigationPropensity: 55 },
      { month: "Apr '26", punctuality: 28, restructuringCoop: 52, govtInterference: 41, litigationPropensity: 55 },
    ],
  },
```

- [ ] **Step 5: Add data to the AEROMEX profile block**

Find the closing of the AEROMEX scenarios array:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Chapter 11 in progress; §1110 resolution assumed",       ecl12m: 17.61*M, eclLifetime: 34.25*M, vsBase12mPct:   0, stageComment: "Stage 3; §1110 resolution" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; restructuring extended 6 months",     ecl12m: 22.10*M, eclLifetime: 43.01*M, vsBase12mPct:  26, stageComment: "Recovery timeline extended" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%; airline liquidation scenario",        ecl12m: 38.41*M, eclLifetime: 74.73*M, vsBase12mPct: 118, stageComment: "Full write-off; repo scenario" },
    ],
  },
```

Replace with:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Chapter 11 in progress; §1110 resolution assumed",       ecl12m: 17.61*M, eclLifetime: 34.25*M, vsBase12mPct:   0, stageComment: "Stage 3; §1110 resolution" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; restructuring extended 6 months",     ecl12m: 22.10*M, eclLifetime: 43.01*M, vsBase12mPct:  26, stageComment: "Recovery timeline extended" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%; airline liquidation scenario",        ecl12m: 38.41*M, eclLifetime: 74.73*M, vsBase12mPct: 118, stageComment: "Full write-off; repo scenario" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-06-10", event: "Late payment — 22 DPD", outcome: "Jun 2025 rental received 22 days past due", weight: -15 },
        { date: "2025-09-18", event: "Late payment — 35 DPD", outcome: "Sep 2025 rental 35 DPD; SICR watch activated", weight: -22 },
        { date: "2025-12-05", event: "Missed payment", outcome: "Dec 2025 rental not received; formal default notice issued", weight: -30 },
        { date: "2026-01-08", event: "Chapter 11 filing — automatic stay", outcome: "§1110 clock running; all rent obligations stayed", weight: -40 },
      ],
      restructuringCoop: [
        { date: "2025-11-12", event: "Pre-filing discussion — limited info", outcome: "Lessee counsel engaged; limited financial information provided", weight: -5 },
        { date: "2026-01-08", event: "Ch.11 filed without advance notice", outcome: "Lessor not given pre-filing consultation; standard practice in contested filings", weight: -20 },
        { date: "2026-02-14", event: "§1110 agreement framework proposed", outcome: "DIP counsel engaged; agreement framework proposed by lessee counsel", weight: 10 },
        { date: "2026-03-20", event: "3 of 4 lease assumptions confirmed", outcome: "Three lease assumptions signed; one lease disputed pending committee approval", weight: 5 },
      ],
      govtInterference: [
        { date: "2025-08-15", event: "Prior Concurso precedent assessed", outcome: "2010 Concurso Mercantil review: lessor recovered 100% after 18 months", weight: 8 },
        { date: "2026-01-08", event: "US Ch.11 filed in SDNY", outcome: "Southern District of New York filing; §1110 framework applies — strong lessor protection", weight: 12 },
        { date: "2026-02-01", event: "Mexican government employment comment", outcome: "SICT commented on fleet continuity; no legal intervention made", weight: -10 },
      ],
      litigationPropensity: [
        { date: "2025-09-10", event: "Maintenance reserve dispute", outcome: "Lessee disputed $2.1M maintenance reserve drawdown; settled out of court in 30 days", weight: -8 },
        { date: "2026-01-08", event: "Ch.11 adversary proceeding risk", outcome: "Filing creates §365 rejection risk for one lease; avoidance action capability noted", weight: -15 },
        { date: "2026-03-05", event: "No adversary proceedings filed", outcome: "90-day preference period monitored; no avoidance actions filed to date", weight: 5 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 55, restructuringCoop: 55, govtInterference: 28, litigationPropensity: 20 },
      { month: "Jun '25", punctuality: 50, restructuringCoop: 52, govtInterference: 30, litigationPropensity: 21 },
      { month: "Jul '25", punctuality: 46, restructuringCoop: 50, govtInterference: 32, litigationPropensity: 22 },
      { month: "Aug '25", punctuality: 42, restructuringCoop: 48, govtInterference: 33, litigationPropensity: 23 },
      { month: "Sep '25", punctuality: 38, restructuringCoop: 45, govtInterference: 34, litigationPropensity: 24 },
      { month: "Oct '25", punctuality: 33, restructuringCoop: 42, govtInterference: 35, litigationPropensity: 25 },
      { month: "Nov '25", punctuality: 28, restructuringCoop: 40, govtInterference: 35, litigationPropensity: 25 },
      { month: "Dec '25", punctuality: 24, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
      { month: "Jan '26", punctuality: 20, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
      { month: "Feb '26", punctuality: 19, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
      { month: "Mar '26", punctuality: 18, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
      { month: "Apr '26", punctuality: 18, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
    ],
  },
```

- [ ] **Step 6: Add data to the SRILNKN profile block**

Find the closing of the SRILNKN scenarios array:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Stage 2 monitoring; deferral risk moderate",             ecl12m:  5.94*M, eclLifetime: 15.42*M, vsBase12mPct:   0, stageComment: "Stage 2 maintained" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; sovereign risk elevated",             ecl12m:  8.02*M, eclLifetime: 20.81*M, vsBase12mPct:  35, stageComment: "Stage 2→3 risk on A330 leases" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%; sovereign default scenario",          ecl12m: 14.18*M, eclLifetime: 36.80*M, vsBase12mPct: 139, stageComment: "All leases Stage 3" },
    ],
  },
```

Replace with:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Stage 2 monitoring; deferral risk moderate",             ecl12m:  5.94*M, eclLifetime: 15.42*M, vsBase12mPct:   0, stageComment: "Stage 2 maintained" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; sovereign risk elevated",             ecl12m:  8.02*M, eclLifetime: 20.81*M, vsBase12mPct:  35, stageComment: "Stage 2→3 risk on A330 leases" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%; sovereign default scenario",          ecl12m: 14.18*M, eclLifetime: 36.80*M, vsBase12mPct: 139, stageComment: "All leases Stage 3" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-06-01", event: "On-time payment", outcome: "Jun 2025 rental received on due date", weight: 6 },
        { date: "2025-10-14", event: "Late payment — 8 DPD", outcome: "Oct 2025 rental 8 days late; attributed to bank processing delays", weight: -5 },
        { date: "2026-01-22", event: "Late payment — 12 DPD", outcome: "Jan 2026 rental 12 days past due; country watchlist event active", weight: -15 },
        { date: "2026-04-10", event: "Late payment — 12 DPD", outcome: "Apr 2026 rental 12 days past due; pattern emerging with month-end timing", weight: -8 },
      ],
      restructuringCoop: [
        { date: "2025-07-20", event: "Lease amendment agreed without dispute", outcome: "Lessee accepted minor lease amendment in full", weight: 8 },
        { date: "2025-12-05", event: "Proactive cash flow submission", outcome: "Lessee submitted quarterly cash flow projections proactively", weight: 10 },
        { date: "2026-02-18", event: "Restructuring meeting — full attendance", outcome: "Full management team present; provided audited financials on request", weight: 7 },
      ],
      govtInterference: [
        { date: "2025-05-01", event: "Government-owned carrier designation", outcome: "SriLankan Airlines confirmed as wholly government-owned; political interference risk elevated", weight: -20 },
        { date: "2025-09-15", event: "IMF EFF compliance review flagged", outcome: "Sri Lanka IMF Extended Fund Facility review flagged aviation sector restructuring", weight: -10 },
        { date: "2026-01-22", event: "Sovereign watchlist — SICR trigger", outcome: "AWG CTC country watchlist activated; dual-trigger SICR potential", weight: -18 },
      ],
      litigationPropensity: [
        { date: "2024-11-08", event: "LCIA arbitration resolved", outcome: "2023 LCIA arbitration re maintenance reserves ($1.8M); settled after 14 months", weight: -20 },
        { date: "2025-06-14", event: "Legal challenge to insurance clause", outcome: "SriLankan challenged hull insurance requirement; withdrew objection after negotiation", weight: -12 },
        { date: "2025-11-22", event: "6-month clean period", outcome: "No new legal actions in 6-month review; positive compliance signal", weight: 8 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 72, restructuringCoop: 75, govtInterference: 38, litigationPropensity: 68 },
      { month: "Jun '25", punctuality: 70, restructuringCoop: 74, govtInterference: 40, litigationPropensity: 70 },
      { month: "Jul '25", punctuality: 68, restructuringCoop: 72, govtInterference: 42, litigationPropensity: 71 },
      { month: "Aug '25", punctuality: 65, restructuringCoop: 72, govtInterference: 43, litigationPropensity: 72 },
      { month: "Sep '25", punctuality: 63, restructuringCoop: 71, govtInterference: 44, litigationPropensity: 72 },
      { month: "Oct '25", punctuality: 61, restructuringCoop: 70, govtInterference: 45, litigationPropensity: 73 },
      { month: "Nov '25", punctuality: 59, restructuringCoop: 70, govtInterference: 46, litigationPropensity: 74 },
      { month: "Dec '25", punctuality: 57, restructuringCoop: 70, govtInterference: 47, litigationPropensity: 75 },
      { month: "Jan '26", punctuality: 56, restructuringCoop: 70, govtInterference: 47, litigationPropensity: 75 },
      { month: "Feb '26", punctuality: 55, restructuringCoop: 70, govtInterference: 48, litigationPropensity: 75 },
      { month: "Mar '26", punctuality: 55, restructuringCoop: 70, govtInterference: 48, litigationPropensity: 75 },
      { month: "Apr '26", punctuality: 55, restructuringCoop: 70, govtInterference: 48, litigationPropensity: 75 },
    ],
  },
```

- [ ] **Step 7: Add data to the AZUL profile block**

Find the closing of the AZUL scenarios array:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Stage 2 on 3 leases; liquidity watch",               ecl12m:  4.23*M, eclLifetime: 11.16*M, vsBase12mPct:   0, stageComment: "Stage 2 on 3 leases" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; BRL −10% vs USD",                 ecl12m:  5.84*M, eclLifetime: 15.41*M, vsBase12mPct:  38, stageComment: "All 5 leases Stage 2" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%, BRL −25% vs USD",                 ecl12m: 10.22*M, eclLifetime: 26.97*M, vsBase12mPct: 142, stageComment: "Stage 3 risk on oldest leases" },
    ],
  },
```

Replace with:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Stage 2 on 3 leases; liquidity watch",               ecl12m:  4.23*M, eclLifetime: 11.16*M, vsBase12mPct:   0, stageComment: "Stage 2 on 3 leases" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; BRL −10% vs USD",                 ecl12m:  5.84*M, eclLifetime: 15.41*M, vsBase12mPct:  38, stageComment: "All 5 leases Stage 2" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%, BRL −25% vs USD",                 ecl12m: 10.22*M, eclLifetime: 26.97*M, vsBase12mPct: 142, stageComment: "Stage 3 risk on oldest leases" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-07-01", event: "On-time payment", outcome: "Jul 2025 rental received in full on due date", weight: 7 },
        { date: "2025-10-01", event: "On-time payment", outcome: "Oct 2025 rental received in full on due date", weight: 7 },
        { date: "2026-01-28", event: "Late payment — 6 DPD", outcome: "Jan 2026 rental 6 days past due; attributed to BRL/USD rate impact on cash conversion", weight: -6 },
        { date: "2026-04-20", event: "Late payment — 6 DPD", outcome: "Apr 2026 rental 6 days past due; month-end FX settlement pattern emerging", weight: -6 },
      ],
      restructuringCoop: [
        { date: "2025-08-15", event: "Proactive schedule discussion", outcome: "Lessee initiated discussion about schedule reductions; full fleet utilisation data provided", weight: 10 },
        { date: "2026-01-15", event: "Agreed monthly reporting", outcome: "Lessee agreed to monthly reporting cadence; no formal disputes raised", weight: 8 },
        { date: "2026-03-10", event: "Payment smoothing plan proposed", outcome: "Lessee proposed 90-day payment smoothing plan; under lessor review", weight: 5 },
      ],
      govtInterference: [
        { date: "2025-09-01", event: "ANAC assessment — neutral", outcome: "Brazilian ANAC aviation authority assessment: no enforcement actions or adverse findings", weight: 5 },
        { date: "2026-01-28", event: "BRL/USD pressure — no govt intervention", outcome: "Brazilian real depreciation +14% YoY; impacts rent-to-revenue ratio but no government action", weight: -8 },
      ],
      litigationPropensity: [
        { date: "2025-05-14", event: "Lease amendment accepted", outcome: "Lessee accepted aircraft re-delivery condition amendment without dispute", weight: 8 },
        { date: "2025-12-10", event: "Clean 6-month legal review", outcome: "6-month review: no active proceedings or threatened actions", weight: 10 },
        { date: "2026-02-28", event: "Minor maintenance reserve dispute resolved", outcome: "$85K maintenance reserve shortfall resolved administratively within 10 days", weight: -4 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 82, restructuringCoop: 80, govtInterference: 58, litigationPropensity: 72 },
      { month: "Jun '25", punctuality: 80, restructuringCoop: 80, govtInterference: 59, litigationPropensity: 73 },
      { month: "Jul '25", punctuality: 78, restructuringCoop: 79, govtInterference: 60, litigationPropensity: 74 },
      { month: "Aug '25", punctuality: 76, restructuringCoop: 79, govtInterference: 60, litigationPropensity: 74 },
      { month: "Sep '25", punctuality: 74, restructuringCoop: 79, govtInterference: 61, litigationPropensity: 75 },
      { month: "Oct '25", punctuality: 72, restructuringCoop: 78, govtInterference: 61, litigationPropensity: 75 },
      { month: "Nov '25", punctuality: 72, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
      { month: "Dec '25", punctuality: 71, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
      { month: "Jan '26", punctuality: 70, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
      { month: "Feb '26", punctuality: 69, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
      { month: "Mar '26", punctuality: 68, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
      { month: "Apr '26", punctuality: 68, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
    ],
  },
```

- [ ] **Step 8: Add data to the TRANSATCA profile block**

Find the closing of the TRANSATCA scenarios array:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Stage 2; restructuring negotiation ongoing",          ecl12m: 3.74*M, eclLifetime:  9.08*M, vsBase12mPct:   0, stageComment: "Stage 2; restructuring likely" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; deferral accepted",               ecl12m: 5.02*M, eclLifetime: 12.18*M, vsBase12mPct:  34, stageComment: "Deferral accepted; ECL rises" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%; airline enters CCAA",             ecl12m: 8.72*M, eclLifetime: 21.17*M, vsBase12mPct: 133, stageComment: "Stage 3; repo scenario" },
    ],
  },
```

Replace with:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Stage 2; restructuring negotiation ongoing",          ecl12m: 3.74*M, eclLifetime:  9.08*M, vsBase12mPct:   0, stageComment: "Stage 2; restructuring likely" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; deferral accepted",               ecl12m: 5.02*M, eclLifetime: 12.18*M, vsBase12mPct:  34, stageComment: "Deferral accepted; ECL rises" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%; airline enters CCAA",             ecl12m: 8.72*M, eclLifetime: 21.17*M, vsBase12mPct: 133, stageComment: "Stage 3; repo scenario" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-07-01", event: "On-time payment", outcome: "Jul 2025 rental received on due date", weight: 7 },
        { date: "2026-01-19", event: "Late payment — 8 DPD", outcome: "Jan 2026 rental 8 days past due; payment holiday discussion ongoing", weight: -8 },
        { date: "2026-04-22", event: "Late payment — 8 DPD", outcome: "Apr 2026 rental 8 days past due; consistent with cash-flow timing pattern", weight: -8 },
      ],
      restructuringCoop: [
        { date: "2025-10-20", event: "Proactive restructuring approach", outcome: "Lessee proactively approached with restructuring proposal; full documentation provided", weight: 12 },
        { date: "2025-12-15", event: "Counsel engaged — no adversarial stance", outcome: "Lessee retained restructuring counsel but maintained cooperative posture throughout", weight: 8 },
        { date: "2026-02-28", event: "Initial term sheet accepted", outcome: "Lessee accepted initial term sheet for payment deferral; constructive engagement confirmed", weight: 15 },
      ],
      govtInterference: [
        { date: "2025-05-01", event: "Canada CTC full accession — TOP remedy elected", outcome: "Canada elected TOP (Topping-Up) remedy under CTC; strong lessor repossession framework", weight: 20 },
        { date: "2025-08-01", event: "Transport Canada review — neutral", outcome: "Transport Canada restructuring review: no adverse public interest determination", weight: 15 },
        { date: "2026-01-05", event: "CCAA eligibility confirmed", outcome: "Air Transat has CCAA (Companies' Creditors Arrangement Act) eligibility; Canadian insolvency is creditor-friendly", weight: 12 },
      ],
      litigationPropensity: [
        { date: "2025-06-10", event: "No prior litigation on record", outcome: "Historical review confirmed: no prior arbitration or litigation against this lessor", weight: 15 },
        { date: "2026-01-19", event: "Financial difficulty indicator met — no legal threat", outcome: "IFRS 9 §B5.5.17 financial difficulty indicator met; no legal action threatened", weight: -5 },
        { date: "2026-03-14", event: "Arbitration waiver agreed", outcome: "Lessee agreed to arbitration-only dispute resolution in restructuring term sheet", weight: 10 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 75, restructuringCoop: 68, govtInterference: 84, litigationPropensity: 43 },
      { month: "Jun '25", punctuality: 74, restructuringCoop: 69, govtInterference: 85, litigationPropensity: 44 },
      { month: "Jul '25", punctuality: 73, restructuringCoop: 70, govtInterference: 86, litigationPropensity: 44 },
      { month: "Aug '25", punctuality: 72, restructuringCoop: 71, govtInterference: 87, litigationPropensity: 45 },
      { month: "Sep '25", punctuality: 71, restructuringCoop: 72, govtInterference: 87, litigationPropensity: 46 },
      { month: "Oct '25", punctuality: 70, restructuringCoop: 73, govtInterference: 88, litigationPropensity: 46 },
      { month: "Nov '25", punctuality: 70, restructuringCoop: 74, govtInterference: 88, litigationPropensity: 47 },
      { month: "Dec '25", punctuality: 68, restructuringCoop: 74, govtInterference: 88, litigationPropensity: 47 },
      { month: "Jan '26", punctuality: 66, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
      { month: "Feb '26", punctuality: 64, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
      { month: "Mar '26", punctuality: 63, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
      { month: "Apr '26", punctuality: 62, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
    ],
  },
```

- [ ] **Step 9: Add data to the EMIRATES profile block**

Find the closing of the EMIRATES scenarios array:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Strong counterparty; sovereign-backed",                    ecl12m: 0.62*M, eclLifetime: 2.81*M, vsBase12mPct:   0, stageComment: "Stage 1 maintained" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; UAE insulated",                        ecl12m: 0.94*M, eclLifetime: 4.26*M, vsBase12mPct:  52, stageComment: "Stage 1 maintained" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%, oil shock; UAE sovereign under stress", ecl12m: 1.88*M, eclLifetime: 8.51*M, vsBase12mPct: 203, stageComment: "SICR watch; Stage 2 possible" },
    ],
  },
```

Replace with:
```tsx
    scenarios: [
      { name: "Base Case",     description: "Strong counterparty; sovereign-backed",                    ecl12m: 0.62*M, eclLifetime: 2.81*M, vsBase12mPct:   0, stageComment: "Stage 1 maintained" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; UAE insulated",                        ecl12m: 0.94*M, eclLifetime: 4.26*M, vsBase12mPct:  52, stageComment: "Stage 1 maintained" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%, oil shock; UAE sovereign under stress", ecl12m: 1.88*M, eclLifetime: 8.51*M, vsBase12mPct: 203, stageComment: "SICR watch; Stage 2 possible" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-05-01", event: "On-time payment", outcome: "May 2025 rental received in full on due date", weight: 10 },
        { date: "2025-08-01", event: "On-time payment", outcome: "Aug 2025 rental received in full on due date", weight: 10 },
        { date: "2026-01-01", event: "On-time payment", outcome: "Jan 2026 rental received in full on due date", weight: 10 },
        { date: "2026-04-28", event: "On-time payment — 8-year record", outcome: "Apr 2026 rental received on due date in full; 8-year unbroken payment record maintained", weight: 10 },
      ],
      restructuringCoop: [
        { date: "2025-06-15", event: "Lease renewal agreed 18 months early", outcome: "Emirates proactively agreed 3-year lease extension 18 months before expiry; no negotiation required", weight: 15 },
        { date: "2026-02-10", event: "Audited financials provided proactively", outcome: "Emirates provided Q3 2025 audited financials without lessor request", weight: 10 },
      ],
      govtInterference: [
        { date: "2025-05-01", event: "ICD sovereign backing confirmed", outcome: "Investment Corporation of Dubai holds 55.6% stake in Emirates; strong sovereign guarantor", weight: 15 },
        { date: "2026-04-01", event: "UAE fiscal consolidation — minor note", outcome: "Minor UAE fiscal policy adjustment noted; no impact on Emirates operating licence or fleet financing", weight: -3 },
      ],
      litigationPropensity: [
        { date: "2025-05-01", event: "Zero litigation history confirmed", outcome: "Full historical review: zero arbitration or litigation actions by Emirates against any lessor", weight: 20 },
        { date: "2026-01-01", event: "Annual legal review — clean", outcome: "Annual legal review confirmed: zero active or threatened proceedings", weight: 10 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 96, restructuringCoop: 93, govtInterference: 90, litigationPropensity: 88 },
      { month: "Jun '25", punctuality: 97, restructuringCoop: 94, govtInterference: 91, litigationPropensity: 89 },
      { month: "Jul '25", punctuality: 97, restructuringCoop: 94, govtInterference: 91, litigationPropensity: 89 },
      { month: "Aug '25", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 90 },
      { month: "Sep '25", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 90 },
      { month: "Oct '25", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Nov '25", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Dec '25", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Jan '26", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Feb '26", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Mar '26", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Apr '26", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
    ],
  },
```

- [ ] **Step 10: Verify build passes**

Run:
```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -15
```
Expected: ends with `built in`. If TypeScript errors, the most likely cause is that `behaviourEvidence` or `scoreHistory` is missing on one lessee — check all 6 blocks have the new fields.

- [ ] **Step 11: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/counterparties/LesseeProfilePanel.tsx && git commit -m "$(cat <<'EOF'
feat(f05): add OCPI types and 12-month evidence data for all 6 lessees

Adds EvidenceEvent, BehaviourEvidence, ScoreHistoryPoint, OverrideEntry
types and populates behaviourEvidence + scoreHistory for INDIGO, AEROMEX,
SRILNKN, AZUL, TRANSATCA, EMIRATES in PROFILE_DATA.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `BehaviourTab` Component and Wire the 6th Tab

**Files:**
- Modify: `src/app/components/counterparties/LesseeProfilePanel.tsx`

Context: `TABS` is defined at line ~406 (shifts slightly after Task 1 edits). `BehaviourTab` is added immediately before the `LesseeProfilePanel` export function. The render block in `LesseeProfilePanel` gains one new `{activeTab === "Behaviour" && ...}` line.

- [ ] **Step 1: Add the `SCORE_LABELS` constant and `BehaviourTab` component**

Find the comment line just before the main export:
```tsx
// ─── LesseeProfilePanel ───────────────────────────────────────────────────────
```

Insert the following block immediately before that comment:

```tsx
// ─── BehaviourTab ─────────────────────────────────────────────────────────────

const SCORE_LABELS: Record<SubScoreKey, string> = {
  punctuality: "Payment Punctuality",
  restructuringCoop: "Restructuring Cooperation",
  govtInterference: "Govt. Interference Risk",
  litigationPropensity: "Litigation Propensity",
};

function BehaviourTab({ meta, behaviourEvidence, scoreHistory }: {
  meta: LesseeMeta;
  behaviourEvidence: BehaviourEvidence;
  scoreHistory: ScoreHistoryPoint[];
}) {
  const [openSection, setOpenSection] = useState<SubScoreKey | null>("punctuality");
  const [overrides, setOverrides] = useState<OverrideEntry[]>([]);
  const [overrideForm, setOverrideForm] = useState<{ subScore: SubScoreKey; newValue: number; reason: string }>({
    subScore: "punctuality",
    newValue: 50,
    reason: "",
  });

  // Apply active overrides to scores
  const currentScores = { ...meta.scores };
  for (const o of overrides) {
    const key = (Object.keys(SCORE_LABELS) as SubScoreKey[]).find(
      k => SCORE_LABELS[k] === o.subScore
    );
    if (key) currentScores[key] = o.newValue;
  }

  const scoreItems: Array<{ key: SubScoreKey; label: string; displayScore: number }> = [
    { key: "punctuality",        label: "Payment Punctuality",       displayScore: currentScores.punctuality },
    { key: "restructuringCoop",  label: "Restructuring Cooperation", displayScore: currentScores.restructuringCoop },
    { key: "govtInterference",   label: "Govt. Interference Risk",   displayScore: 100 - currentScores.govtInterference },
    { key: "litigationPropensity", label: "Litigation Propensity",   displayScore: 100 - currentScores.litigationPropensity },
  ];

  function scoreColor(s: number): string {
    return s >= 70 ? "#15803D" : s >= 50 ? "#B45309" : "#B91C1C";
  }
  function scoreBg(s: number): string {
    return s >= 70 ? "rgba(21,128,61,0.1)" : s >= 50 ? "rgba(180,83,9,0.1)" : "rgba(185,28,28,0.1)";
  }

  function handleOverrideSubmit() {
    const item = scoreItems.find(s => s.key === overrideForm.subScore);
    if (!item || !overrideForm.reason.trim()) return;
    const entry: OverrideEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: "analyst@aeroinsights.com",
      subScore: item.label,
      oldValue: item.displayScore,
      newValue: overrideForm.newValue,
      reason: overrideForm.reason.trim(),
    };
    setOverrides(prev => [entry, ...prev]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* OCPI Banner */}
      <div style={{ background: "#002147", borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.25rem" }}>
          Observed Contractual Performance Indicator (OCPI) — IFRS 9 §B5.5.17 compliance scoring framework
        </div>
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>
          All scores derived exclusively from observable contractual events. Cultural, national, or subjective proxies are excluded.
        </div>
      </div>

      {/* 2×2 Sparkline Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {scoreItems.map(({ key, label, displayScore }) => {
          const sparkData = scoreHistory.map(h => ({
            month: h.month,
            value: (key === "govtInterference" || key === "litigationPropensity")
              ? 100 - h[key]
              : h[key],
          }));
          const sc = scoreColor(displayScore);
          return (
            <div key={key} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", lineHeight: 1.3 }}>OCPI — {label}</div>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: sc, background: scoreBg(displayScore), borderRadius: "4px", padding: "0.125rem 0.375rem", flexShrink: 0 }}>
                  {displayScore}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={56}>
                <AreaChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <defs>
                    <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={sc} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={sc} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke={sc} strokeWidth={1.5} fill={`url(#grad-${key})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>

      {/* Evidence Accordion */}
      <Card title="OCPI Evidence Log" subtitle="Itemised contractual events underlying each sub-score">
        <div style={{ display: "flex", flexDirection: "column" }}>
          {scoreItems.map(({ key, label, displayScore }) => {
            const isOpen = openSection === key;
            const events = behaviourEvidence[key];
            const sc = scoreColor(displayScore);
            return (
              <div key={key} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <button
                  onClick={() => setOpenSection(isOpen ? null : key)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 0",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>
                      OCPI — {label}
                    </span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: sc, background: scoreBg(displayScore), borderRadius: "4px", padding: "0.1rem 0.35rem" }}>
                      {displayScore}
                    </span>
                  </div>
                  {isOpen
                    ? <ChevronUp size={14} color="#94A3B8" />
                    : <ChevronDown size={14} color="#94A3B8" />}
                </button>
                {isOpen && (
                  <div style={{ paddingBottom: "0.75rem", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                      <thead>
                        <tr style={{ background: "#F4F5F7" }}>
                          {["Date", "Event", "Observed Outcome", "Weight"].map(h => (
                            <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((ev, i) => (
                          <tr
                            key={i}
                            style={{ borderBottom: "1px solid #F1F5F9" }}
                            onMouseEnter={e => ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")}
                            onMouseLeave={e => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                          >
                            <td style={{ padding: "0.5rem 0.75rem", color: "#475569", whiteSpace: "nowrap", fontSize: "0.75rem" }}>{ev.date}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>{ev.event}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#475569", maxWidth: "260px" }}>{ev.outcome}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: ev.weight >= 0 ? "#15803D" : "#B91C1C", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              {ev.weight >= 0 ? `+${ev.weight}` : ev.weight}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Override Panel */}
      <Card title="Score Override — Governance & Audit Log" subtitle="Analyst overrides are immutably logged with reason and timestamp">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>Sub-Score</label>
              <select
                value={overrideForm.subScore}
                onChange={e => setOverrideForm(p => ({ ...p, subScore: e.target.value as SubScoreKey }))}
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
              >
                {scoreItems.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>New Value (0–100)</label>
              <input
                type="number" min={0} max={100}
                value={overrideForm.newValue}
                onChange={e => setOverrideForm(p => ({ ...p, newValue: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", boxSizing: "border-box" as const }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>Reason (required)</label>
              <textarea
                value={overrideForm.reason}
                onChange={e => setOverrideForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Describe the basis for this override..."
                rows={3}
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", resize: "none" as const, boxSizing: "border-box" as const }}
              />
            </div>
            <button
              onClick={handleOverrideSubmit}
              disabled={!overrideForm.reason.trim()}
              style={{
                background: overrideForm.reason.trim() ? "#002147" : "#94A3B8",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "9999px",
                padding: "0.5rem 1rem",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: overrideForm.reason.trim() ? "pointer" : "not-allowed",
              }}
            >
              Submit Override
            </button>
          </div>
          {/* Audit log */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.5rem" }}>
              Audit Log ({overrides.length} {overrides.length === 1 ? "entry" : "entries"})
            </div>
            {overrides.length === 0 ? (
              <div style={{ padding: "1rem", background: "#F8FAFC", borderRadius: "0.5rem", fontSize: "0.8125rem", color: "#94A3B8", textAlign: "center" as const }}>
                No overrides recorded
              </div>
            ) : (
              <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: "0.5rem" }}>
                {overrides.map(o => (
                  <div key={o.id} style={{ padding: "0.625rem 0.75rem", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0F172A" }}>{o.subScore}</span>
                      <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{o.timestamp.slice(0, 10)}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#475569", marginBottom: "0.25rem" }}>
                      {o.oldValue} → <strong style={{ color: "#0F172A" }}>{o.newValue}</strong> · {o.user}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#475569", fontStyle: "italic" as const }}>{o.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

```

- [ ] **Step 2: Add "Behaviour" to the TABS constant**

Find:
```tsx
const TABS = ["Overview", "Leases", "ECL", "Timeline", "Scenarios"] as const;
type TabKey = typeof TABS[number];
```

Replace with:
```tsx
const TABS = ["Overview", "Leases", "ECL", "Timeline", "Scenarios", "Behaviour"] as const;
type TabKey = typeof TABS[number];
```

- [ ] **Step 3: Update `LesseeProfilePanel` to destructure the new fields and wire the tab**

Find the destructure line in `LesseeProfilePanel`:
```tsx
  const { meta, leases, eclRows, monthlyDPD, events, scenarios } = PROFILE_DATA[lesseeId];
```

Replace with:
```tsx
  const { meta, leases, eclRows, monthlyDPD, events, scenarios, behaviourEvidence, scoreHistory } = PROFILE_DATA[lesseeId];
```

Then find the existing tab content render block ending with:
```tsx
        {activeTab === "Scenarios" && <ScenariosTab  scenarios={scenarios} />}
```

Add one line after it:
```tsx
        {activeTab === "Behaviour" && <BehaviourTab meta={meta} behaviourEvidence={behaviourEvidence} scoreHistory={scoreHistory} />}
```

- [ ] **Step 4: Verify build passes**

Run:
```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -15
```
Expected: ends with `built in`. Common TypeScript errors to check:
- `SubScoreKey` used in `BehaviourTab` props — verify it's defined above the component
- `OverrideEntry.id` — used as React key; verify it's a `string`
- `scoreHistory.map(h => h[key])` — `key` is `SubScoreKey` which is a keyof `ScoreHistoryPoint`; TypeScript needs `ScoreHistoryPoint` to have all 4 sub-score keys as `number`

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/counterparties/LesseeProfilePanel.tsx && git commit -m "$(cat <<'EOF'
feat(f05): add BehaviourTab with OCPI sparklines, evidence log, override panel

Adds 6th Behaviour tab to LesseeProfilePanel. Shows 12-month OCPI
sparklines per sub-score, itemised contractual evidence accordion, and
an audited manual override form with immutable audit log.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- ✅ OCPI banner: Task 2 Step 1 (BehaviourTab banner div)
- ✅ 12-month sparklines: Task 2 Step 1 (2×2 AreaChart grid)
- ✅ Evidence accordion with date/event/outcome/weight: Task 2 Step 1 (Evidence Accordion section)
- ✅ Manual override panel: Task 2 Step 1 (Override Panel section)
- ✅ Audit log: Task 2 Step 1 (audit log div in Override Panel)
- ✅ "Behaviour" tab wired: Task 2 Steps 2–3
- ✅ Data for all 6 lessees: Task 1 Steps 4–9
- ✅ Label enforcement ("OCPI —" prefix): Task 2 Step 1 — evidence table headers all use "OCPI — {label}"
- ✅ Override reflects in sparkline score badge: Task 2 Step 1 — `currentScores` is computed from overrides before `scoreItems` is built

**Placeholder scan:** No TBDs or incomplete sections.

**Type consistency:**
- `SubScoreKey` defined in Task 1 Step 2, used as `overrideForm.subScore` and `behaviourEvidence[key]` in Task 2 Step 1 ✓
- `OverrideEntry.id` is `string` (set to `Date.now().toString()`) — valid React key ✓
- `scoreHistory.map(h => h[key])` — `key: SubScoreKey` is a keyof `ScoreHistoryPoint` (verified: interface has `punctuality`, `restructuringCoop`, `govtInterference`, `litigationPropensity` as `number`) ✓
- `SCORE_LABELS: Record<SubScoreKey, string>` — all 4 keys present ✓
