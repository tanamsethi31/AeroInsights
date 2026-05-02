# Sprint 12 F09 — Risk Mitigation Action Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Mitigations" tab to every lessee profile that lets portfolio managers select contractual/credit mitigations and instantly see the simulated ECL relief across all leases.

**Architecture:** Pure-TS `mitigationEngine.ts` owns the 6 mitigation definitions and ECL recomputation (no React, no circular imports). `MitigationsTab.tsx` is a named export that reads from the engine and receives `eclRows` as props. `LesseeProfilePanel.tsx` adds "Mitigations" as the 8th tab and passes `eclRows` down.

**Tech Stack:** React 18, TypeScript, inline styles, Recharts not required (layout is tables + cards), Lucide icons not required.

---

## File Map

| Action | Path |
|--------|------|
| **Create** | `src/app/components/counterparties/mitigationEngine.ts` |
| **Create** | `src/app/components/counterparties/MitigationsTab.tsx` |
| **Modify** | `src/app/components/counterparties/LesseeProfilePanel.tsx` (lines 9, 666, 1341) |

---

### Task 1: Create `mitigationEngine.ts` — types, mitigation data, ECL computation

**Files:**
- Create: `src/app/components/counterparties/mitigationEngine.ts`

Context: Pure TypeScript — no React imports. `LesseeECLRow` lives in `LesseeProfilePanel.tsx` and is NOT exported, so define a local input interface `ECLRowInput` that matches only the fields this engine needs (`leaseId`, `aircraft`, `stage`, `ead`, `pdLifetime`, `lgd`, `eclLifetime`). TypeScript structural typing means `LesseeECLRow[]` satisfies `ECLRowInput[]` at call sites.

- [ ] **Step 1: Create the file with all types, constants, and computation**

```ts
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
  ead: number;
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

  const totalLgdReduction  = selected.reduce((sum, m) => sum + m.lgdReduction, 0);
  const totalEadReductionPct = selected.reduce((sum, m) => sum + m.eadReduction, 0);
  const totalPdReductionPct  = selected.reduce((sum, m) => sum + m.pdReduction, 0);

  return eclRows.map(r => {
    const mitigatedEad   = r.ead        * (1 - totalEadReductionPct / 100);
    const mitigatedPdLT  = r.pdLifetime * (1 - totalPdReductionPct  / 100);
    const mitigatedLgd   = Math.max(0, r.lgd - totalLgdReduction);
    const mitigatedEclLT = (mitigatedEad * mitigatedPdLT * mitigatedLgd) / 10000;
    const delta    = mitigatedEclLT - r.eclLifetime;
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

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`. If TypeScript errors appear, the most likely cause is a typo in a `MitigationId` string literal — verify all 6 IDs match the union type.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/counterparties/mitigationEngine.ts && git commit -m "$(cat <<'EOF'
feat(f09): add mitigationEngine — 6 mitigation options, ECL recomputation

Defines MitigationOption, ECLRowInput, MitigatedECLRow types. Six mitigations
(parentGuarantee, securityDeposit, crossDefault, stepInRights, subLeaseConsent,
insuranceTrigger) with additive stacking and LGD floor at 0.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create `MitigationsTab.tsx` — full UI

**Files:**
- Create: `src/app/components/counterparties/MitigationsTab.tsx`

Context: Named export `MitigationsTab`. Props: `{ eclRows: ECLRowInput[] }`. State: `selectedIds` as `Set<MitigationId>`. Uses `computeMitigatedECLRows` from the engine. Inline styles only — no CSS modules, no Recharts needed. Imports `Card` from `"../ui/Card"` and `KpiCard` from `"../ui/KpiCard"` (both already used in this component tree).

- [ ] **Step 1: Create the file**

