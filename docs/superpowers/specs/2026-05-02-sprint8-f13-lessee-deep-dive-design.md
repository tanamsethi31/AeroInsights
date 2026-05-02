# Sprint 8 — F13: Lessee Deep-Dive Profile Design

**Date:** 2026-05-02
**Status:** Approved
**Scope:** Enrich the Counterparties page by replacing the right-column detail area with a 5-tab `LesseeProfilePanel` component. Tabs: Overview (existing content migrated) · Leases · ECL · Timeline · Scenarios.

---

## 1. Architecture

### File changes

| File | Change |
|------|--------|
| `src/app/components/counterparties/LesseeProfilePanel.tsx` | **New** — all types, 6-lessee synthetic datasets for leases/ECL/timeline/scenarios, helpers, profile header, and 5-tab UI (~600 lines) |
| `src/app/pages/Counterparties.tsx` | **Modify** — import `LesseeProfilePanel`, remove inline `restructuringOptions`, `showRestructuring` state, recharts imports and all right-column JSX, replace right column with `<LesseeProfilePanel lesseeId={selectedLessee.id} />` |

No separate data file. All synthetic data lives inside `LesseeProfilePanel.tsx`. Follows the same isolation pattern as `ConcentrationTab.tsx`, `SDMRTab.tsx`, and `AircraftValuationPanel.tsx`.

---

## 2. Data Model

```ts
type LesseeId = "INDIGO" | "AEROMEX" | "SRILNKN" | "AZUL" | "TRANSATCA" | "EMIRATES";

interface LesseeLeaseRow {
  id: string;           // e.g. "LSE-2019-001"
  aircraft: string;     // e.g. "A320neo"
  msn: string;
  monthlyRentUSD: number; // USD
  ead: number;          // USD (exposure-at-default)
  leaseEnd: string;     // "YYYY-MM-DD"
  stage: "1" | "2" | "3";
}

interface LesseeECLRow {
  leaseId: string;
  aircraft: string;
  ead: number;          // USD
  pd12m: number;        // % e.g. 12.4
  pdLifetime: number;   // %
  lgd: number;          // % e.g. 54
  ecl12m: number;       // USD
  eclLifetime: number;  // USD
  stage: "1" | "2" | "3";
}

type EventType = "payment" | "late" | "missed" | "rating-change" | "stage-change" | "trigger" | "deferral";

interface PaymentEvent {
  date: string;         // "YYYY-MM-DD"
  type: EventType;
  description: string;
  impact: string;
  daysOverdue?: number; // only for "late" / "missed"
}

interface MonthlyDPD {
  month: string;        // "Oct", "Nov", ...
  daysOverdue: number;  // negative = paid early
}

interface ScenarioRow {
  name: string;         // "Base Case" | "Mild Stress" | "Severe Stress"
  description: string;  // short macro assumption summary
  ecl12m: number;       // USD
  eclLifetime: number;  // USD
  vsBase12mPct: number; // % delta vs base (0 for base row)
  stageComment: string;
}

interface LesseeProfile {
  leases: LesseeLeaseRow[];
  eclRows: LesseeECLRow[];
  monthlyDPD: MonthlyDPD[];   // 12 months (May 2025 – Apr 2026)
  events: PaymentEvent[];
  scenarios: ScenarioRow[];
}
```

---

## 3. Synthetic Datasets

### IndiGo Airlines (`INDIGO`) — Stage 3, $184M, BB-

**Leases (6)**

| Lease ID | Aircraft | MSN | Rent/mo | EAD $M | Lease End | Stage |
|----------|----------|-----|---------|--------|-----------|-------|
| LSE-2019-001 | A320neo | 9218 | $285k | 24.2 | 2028-03-01 | 3 |
| LSE-2019-002 | A320neo | 9341 | $285k | 23.8 | 2028-06-01 | 3 |
| LSE-2020-005 | A321neo | 9876 | $295k | 28.1 | 2029-01-15 | 3 |
| LSE-2021-008 | A320neo | 10122 | $280k | 31.4 | 2030-07-01 | 3 |
| LSE-2022-011 | A320neo | 10567 | $275k | 38.2 | 2031-03-15 | 2 |
| LSE-2022-014 | A321neo | 10891 | $290k | 38.3 | 2031-09-01 | 2 |

**ECL Rows**

