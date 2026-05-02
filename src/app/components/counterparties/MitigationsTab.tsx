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
        <KpiCard label="Base ECL LT"      value={fmtM(baseEclTotal)} />
        <KpiCard label="Mitigated ECL LT" value={fmtM(mitigatedEclTotal)} />
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
