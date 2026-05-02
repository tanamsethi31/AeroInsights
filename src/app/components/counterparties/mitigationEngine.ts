// src/app/components/counterparties/mitigationEngine.ts

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
  lgdReduction: number;      // percentage points subtracted from LGD (e.g. 20 → LGD − 20pp)
  eadReduction: number;      // % reduction applied to EAD (e.g. 15 → EAD × 0.85)
  pdReduction: number;       // % reduction applied to PD lifetime (e.g. 8 → PD × 0.92)
  implementationNote: string;
  conditions: string;
}

// Minimal input shape — LesseeECLRow from LesseeProfilePanel satisfies this structurally
export interface ECLRowInput {
  leaseId: string;
  aircraft: string;
  stage: "1" | "2" | "3";
  ead: number;
  pdLifetime: number;
  lgd: number;
  eclLifetime: number;
}

export interface MitigatedECLRow {
  leaseId: string;
  aircraft: string;
  stage: "1" | "2" | "3";
  baseEad: number;
  mitigatedEad: number;
  baseEclLifetime: number;
  mitigatedEclLifetime: number;
  delta: number;      // mitigatedEclLifetime − baseEclLifetime (negative = relief)
  deltaPct: number;   // delta / baseEclLifetime × 100
}

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

// Mitigations stack additively. LGD is capped at 0.
// ECL = (EAD × (1 − eadReduction/100)) × (PD × (1 − pdReduction/100)) × max(0, LGD − lgdReduction) / 10000
export function computeMitigatedECLRows(
  eclRows: ECLRowInput[],
  selectedIds: MitigationId[]
): MitigatedECLRow[] {
  const selected = MITIGATION_OPTIONS.filter(m => selectedIds.includes(m.id));

  const totalLgdReduction    = selected.reduce((sum, m) => sum + m.lgdReduction, 0);
  const totalEadReductionPct = selected.reduce((sum, m) => sum + m.eadReduction, 0);
  const totalPdReductionPct  = selected.reduce((sum, m) => sum + m.pdReduction, 0);

  return eclRows.map(r => {
    const mitigatedEad   = r.ead        * Math.max(0, 1 - totalEadReductionPct / 100);
    const mitigatedPdLT  = r.pdLifetime * Math.max(0, 1 - totalPdReductionPct  / 100);
    const mitigatedLgd   = Math.max(0, r.lgd - totalLgdReduction);
    const mitigatedEclLT = (mitigatedEad * mitigatedPdLT * mitigatedLgd) / 10000;
    const delta    = mitigatedEclLT - r.eclLifetime;
    const deltaPct = r.eclLifetime > 0 ? (delta / r.eclLifetime) * 100 : 0;
    return {
      leaseId: r.leaseId,
      aircraft: r.aircraft,
      stage: r.stage,
      baseEad: r.ead,
      mitigatedEad: mitigatedEad,
      baseEclLifetime: r.eclLifetime,
      mitigatedEclLifetime: mitigatedEclLT,
      delta,
      deltaPct,
    };
  });
}