| Lease ID | Aircraft | EAD $M | PD 12m % | PD LT % | LGD % | ECL 12m $M | ECL LT $M |
|----------|----------|--------|----------|---------|-------|------------|-----------|
| LSE-2019-001 | A320neo | 24.2 | 18.2 | 24.1 | 54 | 2.38 | 4.69 |
| LSE-2019-002 | A320neo | 23.8 | 18.2 | 24.1 | 54 | 2.34 | 4.61 |
| LSE-2020-005 | A321neo | 28.1 | 14.6 | 20.8 | 54 | 2.22 | 4.28 |
| LSE-2021-008 | A320neo | 31.4 | 14.6 | 20.8 | 54 | 2.48 | 4.79 |
| LSE-2022-011 | A320neo | 38.2 | 4.8 | 9.2 | 50 | 0.92 | 1.76 |
| LSE-2022-014 | A321neo | 38.3 | 4.8 | 9.2 | 50 | 0.92 | 1.76 |

**Monthly DPD** (May 2025 – Apr 2026): 0, 0, 2, 4, 8, 12, 18, 24, 30, 38, 42, 45

**Events**

| Date | Type | Description | Impact |
|------|------|-------------|--------|
| 2026-03-14 | late | $285k rent — 45 DPD on LSE-2019-001 | ECL stage 3 backstop triggered |
| 2026-02-01 | stage-change | SICR backstop: 30+ DPD · all leases moved to Stage 3 | Lifetime ECL now required |
| 2026-01-10 | trigger | India sovereign watchlist event — AWG CTC score downgraded | SICR qualitative trigger |
| 2025-12-10 | rating-change | S&P: BBB- → BB- | PD curve shifted +4pp |
| 2025-11-15 | late | $285k rent — 12 DPD on LSE-2019-001 | Monitoring elevated |
| 2025-10-01 | payment | All leases current | — |

**Scenarios**

| Scenario | ECL 12m $M | ECL LT $M | Δ Base | Stage Comment |
|----------|-----------|-----------|--------|---------------|
| Base Case | 11.26 | 21.89 | — | Stage 3 maintained |
| Mild Stress | 14.98 | 29.11 | +33% | Write-off risk rising |
| Severe Stress | 27.75 | 53.94 | +146% | Full write-off likely |

---

### Aeromexico (`AEROMEX`) — Stage 3, $122M, CCC

**Leases (4)**

| Lease ID | Aircraft | MSN | Rent/mo | EAD $M | Lease End | Stage |
|----------|----------|-----|---------|--------|-----------|-------|
| LSE-2020-014 | B737-800 | 41234 | $310k | 32.1 | 2027-06-15 | 3 |
| LSE-2021-019 | B737-800 | 43812 | $310k | 29.4 | 2028-01-10 | 3 |
| LSE-2022-023 | B737 MAX 8 | 67102 | $340k | 33.6 | 2029-04-20 | 3 |
| LSE-2023-007 | B737 MAX 8 | 72845 | $340k | 26.9 | 2030-08-01 | 3 |

**ECL Rows**

| Lease ID | Aircraft | EAD $M | PD 12m % | PD LT % | LGD % | ECL 12m $M | ECL LT $M |
|----------|----------|--------|----------|---------|-------|------------|-----------|
| LSE-2020-014 | B737-800 | 32.1 | 28.4 | 36.2 | 58 | 5.28 | 10.27 |
| LSE-2021-019 | B737-800 | 29.4 | 28.4 | 36.2 | 58 | 4.84 | 9.41 |
| LSE-2022-023 | B737 MAX 8 | 33.6 | 22.1 | 30.4 | 56 | 4.16 | 8.09 |
| LSE-2023-007 | B737 MAX 8 | 26.9 | 22.1 | 30.4 | 56 | 3.33 | 6.48 |

**Monthly DPD** (May 2025 – Apr 2026): 0, 5, 14, 22, 31, 45, 54, 66, 72, 80, 85, 88

**Events**

| Date | Type | Description | Impact |
|------|------|-------------|--------|
| 2026-02-14 | missed | No rent received — 88 DPD on all 4 leases | §1110 cure window active |
| 2026-01-20 | trigger | Chapter 11 voluntary filing — Mexico City court | All leases Stage 3; lifetime ECL |
| 2025-12-01 | deferral | 60-day deferral request received; lessor declined | Negotiations ongoing |
| 2025-11-08 | rating-change | S&P: B- → CCC | PD curve shifted +8pp |
| 2025-10-15 | late | $310k rent — 14 DPD on LSE-2020-014 | Stage 2 SICR threshold breached |
| 2025-09-01 | stage-change | Stage 1 → 2 on all Aeromexico leases | Lifetime ECL monitoring begins |

