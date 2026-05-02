# Sprint 12 F09 — Risk Mitigation Action Simulator Design

## Goal

Add a "Mitigations" tab (8th tab) to `LesseeProfilePanel` that lets portfolio managers select one or more contractual/credit mitigations and immediately see the simulated ECL relief across all leases for that lessee — without leaving the lessee profile context.

---

## Background

Portfolio managers monitoring distressed lessees (Stage 2/3) need to model the ECL impact of remediation actions before committing to legal or operational steps. Today there is no in-app way to quantify "if we enforce step-in rights, what does that do to our ECL?" The simulator makes this concrete and auditable.

**Target audience:** Portfolio managers deciding which mitigation to pursue; risk analysts preparing workout memos; compliance officers reviewing ECL inputs for IFRS 9 staging decisions.

---

## Architecture

### File changes

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/app/components/counterparties/mitigationEngine.ts` | Pure TS — mitigation definitions, ECL recomputation, exports |
| **Create** | `src/app/components/counterparties/MitigationsTab.tsx` | React UI — mitigation cards, per-lease impact table, comparison table |
| **Modify** | `src/app/components/counterparties/LesseeProfilePanel.tsx` | Add "Mitigations" as 8th tab; pass `eclRows` + `lesseeId` to `MitigationsTab` |

---

## Signal Engine (`mitigationEngine.ts`)

### Types

```ts
export type MitigationId =
  | "parentGuarantee"
  | "securityDeposit"
  | "crossDefault"
  | "stepInRights"
  | "subLeaseConsent"
  | "insuranceTrigger";

export type MitigationCategory =
  | "credit-enhancement"
  | "collateral"
  | "contractual"
  | "operational";

export interface MitigationOption {
  id: MitigationId;
  name: string;
  description: string;
  category: MitigationCategory;
  lgdReduction: number;   // percentage points subtracted from LGD (e.g. 20 → LGD − 20pp)
  eadReduction: number;   // % reduction applied to EAD (e.g. 15 → EAD × 0.85)
  pdReduction: number;    // % reduction applied to PD (e.g. 8 → PD × 0.92)
  implementationNote: string;
  conditions: string;
}

