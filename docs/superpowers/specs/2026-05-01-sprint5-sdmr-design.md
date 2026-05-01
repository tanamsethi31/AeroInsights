# Sprint 5 — F07: Security Deposit & MR Logic Design

**Date:** 2026-05-01  
**Status:** Approved  
**Scope:** New "SD / MR" sub-tab on Portfolio page — per-lease SD records, MR ledger by component, refund cap enforcement, EOL cash compensation toggle, and LGD offset display feeding back into ECL outputs

---

## 1. Architecture

### File changes

| File | Change |
|------|--------|
| `src/app/components/portfolio/SDMRTab.tsx` | **New** — self-contained SD/MR tab: data, types, computed value functions, and all UI (~400 lines) |
| `src/app/pages/Portfolio.tsx` | **Modify** — add `"SD / MR"` to `tabs` array; import and render `<SDMRTab />` |

No separate data file. All synthetic data lives inside `SDMRTab.tsx`. Follows the same isolation pattern as `IAS36Tab.tsx` and `JurisdictionDetail.tsx`.

---

## 2. Data Model

```ts
interface SDRecord {
  type: "Cash" | "LC";           // LC = Letter of Credit
  amount: number;                // USD
  currency: string;
  refundTriggers: string[];      // conditions under which SD is returned to lessee
  governingLaw: string;
}

interface MRComponent {
  component: "Airframe HSI" | "Engine PR" | "LLPs" | "Landing Gear" | "APU";
  rateBasis: "$/FH" | "$/cycle";
  rateAmount: number;
  unitsAccumulated: number;      // FH or cycles accumulated since lease start
  cumulativeBalance: number;     // = rateAmount × unitsAccumulated (pre-computed)
  refundable: boolean;
  capRule: string;               // e.g. "Max 18 months' contributions"
  evidencedCost: number;         // maintenance invoice total for refund cap test
}

interface LeaseSDMR {
  leaseId: string;
  lessee: string;
  aircraft: string;
  eadNum: number;                // mirrors ECL dataset
  baseLGD: number;               // % — from ECL dataset
  sd: SDRecord;
  mrComponents: MRComponent[];
  returnCondition: "half-life" | "full-life";   // default display state per lease
}
```

### Dataset — 6 leases (matching Aircraft Register)

| Lease ID | Lessee | Aircraft | SD Type | SD Amount |
|----------|--------|----------|---------|-----------|
| LSE-2019-001 | IndiGo Airlines | A320neo | Cash | $1.71M (6 mo rent) |
| LSE-2020-014 | Aeromexico | B737-800 | LC | $1.86M (6 mo rent) |
| LSE-2021-022 | Emirates | B777-300ER | Cash | $1.24M (1 mo rent) |
| LSE-2020-031 | SriLankan Airlines | A330-300 | Cash | $1.44M (3 mo rent) |
| LSE-2022-009 | Ryanair | B737 MAX 8 | LC | $0.34M (1 mo rent) |
| LSE-2018-047 | Air France | A350-900 | Cash | $0.96M (1 mo rent) |

SD amounts reflect credit risk: Stage 3 lessees (IndiGo, Aeromexico) carry 6-month deposits; Stage 1 lessees carry 1 month. Each lease has 5 MR components with realistic rates and accumulated balances based on years elapsed since lease start.

---

## 3. Computed Value Functions

All pure functions, no state:

```ts
// Refund cap enforcement per component
mrNetRefund(comp: MRComponent): number
  → comp.refundable ? Math.min(comp.cumulativeBalance, comp.evidencedCost) : 0

// Total balance held in MR account for a lease
totalMRBalance(lease: LeaseSDMR): number
  → sum of comp.cumulativeBalance across all components

// Conservative LGD offset: SD + non-refundable MR (lessor keeps in default regardless)
conservativeLGDOffset(lease: LeaseSDMR): number
  → (lease.sd.amount + Σ non-refundable comp balances) / lease.eadNum

// Optimistic LGD offset: SD + all MR (assumes full maintenance evidence)
optimisticLGDOffset(lease: LeaseSDMR): number
  → (lease.sd.amount + Σ all comp balances) / lease.eadNum

// Adjusted LGD using conservative offset
adjustedLGD(lease: LeaseSDMR): number
  → lease.baseLGD * (1 - conservativeLGDOffset(lease))

// EOL cash compensation delta (lessee owes lessor if negative remaining life vs condition)
// half-life: baseline = 50% interval remaining → no comp at exactly half-life
// full-life: baseline = 100% interval → lessee compensates for any shortfall below full
eolCompensation(lease: LeaseSDMR, condition: "half-life" | "full-life"): number
  → computed per component as: shortfall_units × rateAmount, summed
  → positive = lessee owes lessor; negative = lessor owes lessee (over-reserve)
```