**Scenarios**

| Scenario | ECL 12m $M | ECL LT $M | Δ Base | Stage Comment |
|----------|-----------|-----------|--------|---------------|
| Base Case | 17.61 | 34.25 | — | Stage 3; §1110 resolution |
| Mild Stress | 22.10 | 43.01 | +26% | Recovery timeline extended |
| Severe Stress | 38.41 | 74.73 | +118% | Full write-off; repo scenario |

---

### SriLankan Airlines (`SRILNKN`) — Stage 2, $118M, B+

**Leases (4)**

| Lease ID | Aircraft | MSN | Rent/mo | EAD $M | Lease End | Stage |
|----------|----------|-----|---------|--------|-----------|-------|
| LSE-2020-031 | A330-300 | 1728 | $480k | 34.2 | 2026-09-01 | 2 |
| LSE-2021-034 | A330-300 | 1842 | $480k | 31.8 | 2027-03-15 | 2 |
| LSE-2022-038 | A320neo | 10244 | $285k | 28.6 | 2028-11-01 | 2 |
| LSE-2023-012 | A320neo | 11102 | $285k | 23.4 | 2030-05-20 | 2 |

**ECL Rows**

| Lease ID | Aircraft | EAD $M | PD 12m % | PD LT % | LGD % | ECL 12m $M | ECL LT $M |
|----------|----------|--------|----------|---------|-------|------------|-----------|
| LSE-2020-031 | A330-300 | 34.2 | 9.8 | 16.4 | 60 | 2.01 | 5.23 |
| LSE-2021-034 | A330-300 | 31.8 | 9.8 | 16.4 | 60 | 1.87 | 4.86 |
| LSE-2022-038 | A320neo | 28.6 | 7.2 | 12.8 | 55 | 1.13 | 2.93 |
| LSE-2023-012 | A320neo | 23.4 | 7.2 | 12.8 | 55 | 0.93 | 2.40 |

**Monthly DPD** (May 2025 – Apr 2026): 0, 3, 6, 4, 8, 10, 7, 9, 11, 12, 10, 12

**Events**

| Date | Type | Description | Impact |
|------|------|-------------|--------|
| 2026-03-22 | rating-change | S&P: BB- → B+ | PD curve shifted +2pp |
| 2026-02-10 | late | $480k rent — 12 DPD on LSE-2020-031 | Stage 2 maintained |
| 2025-12-15 | stage-change | Stage 1 → 2; sovereign CDS +85bps qualitative trigger | Lifetime ECL monitoring |
| 2025-11-01 | trigger | Sri Lanka sovereign watchlist event | SICR qualitative trigger |
| 2025-09-14 | payment | All leases current | — |

**Scenarios**

| Scenario | ECL 12m $M | ECL LT $M | Δ Base | Stage Comment |
|----------|-----------|-----------|--------|---------------|
| Base Case | 5.94 | 15.42 | — | Stage 2 maintained |
| Mild Stress | 8.02 | 20.81 | +35% | Stage 2→3 risk on A330 leases |
| Severe Stress | 14.18 | 36.80 | +139% | All leases Stage 3 |

---

### Azul Brazilian Airlines (`AZUL`) — Stage 2, $142M, B+

**Leases (5)**

| Lease ID | Aircraft | MSN | Rent/mo | EAD $M | Lease End | Stage |
|----------|----------|-----|---------|--------|-----------|-------|
| LSE-2021-055 | A320neo | 10442 | $295k | 28.6 | 2029-11-01 | 2 |
| LSE-2021-056 | A320neo | 10543 | $295k | 27.8 | 2029-11-01 | 2 |
| LSE-2022-061 | A321neo | 11234 | $310k | 29.4 | 2030-05-15 | 2 |
| LSE-2022-064 | A320neo | 11456 | $290k | 28.1 | 2030-09-01 | 1 |
| LSE-2023-018 | A321neo | 12001 | $310k | 28.1 | 2031-03-20 | 1 |

**ECL Rows**