```tsx
// src/app/components/counterparties/MitigationsTab.tsx
import { useState } from "react";
import { Card } from "../ui/Card";
import { KpiCard } from "../ui/KpiCard";
import {
  MITIGATION_OPTIONS,
  computeMitigatedECLRows,
  type MitigationId,
  type MitigationCategory,
  type ECLRowInput,
} from "./mitigationEngine";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtM(v: number): string {
  return `$${(v / 1_000_000).toFixed(1)}M`;
}
function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

const CATEGORY_STYLE: Record<MitigationCategory, { background: string; color: string; label: string }> = {
  "credit-enhancement": { background: "#002147", color: "#FFFFFF", label: "Credit Enhancement" },
  "collateral":         { background: "#475569", color: "#FFFFFF", label: "Collateral" },
  "contractual":        { background: "#B45309", color: "#FFFFFF", label: "Contractual" },
  "operational":        { background: "#0F766E", color: "#FFFFFF", label: "Operational" },
};

// ─── MitigationsTab ───────────────────────────────────────────────────────────

export function MitigationsTab({ eclRows }: { eclRows: ECLRowInput[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<MitigationId>>(new Set());

  const toggle = (id: MitigationId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const baseEclTotal = eclRows.reduce((sum, r) => sum + r.eclLifetime, 0);

  const mitigatedRows = computeMitigatedECLRows(eclRows, [...selectedIds]);
  const mitigatedEclTotal = mitigatedRows.reduce((sum, r) => sum + r.mitigatedEclLifetime, 0);
  const relief = baseEclTotal - mitigatedEclTotal;
  const reliefPct = baseEclTotal > 0 ? (relief / baseEclTotal) * 100 : 0;

  // Standalone reliefs — each mitigation applied alone for comparison table
  const standaloneReliefs = MITIGATION_OPTIONS.map(m => {
    const rows = computeMitigatedECLRows(eclRows, [m.id]);
    const mitigatedTotal = rows.reduce((s, r) => s + r.mitigatedEclLifetime, 0);
    const r = baseEclTotal - mitigatedTotal;
    return { ...m, relief: r, reliefPct: baseEclTotal > 0 ? (r / baseEclTotal) * 100 : 0 };
  }).sort((a, b) => b.relief - a.relief);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* KPI summary bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard label="Base ECL Lifetime"     value={fmtM(baseEclTotal)} />
        <KpiCard label="Mitigated ECL Lifetime" value={fmtM(mitigatedEclTotal)} />
        <KpiCard
          label="ECL Relief"
          value={selectedIds.size === 0 ? "—" : fmtM(relief)}
          subtitle={selectedIds.size === 0 ? "Select mitigations below" : `−${reliefPct.toFixed(1)}% of base ECL`}
          deltaType={selectedIds.size > 0 && relief > 0 ? "positive" : "neutral"}
        />
      </div>

      {/* Two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "1rem", alignItems: "start" }}>

        {/* Left: Mitigation Library */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.125rem" }}>
            Mitigation Library — select to simulate
          </div>
          {MITIGATION_OPTIONS.map(m => {
            const isSelected = selectedIds.has(m.id);
            const catStyle = CATEGORY_STYLE[m.category];
            // Preview: standalone relief for this mitigation
            const previewRows = computeMitigatedECLRows(eclRows, [m.id]);
            const previewRelief = baseEclTotal - previewRows.reduce((s, r) => s + r.mitigatedEclLifetime, 0);
            return (
              <div
                key={m.id}
                onClick={() => toggle(m.id)}
                style={{
                  background: "#FFFFFF",
                  border: isSelected ? "2px solid #002147" : "1px solid #E2E8F0",
                  borderRadius: "0.5rem",
                  padding: "0.75rem",
                  cursor: "pointer",
                  transition: "border-color 150ms, box-shadow 150ms",
                  boxShadow: isSelected ? "0 0 0 3px rgba(0,33,71,0.08)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(m.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ marginTop: "2px", accentColor: "#002147", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>{m.name}</span>
                      <span style={{
                        fontSize: "0.625rem", fontWeight: 600,
                        background: catStyle.background, color: catStyle.color,
                        borderRadius: "4px", padding: "0.1rem 0.375rem",
                        textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0,
                      }}>
                        {catStyle.label}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#475569", marginBottom: "0.375rem" }}>{m.description}</div>
                    {previewRelief > 0 && (
                      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#15803D" }}>
                        saves ~{fmtM(previewRelief)} standalone
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Per-Lease Impact Table */}
        <Card title="Per-Lease ECL Impact" subtitle={selectedIds.size === 0 ? "Select mitigations on the left to see impact" : `${selectedIds.size} mitigation${selectedIds.size > 1 ? "s" : ""} applied`}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ background: "#F4F5F7" }}>
                  {["Lease", "Aircraft", "Stage", "Base ECL LT", "Mitigated ECL LT", "Delta", "Δ%"].map(h => (
                    <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mitigatedRows.map((r, i) => {
                  const hasRelief = r.delta < -0.001;
                  return (
                    <tr
                      key={r.leaseId}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        background: hasRelief ? "rgba(21,128,61,0.06)" : i % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                      }}
                    >
                      <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>{r.leaseId}</td>
                      <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#0F172A" }}>{r.aircraft}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <span style={{
                          fontSize: "0.75rem", fontWeight: 600,
                          color: r.stage === "3" ? "#B91C1C" : r.stage === "2" ? "#B45309" : "#15803D",
                          background: r.stage === "3" ? "rgba(185,28,28,0.08)" : r.stage === "2" ? "rgba(180,83,9,0.08)" : "rgba(21,128,61,0.08)",
                          borderRadius: "4px", padding: "0.1rem 0.4rem",
                        }}>S{r.stage}</span>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#475569" }}>{fmtM(r.baseEclLifetime)}</td>
                      <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: hasRelief ? "#15803D" : "#0F172A" }}>{fmtM(r.mitigatedEclLifetime)}</td>
                      <td style={{ padding: "0.5rem 0.75rem", color: hasRelief ? "#15803D" : "#94A3B8" }}>
                        {hasRelief ? fmtM(r.delta) : "—"}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: hasRelief ? "#15803D" : "#94A3B8" }}>
                        {hasRelief ? `${r.deltaPct.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals footer */}
                <tr style={{ background: "#F4F5F7", borderTop: "2px solid #E2E8F0", fontWeight: 700 }}>
                  <td colSpan={3} style={{ padding: "0.5rem 0.75rem", color: "#0F172A", fontSize: "0.8125rem" }}>Total</td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#0F172A" }}>{fmtM(baseEclTotal)}</td>
                  <td style={{ padding: "0.5rem 0.75rem", color: relief > 0 ? "#15803D" : "#0F172A" }}>{fmtM(mitigatedEclTotal)}</td>
                  <td style={{ padding: "0.5rem 0.75rem", color: relief > 0 ? "#15803D" : "#94A3B8" }}>
                    {relief > 0.001 ? fmtM(-relief) : "—"}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: relief > 0 ? "#15803D" : "#94A3B8" }}>
                    {relief > 0.001 ? `−${reliefPct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Standalone Comparison Table */}
      <Card
        title="Standalone Mitigation Comparison"
        subtitle="ECL relief if each mitigation were applied alone — sorted by impact"
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "#F4F5F7" }}>
                {["Mitigation", "Category", "ECL Relief ($M)", "Relief %", "Implementation", "Conditions"].map(h => (
                  <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standaloneReliefs.map((m, i) => {
                const catStyle = CATEGORY_STYLE[m.category];
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                    <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#0F172A" }}>{m.name}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <span style={{
                        fontSize: "0.6875rem", fontWeight: 600,
                        background: catStyle.background, color: catStyle.color,
                        borderRadius: "4px", padding: "0.1rem 0.375rem",
                        textTransform: "uppercase", letterSpacing: "0.04em",
                      }}>
                        {catStyle.label}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: "#15803D", fontVariantNumeric: "tabular-nums" }}>
                      {fmtM(m.relief)}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#15803D", fontVariantNumeric: "tabular-nums" }}>
                      −{m.reliefPct.toFixed(1)}%
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontSize: "0.75rem" }}>{m.implementationNote}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontSize: "0.75rem", maxWidth: "220px" }}>{m.conditions}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`. `MitigationsTab` isn't wired yet so the build just checks TypeScript compiles — any import errors from `mitigationEngine` will surface here.

- [ ] **Step 3: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/counterparties/MitigationsTab.tsx && git commit -m "$(cat <<'EOF'
feat(f09): add MitigationsTab — mitigation cards, per-lease ECL impact, comparison table

Named export. Checkbox-selectable mitigation cards with standalone preview relief.
Per-lease impact table updates reactively with green tinting on relief rows and
totals footer. Standalone comparison table sorted by impact descending.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire `MitigationsTab` into `LesseeProfilePanel`

**Files:**
- Modify: `src/app/components/counterparties/LesseeProfilePanel.tsx`

Context: Three small changes. Current state:
- Line 9: `import { WatchlistTab } from "./WatchlistTab";`
- Line 666: `const TABS = ["Overview", "Leases", "ECL", "Timeline", "Scenarios", "Behaviour", "Watchlist"] as const;`
- Line 1341: `{activeTab === "Watchlist" && <WatchlistTab lesseeId={lesseeId} />}`

`eclRows` is already destructured from `PROFILE_DATA[lesseeId]` at the top of the `LesseeProfilePanel` function body — no new destructuring needed. The `ECLRowInput` type from `mitigationEngine.ts` is satisfied structurally by `LesseeECLRow[]` — no cast needed.

- [ ] **Step 1: Add MitigationsTab import**

Find:
```tsx
import { WatchlistTab } from "./WatchlistTab";
```

Replace with:
```tsx
import { WatchlistTab } from "./WatchlistTab";
import { MitigationsTab } from "./MitigationsTab";
```

- [ ] **Step 2: Add "Mitigations" to TABS**

Find:
```tsx
const TABS = ["Overview", "Leases", "ECL", "Timeline", "Scenarios", "Behaviour", "Watchlist"] as const;
```

Replace with:
```tsx
const TABS = ["Overview", "Leases", "ECL", "Timeline", "Scenarios", "Behaviour", "Watchlist", "Mitigations"] as const;
```

- [ ] **Step 3: Add render wire**

Find:
```tsx
        {activeTab === "Watchlist" && <WatchlistTab lesseeId={lesseeId} />}
```

Replace with:
```tsx
        {activeTab === "Watchlist"   && <WatchlistTab lesseeId={lesseeId} />}
        {activeTab === "Mitigations" && <MitigationsTab eclRows={eclRows} />}
```

- [ ] **Step 4: Verify build passes**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build 2>&1 | tail -5
```
Expected: `✓ built in`. Common error: TypeScript complaining that `LesseeECLRow[]` doesn't satisfy `ECLRowInput[]` — this shouldn't happen (structural typing) but if it does, add `as ECLRowInput[]` to the prop: `<MitigationsTab eclRows={eclRows as ECLRowInput[]} />` and add `import type { ECLRowInput } from "./mitigationEngine"` to the imports at the top of `LesseeProfilePanel.tsx`.

- [ ] **Step 5: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add src/app/components/counterparties/LesseeProfilePanel.tsx && git commit -m "$(cat <<'EOF'
feat(f09): wire MitigationsTab as 8th tab in LesseeProfilePanel

Adds "Mitigations" to TABS, wires render passing eclRows, imports MitigationsTab.
All 6 lessees now show the mitigation simulator tab.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- ✅ 8th "Mitigations" tab in `LesseeProfilePanel`: Task 3
- ✅ 6 mitigation options with ECL parameter effects: Task 1 `MITIGATION_OPTIONS`
- ✅ Additive stacking with LGD floor at 0: Task 1 `computeMitigatedECLRows`
- ✅ KPI bar (Base ECL LT, Mitigated ECL LT, ECL Relief): Task 2 KPI grid
- ✅ Mitigation library cards with checkbox + category badge + preview relief: Task 2 left panel
- ✅ Per-lease impact table with green tinting + totals footer: Task 2 right panel
- ✅ Standalone comparison table sorted by relief desc: Task 2 bottom section
- ✅ Selected card border `2px solid #002147`: Task 2 card style
- ✅ Category badge colours (Oxford Blue / slate / amber / teal): Task 2 `CATEGORY_STYLE`
- ✅ Emirates shows smaller absolute relief than Aeromexico: inherent from ECL data (engine is correct)
- ✅ LGD capped at 0: `Math.max(0, r.lgd - totalLgdReduction)` in engine

**Placeholder scan:** None. All code blocks complete and self-contained.

**Type consistency:**
- `MitigationId` defined in Task 1, used as `Set<MitigationId>` state in Task 2 ✓
- `ECLRowInput` defined in Task 1, used as prop type in Task 2, passed from Task 3 ✓
- `computeMitigatedECLRows(eclRows, [...selectedIds])` — signature matches Task 1 definition ✓
- `MitigatedECLRow.delta` is `mitigatedEclLifetime − baseEclLifetime` (negative = relief); UI checks `r.delta < -0.001` for "hasRelief" ✓
- `standaloneReliefs` computes `baseEclTotal - mitigatedTotal` (positive = relief) — consistent with how `relief` is computed for the KPI bar ✓
- `KpiCard` does NOT accept `valueStyle`. The relief tile uses `deltaType="positive"` when relief > 0 to show the green trend icon. Value text remains dark (`#0F172A`) — this is intentional. ✓