export interface MitigatedECLRow {
  leaseId: string;
  aircraft: string;
  stage: "1" | "2" | "3";
  ead: number;
  baseEclLifetime: number;
  mitigatedEclLifetime: number;
  delta: number;         // mitigatedEclLifetime − baseEclLifetime (negative = relief)
  deltaPct: number;      // delta / baseEclLifetime × 100
}
```

### Six mitigations

```ts
export const MITIGATION_OPTIONS: MitigationOption[] = [
  {
    id: "parentGuarantee",
    name: "Parent Guarantee",
    description: "Obtain a financial guarantee from a rated parent entity, reducing loss severity on default.",
    category: "credit-enhancement",
    lgdReduction: 30,
    eadReduction: 0,
    pdReduction: 0,
    implementationNote: "4–8 weeks; requires parent rated BBB− or above; legal review.",
    conditions: "Parent entity must be investment-grade rated and willing to provide unlimited guarantee.",
  },
  {
    id: "securityDeposit",
    name: "Additional Security Deposit",
    description: "Require lessee to post additional cash collateral, directly reducing net exposure at default.",
    category: "collateral",
    lgdReduction: 0,
    eadReduction: 15,
    pdReduction: 0,
    implementationNote: "2–4 weeks; cash transfer; no legal complexity.",
    conditions: "Lessee must have sufficient liquidity to fund the deposit without triggering further distress.",
  },
  {
    id: "crossDefault",
    name: "Cross-Default Acceleration",
    description: "Invoke cross-default clause to accelerate lease obligations, shortening the default exposure window.",
    category: "contractual",
    lgdReduction: 5,
    eadReduction: 0,
    pdReduction: 8,
    implementationNote: "1–2 weeks; notice to lessee; triggers SICR review.",
    conditions: "Cross-default clause must be present in lease agreement and applicable event of default must have occurred.",
  },
  {
    id: "stepInRights",
    name: "Step-in Rights",
    description: "Enforce lessor step-in rights to repossess and re-lease the aircraft to an alternative operator.",
    category: "operational",
    lgdReduction: 20,
    eadReduction: 0,
    pdReduction: 0,
    implementationNote: "8–16 weeks; repossession logistics; jurisdiction-dependent (CTC).",
    conditions: "CTC Art. XI(2) protections must apply; no automatic stay preventing repossession in local jurisdiction.",
  },
  {
    id: "subLeaseConsent",
    name: "Sub-Lease Consent Withholding",
    description: "Withhold consent to sub-lease, preserving operational leverage and recovery negotiating position.",
    category: "contractual",
    lgdReduction: 10,
    eadReduction: 0,
    pdReduction: 0,
    implementationNote: "Immediate; no implementation cost; may require legal confirmation.",
    conditions: "Sub-lease consent right must be reserved in original lease agreement.",
  },
  {
    id: "insuranceTrigger",
    name: "Insurance Trigger",
    description: "Trigger aviation lessor insurance policy on default, transferring loss to insurer.",
    category: "credit-enhancement",
    lgdReduction: 25,
    eadReduction: 0,
    pdReduction: 0,
    implementationNote: "2–6 weeks; insurance claim process; subject to policy terms.",
    conditions: "Active lessor insurance policy with no exclusions applicable to this lessee's default scenario.",
  },
];
```

### Computation

Mitigations stack additively across selected options. Caps prevent negative LGD.

```ts
export function computeMitigatedECLRows(
  eclRows: LesseeECLRow[],
  selectedIds: MitigationId[]
): MitigatedECLRow[] {
  const selected = MITIGATION_OPTIONS.filter(m => selectedIds.includes(m.id));

  const totalLgdReduction = selected.reduce((sum, m) => sum + m.lgdReduction, 0);
  const totalEadReductionPct = selected.reduce((sum, m) => sum + m.eadReduction, 0);
  const totalPdReductionPct = selected.reduce((sum, m) => sum + m.pdReduction, 0);

  return eclRows.map(r => {
    const mitigatedEad = r.ead * (1 - totalEadReductionPct / 100);
    const mitigatedPdLT = r.pdLifetime * (1 - totalPdReductionPct / 100);
    const mitigatedLgd = Math.max(0, r.lgd - totalLgdReduction);
    const mitigatedEclLT = (mitigatedEad * mitigatedPdLT * mitigatedLgd) / 10000;
    const delta = mitigatedEclLT - r.eclLifetime;
    const deltaPct = r.eclLifetime > 0 ? (delta / r.eclLifetime) * 100 : 0;
    return {
      leaseId: r.leaseId,
      aircraft: r.aircraft,
      stage: r.stage,
      ead: r.ead,
      baseEclLifetime: r.eclLifetime,
      mitigatedEclLifetime: mitigatedEclLT,
      delta,
      deltaPct,
    };
  });
}
```

Exports: `MITIGATION_OPTIONS`, `MitigationOption`, `MitigationId`, `MitigatedECLRow`, `computeMitigatedECLRows`.

---

## MitigationsTab Component

**File:** `src/app/components/counterparties/MitigationsTab.tsx`

**Props:** `{ eclRows: LesseeECLRow[] }`

State: `selectedIds: Set<MitigationId>` — toggled by checkbox on each card.

### Layout (top → bottom)

**1. KPI summary bar (3 tiles)**
- Base ECL LT (total across all leases)
- Mitigated ECL LT (recomputed from selected mitigations)
- ECL Relief: `base − mitigated` shown as `$X.XM (−XX%)` in green when > 0, grey when nothing selected

**2. Two-column body**

*Left: Mitigation Library (card grid, 1 column)*
Each card:
- Checkbox (checked = selected)
- Name + category badge (colour-coded: credit-enhancement = Oxford Blue, collateral = slate, contractual = amber, operational = teal)
- One-line description
- Preview relief: `saves ~$X.XM` computed against this lessee's base ECL

*Right: Per-Lease Impact Table*
Columns: `Lease | Aircraft | Stage | Base ECL LT | Mitigated ECL LT | Delta | Δ%`
- Delta column: green text + tinted row when relief > 0; grey when 0 selected
- Footer row: totals

**3. Standalone Comparison Table (full width)**
Header: "Compare mitigations individually — standalone ECL relief if applied alone"
Columns: `Mitigation | Category | ECL Relief ($M) | Relief % | Implementation | Conditions`
Each of the 6 mitigations shown individually (not affected by checkbox state).
Sorted by ECL relief descending.

---

## LesseeProfilePanel Changes

**TABS constant:** Add `"Mitigations"` as 8th entry.

**Import:** `import { MitigationsTab } from "./MitigationsTab";`

**Render:** `{activeTab === "Mitigations" && <MitigationsTab eclRows={eclRows} />}`

No changes to PROFILE_DATA or LesseeECLRow — all computation is in the engine.

---

## Styling Conventions

- Inline `style={{}}` — no CSS modules
- Oxford Blue `#002147` primary
- Category badge colours:
  - `credit-enhancement` → `#002147` bg, white text
  - `collateral` → `#475569` bg, white text
  - `contractual` → `#B45309` bg, white text (amber)
  - `operational` → `#0F766E` bg, white text (teal)
- ECL relief: `#15803D` green text; `deltaPct` formatted as `−XX.X%`
- Selected card border: `2px solid #002147`; unselected: `1px solid #E2E8F0`
- Row tint when relief > 0: `background: rgba(21,128,61,0.06)`

---

## Success Criteria

1. `npm run build` zero errors
2. "Mitigations" tab visible for all 6 lessees
3. Selecting/deselecting mitigation cards updates KPI bar, per-lease table, and preview reliefs in real time
4. Standalone comparison table always shows all 6 mitigations with correct standalone ECL deltas
5. Emirates (all Stage 1, low ECL) shows smaller absolute relief than Aeromexico (Stage 3, high ECL) — proportional to base ECL
6. Stacking all 6 mitigations for AEROMEX yields the maximum relief shown in the KPI bar
7. LGD is capped at 0 (no negative LGD)

---

## Out of Scope

- Persisting selected mitigations to localStorage or backend
- Legal workflow / approval trail for mitigations
- Applying mitigated ECL back into the main ECL tab or portfolio totals
- Interaction effects between mitigations beyond additive stacking
- More than 6 mitigation types