| Lease ID | Aircraft | EAD $M | PD 12m % | PD LT % | LGD % | ECL 12m $M | ECL LT $M |
|----------|----------|--------|----------|---------|-------|------------|-----------|
| LSE-2021-055 | A320neo | 28.6 | 8.4 | 14.2 | 52 | 1.25 | 3.23 |
| LSE-2021-056 | A320neo | 27.8 | 8.4 | 14.2 | 52 | 1.21 | 3.14 |
| LSE-2022-061 | A321neo | 29.4 | 8.4 | 14.2 | 52 | 1.29 | 3.33 |
| LSE-2022-064 | A320neo | 28.1 | 1.8 | 5.4 | 48 | 0.24 | 0.73 |
| LSE-2023-018 | A321neo | 28.1 | 1.8 | 5.4 | 48 | 0.24 | 0.73 |

**Monthly DPD** (May 2025 – Apr 2026): 0, 0, 2, 4, 3, 6, 5, 7, 6, 6, 7, 6

**Events**

| Date | Type | Description | Impact |
|------|------|-------------|--------|
| 2026-04-20 | late | $295k rent — 6 DPD on LSE-2021-055 | Monitoring |
| 2026-02-18 | stage-change | LSE-2021-055/056/061 Stage 1 → 2: schedule −18% QoQ | Lifetime ECL on 3 leases |
| 2025-11-04 | trigger | Liquidity ratio below covenant threshold | SICR qualitative review initiated |
| 2025-08-01 | payment | All leases current | — |

**Scenarios**

| Scenario | ECL 12m $M | ECL LT $M | Δ Base | Stage Comment |
|----------|-----------|-----------|--------|---------------|
| Base Case | 4.23 | 11.16 | — | Stage 2 on 3 leases |
| Mild Stress | 5.84 | 15.41 | +38% | All 5 leases Stage 2 |
| Severe Stress | 10.22 | 26.97 | +142% | Stage 3 risk on oldest leases |

---

### Air Transat (`TRANSATCA`) — Stage 2, $96M, B

**Leases (3)**

| Lease ID | Aircraft | MSN | Rent/mo | EAD $M | Lease End | Stage |
|----------|----------|-----|---------|--------|-----------|-------|
| LSE-2019-063 | A321neo | 8841 | $275k | 32.8 | 2027-05-01 | 2 |
| LSE-2020-068 | A321neo | 9104 | $275k | 31.4 | 2027-11-15 | 2 |
| LSE-2021-072 | A321neo | 9562 | $275k | 31.8 | 2028-06-01 | 2 |

**ECL Rows**

| Lease ID | Aircraft | EAD $M | PD 12m % | PD LT % | LGD % | ECL 12m $M | ECL LT $M |
|----------|----------|--------|----------|---------|-------|------------|-----------|
| LSE-2019-063 | A321neo | 32.8 | 7.8 | 13.6 | 50 | 1.28 | 3.10 |
| LSE-2020-068 | A321neo | 31.4 | 7.8 | 13.6 | 50 | 1.22 | 2.97 |
| LSE-2021-072 | A321neo | 31.8 | 7.8 | 13.6 | 50 | 1.24 | 3.01 |

**Monthly DPD** (May 2025 – Apr 2026): 0, 2, 4, 6, 5, 7, 6, 8, 8, 9, 8, 8

**Events**

| Date | Type | Description | Impact |
|------|------|-------------|--------|
| 2026-04-22 | late | $275k rent — 8 DPD on LSE-2019-063 | Monitoring |
| 2026-03-10 | deferral | 30-day deferral request received; under review | Potential SICR trigger |
| 2026-01-15 | stage-change | Stage 1 → 2: restructuring negotiations initiated | Lifetime ECL begins |
| 2025-10-01 | payment | All leases current | — |

**Scenarios**

| Scenario | ECL 12m $M | ECL LT $M | Δ Base | Stage Comment |
|----------|-----------|-----------|--------|---------------|
| Base Case | 3.74 | 9.08 | — | Stage 2; restructuring likely |
| Mild Stress | 5.02 | 12.18 | +34% | Deferral accepted; ECL rises |
| Severe Stress | 8.72 | 21.17 | +133% | Stage 3; repo scenario |

---

### Emirates (`EMIRATES`) — Stage 1, $412M, A-

**Leases (8)**