---

## 4. UI Layout

### KPI Strip (top, 3 cards)

| Card | Value |
|------|-------|
| Total SD Posted | Sum of all SD amounts across 6 leases |
| Total MR Reserves | Sum of all MR cumulative balances |
| Wtd Avg LGD Reduction | Weighted average pp reduction across portfolio |

### Per-Lease Accordion Table

**Collapsed row columns:**

| Lease ID | Lessee | Aircraft | SD Type | SD Amount | MR Balance | Return Condition | EOL Compensation | LGD Offset | ▶ |
|---|---|---|---|---|---|---|---|---|---|

- **Return Condition**: inline toggle button (half-life / full-life) — changes EOL Compensation cell value live
- **LGD Offset**: displayed as `X.X pp` with a small badge showing conservative vs. optimistic range
- **▶**: expand/collapse chevron

**Expanded panel (full-width below row):**

Three sections side by side:

**Left — Security Deposit card:**
- Type badge: `Cash` (blue) or `LC` (purple)
- Amount and currency
- Refund triggers as bullet list
- Governing law clause

**Centre — MR Ledger table:**

| Component | Rate | Basis | Accum. | Balance | Refundable | Cap Rule |
|---|---|---|---|---|---|---|
| Airframe HSI | $X | /FH | Xk FH | $XM | Yes/No | … |
| Engine PR | $X | /FH | Xk FH | $XM | Yes/No | … |
| LLPs | $X | /cycle | Xk cy | $XM | No | … |
| Landing Gear | $X | /FH | Xk FH | $XM | Yes | … |
| APU | $X | /FH | Xk FH | $XM | Yes | … |

Below table: **Refund Cap Test row** — `Refund = min(balance, evidenced cost)` shown per refundable component.

**Right — LGD Offset Breakdown card:**

| Component | Amount | Notes |
|---|---|---|
| Security Deposit | $XM | Full recovery assumed |
| Non-refundable MR | $XM | Lessor retains in default |
| Refundable MR (cap-tested) | $XM | Conditional on evidence |
| **Conservative offset** | X.X pp | SD + non-refundable only |
| **Optimistic offset** | X.X pp | SD + all MR |
| Base LGD | X% | From ECL dataset |
| **Adjusted LGD** | X% | Applying conservative offset |

### ECL Feedback Table (bottom of tab)

Read-only summary across all 6 leases:

| Lease | Lessee | Base LGD | Conservative Adj. LGD | Optimistic Adj. LGD | ECL Δ (conservative) |
|---|---|---|---|---|---|

Footer note: "SD/MR LGD adjustments shown for reference. Full integration into weighted ECL computation delivered in Sprint 12 (F09)."

---

## 5. Return Condition Logic

- **Half-life return**: lessee must return aircraft with at least 50% of each maintenance interval remaining. EOL compensation = `Σ max(0, (half_interval_units − remaining_units)) × rateAmount`. If aircraft is returned with *more* than half life on all components, compensation is zero (no over-reserve refund under half-life condition).
- **Full-life return**: lessee must return fully refurbished. EOL compensation = `Σ max(0, (full_interval_units − remaining_units)) × rateAmount`. Negative values (lessor owes lessee) are possible if lessee over-maintained.
- Toggle is per-lease local state; changing it recalculates EOL compensation live in the collapsed row and in the expanded panel.

---

## 6. Styling Conventions

- Follows existing inline `style={{}}` pattern throughout Portfolio.tsx and IAS36Tab.tsx
- Colour palette: `#002147` Oxford Blue, `#15803D` green, `#B45309` amber, `#B91C1C` red, `#0369A1` blue (LC badge), `#7C3AED` purple (LC type)
- `<Card>` component for SD card and LGD breakdown card
- `<StatusPill>` for refundable yes/no, return condition badge
- Accordion expand/collapse using local `Set<string>` state — same pattern as IAS36Tab DCF workings

---

## 7. Out of Scope (this sprint)

- Live MR rate ingestion from Cirium or lessor ERP
- Editable MR rate inputs (read-only synthetic data at MVP)
- Actual ECL recalculation with adjusted LGD (Sprint 12)
- PDF/export of SD summary
- Multi-currency conversion (all amounts displayed in USD)
