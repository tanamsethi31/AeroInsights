// src/app/components/counterparties/MitigationsTab.tsx
import { useState, useMemo } from "react";
import { Star } from "lucide-react";
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

// Cost estimates per mitigation lever (low/high in $k)
const LEVER_COSTS: Record<string, { low: number; high: number; unit: string }> = {
  parentGuarantee:  { low: 15,  high: 40,  unit: "legal"  },
  securityDeposit:  { low: 50,  high: 200, unit: "cash"   },
  crossDefault:     { low: 5,   high: 20,  unit: "legal"  },
  stepInRights:     { low: 30,  high: 80,  unit: "setup"  },
  subLeaseConsent:  { low: 5,   high: 15,  unit: "legal"  },
  insuranceTrigger: { low: 3,   high: 10,  unit: "admin"  },
};

function costMid(id: string): number {
  const c = LEVER_COSTS[id];
  return c ? (c.low + c.high) / 2 : 50;
}

function costLabel(id: string): string {
  const c = LEVER_COSTS[id];
  if (!c) return "—";
  return `$${c.low}k–$${c.high}k ${c.unit}`;
}

// Net benefit score: 70% cost-efficiency + 30% absolute relief (0–100 scale, normalised within set)
function computeScores(items: Array<{ id: string; relief: number }>): Map<string, number> {
  const efficiencies = items.map(({ id, relief }) => ({
    id,
    efficiency: costMid(id) > 0 ? (relief / 1_000_000) / (costMid(id) / 1000) : 0,
    relief,
  }));
  const maxEff    = Math.max(...efficiencies.map((e) => e.efficiency), 1);
  const maxRelief = Math.max(...efficiencies.map((e) => e.relief), 1);
  const scores = new Map<string, number>();
  efficiencies.forEach(({ id, efficiency, relief }) => {
    const score = Math.round((efficiency / maxEff) * 70 + (relief / maxRelief) * 30);
    scores.set(id, Math.min(100, Math.max(0, score)));
  });
  return scores;
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

  // Standalone reliefs — memoized; only recompute when eclRows changes
  const standaloneReliefs = useMemo(() =>
    MITIGATION_OPTIONS.map(m => {
      const rows = computeMitigatedECLRows(eclRows, [m.id]);
      const mitigatedTotal = rows.reduce((s, r) => s + r.mitigatedEclLifetime, 0);
      const reliefAmount = baseEclTotal - mitigatedTotal;
      return { ...m, relief: reliefAmount, reliefPct: baseEclTotal > 0 ? (reliefAmount / baseEclTotal) * 100 : 0 };
    }).sort((a, b) => b.relief - a.relief),
  [eclRows, baseEclTotal]);

  // Net benefit scores keyed by mitigation ID
  const netBenefitScores = useMemo(
    () => computeScores(standaloneReliefs.map(({ id, relief }) => ({ id, relief }))),
    [standaloneReliefs],
  );

  // Top recommendation = highest net benefit score with meaningful relief
  const topRec = useMemo(() => {
    const withScore = standaloneReliefs
      .map((m) => ({ ...m, score: netBenefitScores.get(m.id) ?? 0 }))
      .filter((m) => m.relief > 0)
      .sort((a, b) => b.score - a.score);
    return withScore[0] ?? null;
  }, [standaloneReliefs, netBenefitScores]);

  // Precomputed per-card preview relief — avoids 6 engine calls inside render
  const previewReliefsMap = useMemo(() => {
    const map = new Map<MitigationId, number>();
    for (const m of MITIGATION_OPTIONS) {
      const rows = computeMitigatedECLRows(eclRows, [m.id]);
      const mitigatedTotal = rows.reduce((s, r) => s + r.mitigatedEclLifetime, 0);
      map.set(m.id, baseEclTotal - mitigatedTotal);
    }
    return map;
  }, [eclRows, baseEclTotal]);

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
            const previewRelief = previewReliefsMap.get(m.id) ?? 0;
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

      {/* Top Recommendation Banner */}
      {topRec && (
        <div style={{
          background: "#F0FDF4", border: "1px solid #BBF7D0", borderLeft: "4px solid #16A34A",
          borderRadius: "0.75rem", padding: "1rem 1.25rem",
          display: "flex", alignItems: "flex-start", gap: "0.875rem",
        }}>
          <div style={{ fontSize: "1.25rem", lineHeight: 1 }}>✦</div>
          <div>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#15803D", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
              Most Cost-Effective Mitigation
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#14532D" }}>
              {topRec.name}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#166534", marginTop: "0.25rem" }}>
              Standalone ECL relief of {fmtM(topRec.relief)} (−{topRec.reliefPct.toFixed(1)}%) at an estimated cost of {costLabel(topRec.id)}.
              Net benefit score: <strong>{netBenefitScores.get(topRec.id) ?? "—"}/100</strong>.
            </div>
          </div>
        </div>
      )}

      {/* Ranked Comparison Table */}
      <Card
        title="Mitigation Lever Ranking"
        subtitle="Each lever applied in isolation — ranked by net benefit score (cost-efficiency × ECL relief)"
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "#F4F5F7" }}>
                {["#", "Mitigation", "Category", "ECL Relief", "Relief %", "Est. Cost", "Net Score", "Implementation"].map(h => (
                  <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standaloneReliefs
                .map((m) => ({ ...m, score: netBenefitScores.get(m.id) ?? 0 }))
                .sort((a, b) => b.score - a.score)
                .map((m, i) => {
                  const catStyle = CATEGORY_STYLE[m.category];
                  const score = m.score;
                  const scoreColor = score >= 70 ? "#15803D" : score >= 40 ? "#B45309" : "#94A3B8";
                  return (
                    <tr key={m.id} style={{ borderBottom: "1px solid #F1F5F9", background: i === 0 ? "#F0FDF4" : i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                      <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: i === 0 ? "#15803D" : "#94A3B8", fontSize: "0.75rem" }}>
                        {i === 0 ? <Star size={12} style={{ color: "#F59E0B", fill: "#F59E0B" }} /> : i + 1}
                      </td>
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
                      <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                        {costLabel(m.id)}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div style={{ flex: 1, height: "6px", background: "#E2E8F0", borderRadius: "3px", minWidth: "48px" }}>
                            <div style={{ height: "100%", width: `${score}%`, background: scoreColor, borderRadius: "3px", transition: "width 400ms ease" }} />
                          </div>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: scoreColor, minWidth: "32px" }}>
                            {score}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontSize: "0.75rem" }}>{m.implementationNote}</td>
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