| Lease ID | Aircraft | MSN | Rent/mo | EAD $M | Lease End | Stage |
|----------|----------|-----|---------|--------|-----------|-------|
| LSE-2021-022 | B777-300ER | 62047 | $1,240k | 88.4 | 2030-01-10 | 1 |
| LSE-2021-023 | B777-300ER | 62204 | $1,240k | 86.2 | 2030-04-01 | 1 |
| LSE-2022-041 | A350-900 | 0612 | $960k | 68.8 | 2031-07-15 | 1 |
| LSE-2022-042 | A350-900 | 0634 | $960k | 66.4 | 2031-10-01 | 1 |
| LSE-2023-031 | B777-300ER | 64102 | $1,240k | 38.2 | 2032-02-20 | 1 |
| LSE-2023-032 | B777-300ER | 64318 | $1,240k | 36.4 | 2032-05-01 | 1 |
| LSE-2024-011 | A350-900 | 0891 | $960k | 14.8 | 2033-08-10 | 1 |
| LSE-2024-012 | A350-900 | 0912 | $960k | 12.8 | 2033-11-01 | 1 |

**ECL Rows**

| Lease ID | Aircraft | EAD $M | PD 12m % | PD LT % | LGD % | ECL 12m $M | ECL LT $M |
|----------|----------|--------|----------|---------|-------|------------|-----------|
| LSE-2021-022 | B777-300ER | 88.4 | 0.4 | 1.8 | 38 | 0.13 | 0.60 |
| LSE-2021-023 | B777-300ER | 86.2 | 0.4 | 1.8 | 38 | 0.13 | 0.59 |
| LSE-2022-041 | A350-900 | 68.8 | 0.4 | 1.8 | 38 | 0.10 | 0.47 |
| LSE-2022-042 | A350-900 | 66.4 | 0.4 | 1.8 | 38 | 0.10 | 0.45 |
| LSE-2023-031 | B777-300ER | 38.2 | 0.4 | 1.8 | 38 | 0.06 | 0.26 |
| LSE-2023-032 | B777-300ER | 36.4 | 0.4 | 1.8 | 38 | 0.06 | 0.25 |
| LSE-2024-011 | A350-900 | 14.8 | 0.4 | 1.8 | 38 | 0.02 | 0.10 |
| LSE-2024-012 | A350-900 | 12.8 | 0.4 | 1.8 | 38 | 0.02 | 0.09 |

**Monthly DPD** (May 2025 – Apr 2026): 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0

**Events**

| Date | Type | Description | Impact |
|------|------|-------------|--------|
| 2026-04-28 | payment | All 8 leases current — $8.56M total rent received | — |
| 2026-01-28 | payment | All leases current | — |
| 2025-10-28 | payment | All leases current | — |
| 2025-07-28 | payment | All leases current | — |

**Scenarios**

| Scenario | ECL 12m $M | ECL LT $M | Δ Base | Stage Comment |
|----------|-----------|-----------|--------|---------------|
| Base Case | 0.62 | 2.81 | — | Stage 1 maintained |
| Mild Stress | 0.94 | 4.26 | +52% | Stage 1 maintained |
| Severe Stress | 1.88 | 8.51 | +203% | SICR watch; Stage 2 possible |

---

## 4. Helpers

```ts
// Format USD — same as ConcentrationTab helpers
fmtM(n: number): string   // "$X.XM" / "$X.XB"
fmtPct(n: number): string // "X.X%"
fmtK(n: number): string   // "$XXXk" for monthly rent

// DPD colour band
dpdColour(days: number): string
  → days <= 0  → "#15803D" (green)
  → days < 30  → "#B45309" (amber)
  → days >= 30 → "#B91C1C" (red)

// Event type badge colour
eventColour(type: EventType): string
  → "payment"       → "#15803D"
  → "late"          → "#B45309"
  → "missed"        → "#B91C1C"
  → "rating-change" → "#7C3AED"
  → "stage-change"  → "#B91C1C"
  → "trigger"       → "#B45309"
  → "deferral"      → "#0F4C5C"

// Event type label
eventLabel(type: EventType): string
  → "payment" → "Payment"  |  "late" → "Late Payment"  |  "missed" → "Missed"
  → "rating-change" → "Rating ↓"  |  "stage-change" → "Stage ↑"
  → "trigger" → "SICR Trigger"  |  "deferral" → "Deferral"

// Scenario row background
scenarioBg(name: string): string
  → "Base Case"    → "#FFFFFF"
  → "Mild Stress"  → "#FEF3C7"
  → "Severe Stress"→ "#FEE2E2"
```

---

## 5. UI Layout

### Profile Header (always visible, above tabs)

Dark `#002147` banner spanning full width of the right column:
- Left: lessee name (large, white), country · rating · N leases · $XM exposure (small, white/70%)
- Right: `<StatusPill stage={stage} label={\`Stage ${stage}\`} />`

### Tab navigation

Pill-style tab strip below header: `Overview | Leases | ECL | Timeline | Scenarios`
Same underline-style as Portfolio and ConcentrationTab sub-tabs.

### Overview tab

Migrated from existing Counterparties.tsx right column:
- Analyst note banner (left-border coloured by stage)
- 2-column KPI grid: Behavior Score · Days Overdue
- `Card` with radar chart (left) + score bars (right)
- `Card` with Restructuring Simulator (expand/collapse button + 7-option table)

### Leases tab

**KPI strip** (3 cards): Active Leases · Total Rent/mo · WA Remaining Term (yrs, weighted by EAD, computed as weighted average of `leaseEnd − 2026-05-02` across all leases for this lessee)

**Table** — columns: Lease ID · Aircraft · MSN · Rent/mo · EAD · Lease End · Stage pill

### ECL tab

**KPI strip** (4 cards): Total ECL 12m · Total ECL Lifetime · ECL Rate (total ECL LT / total EAD) · WA PD 12m

**Decomposition table** — columns: Lease · Aircraft · EAD · PD 12m · PD LT · LGD · ECL 12m · ECL LT · Stage pill

**Horizontal bar chart** (Recharts `BarChart layout="vertical"`) below table: `dataKey="ecl12m"`, one bar per lease, bars coloured by stage (S1 = `#002147`, S2 = `#B45309`, S3 = `#B91C1C`). Height scales with row count: `Math.max(160, rows * 44)` px.

### Timeline tab

**DPD bar chart** (Recharts `BarChart`): 12 monthly bars, `dataKey="daysOverdue"`, each bar coloured by `dpdColour()`. Height: 180px. X-axis: month labels. Y-axis: days, labelled "DPD". `ReferenceLine y={30}` — dashed red "30-day trigger".

**Event log table** below chart — columns: Date · Type (badge) · Description · Impact. Rows sorted newest-first. Row background tinted by event severity (missed/stage-change = red tint, late/trigger/deferral = amber tint, payment = white).

### Scenarios tab

**3-row table**, no KPI strip needed — scenario speaks for itself:
- Columns: Scenario · Description · ECL 12m · ECL Lifetime · Δ vs Base · Stage Impact
- Row backgrounds: `scenarioBg(name)` (white / amber tint / red tint)
- Δ vs Base: "—" for base row; "+X%" in amber/red for stress rows
- Brief italic macro-assumption description per row

---

## 6. State

```ts
// Inside LesseeProfilePanel
const [activeTab, setActiveTab] = useState<TabKey>("Overview");

type TabKey = "Overview" | "Leases" | "ECL" | "Timeline" | "Scenarios";

// Inherited from existing Counterparties.tsx (moved inside component):
const [showRestructuring, setShowRestructuring] = useState(false);

// Reset showRestructuring on lesseeId change:
useEffect(() => { setShowRestructuring(false); }, [lesseeId]);
```

---

## 7. Styling Conventions

- Inline `style={{}}` throughout — no CSS modules
- Colour palette: `#002147` Oxford Blue, `#B45309` amber, `#B91C1C` red, `#15803D` green, `#7C3AED` purple (rating events), `#0F4C5C` teal (deferrals), `#64748B` grey
- Profile header background: `#002147` with white text
- KPI strip grid: `display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`
- Tab pill style: same as Portfolio and ConcentrationTab — `borderBottom: activeTab === tab ? "2px solid #002147" : "2px solid transparent"`
- All existing Counterparties.tsx `restructuringOptions` data moves into `LesseeProfilePanel.tsx`

---

## 8. Out of Scope (this sprint)

- Routing to a dedicated lessee URL (`/counterparties/:id`)
- PDF/CSV export of the profile
- Editable analyst notes
- Live data adapter (all synthetic)
- Cross-lessee comparison view
