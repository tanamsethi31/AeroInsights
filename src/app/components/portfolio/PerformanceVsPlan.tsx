import { useMemo } from "react";
import { Card } from "../ui/Card";
import { KpiCard } from "../ui/KpiCard";
import { StatusPill } from "../ui/StatusPill";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PerfRecord {
  leaseId: string;
  lessee: string;
  aircraft: string;
  /** Contracted monthly rent (USD) */
  monthlyRentUSD: number;
  /** Months elapsed since lease start as of report date */
  monthsElapsed: number;
  /** Actual rent collection rate 0–100 */
  collectionPct: number;
  /** MR accrual rate per month at underwriting (USD) */
  mrProjectedMonthly: number;
  /** Actual MR balance held today (USD) */
  actualMRBalance: number;
  /** IFRS 9 stage at lease origination */
  originationStage: "1" | "2" | "3";
  /** Current IFRS 9 stage */
  currentStage: "1" | "2" | "3";
  /** Originally contracted lease end date */
  plannedEnd: string;
  /** Current projected end date */
  projectedEnd: string;
}

// ─── Dataset ──────────────────────────────────────────────────────────────────
// Underwriting assumptions vs. actuals as of 2026-05-07.
// MR actuals for LSE-2019-001 through LSE-2018-047 sourced from SDMRTab ledger.
// Remaining four leases use operator-reported balances.

const PERF_DATA: PerfRecord[] = [
  {
    leaseId: "LSE-2019-001", lessee: "IndiGo Airlines", aircraft: "A320neo",
    monthlyRentUSD: 285_000, monthsElapsed: 86, collectionPct: 70,
    mrProjectedMonthly: 215_000, actualMRBalance: 18_998_500,
    originationStage: "1", currentStage: "3",
    plannedEnd: "2028-03-01", projectedEnd: "2028-09-01",
  },
  {
    leaseId: "LSE-2020-014", lessee: "Aeromexico", aircraft: "B737-800",
    monthlyRentUSD: 310_000, monthsElapsed: 70, collectionPct: 60,
    mrProjectedMonthly: 220_000, actualMRBalance: 15_620_400,
    originationStage: "1", currentStage: "3",
    plannedEnd: "2027-06-15", projectedEnd: "2027-09-15",
  },
  {
    leaseId: "LSE-2021-022", lessee: "Emirates", aircraft: "B777-300ER",
    monthlyRentUSD: 1_240_000, monthsElapsed: 64, collectionPct: 100,
    mrProjectedMonthly: 615_000, actualMRBalance: 40_255_500,
    originationStage: "1", currentStage: "1",
    plannedEnd: "2030-01-10", projectedEnd: "2030-01-10",
  },
  {
    leaseId: "LSE-2020-031", lessee: "SriLankan Airlines", aircraft: "A330-300",
    monthlyRentUSD: 480_000, monthsElapsed: 68, collectionPct: 90,
    mrProjectedMonthly: 510_000, actualMRBalance: 35_508_000,
    originationStage: "1", currentStage: "2",
    plannedEnd: "2026-09-01", projectedEnd: "2026-12-01",
  },
  {
    leaseId: "LSE-2022-009", lessee: "Ryanair", aircraft: "B737 MAX 8",
    monthlyRentUSD: 340_000, monthsElapsed: 48, collectionPct: 100,
    mrProjectedMonthly: 180_000, actualMRBalance: 8_830_500,
    originationStage: "1", currentStage: "1",
    plannedEnd: "2032-04-15", projectedEnd: "2032-04-15",
  },
  {
    leaseId: "LSE-2018-047", lessee: "Air France", aircraft: "A350-900",
    monthlyRentUSD: 960_000, monthsElapsed: 93, collectionPct: 100,
    mrProjectedMonthly: 595_000, actualMRBalance: 55_952_000,
    originationStage: "1", currentStage: "1",
    plannedEnd: "2028-07-20", projectedEnd: "2028-07-20",
  },
  {
    leaseId: "LSE-2021-055", lessee: "Azul Brazilian Airlines", aircraft: "A320neo",
    monthlyRentUSD: 295_000, monthsElapsed: 54, collectionPct: 92,
    mrProjectedMonthly: 210_000, actualMRBalance: 10_500_000,
    originationStage: "1", currentStage: "2",
    plannedEnd: "2029-11-01", projectedEnd: "2029-11-01",
  },
  {
    leaseId: "LSE-2019-063", lessee: "Air Transat", aircraft: "A321neo",
    monthlyRentUSD: 275_000, monthsElapsed: 84, collectionPct: 91,
    mrProjectedMonthly: 225_000, actualMRBalance: 17_640_000,
    originationStage: "1", currentStage: "2",
    plannedEnd: "2027-05-01", projectedEnd: "2027-05-01",
  },
  {
    leaseId: "LSE-2023-002", lessee: "Singapore Airlines", aircraft: "A350-900",
    monthlyRentUSD: 1_050_000, monthsElapsed: 39, collectionPct: 100,
    mrProjectedMonthly: 575_000, actualMRBalance: 22_100_000,
    originationStage: "1", currentStage: "1",
    plannedEnd: "2033-02-01", projectedEnd: "2033-02-01",
  },
  {
    leaseId: "LSE-2022-018", lessee: "Lufthansa", aircraft: "A220-300",
    monthlyRentUSD: 220_000, monthsElapsed: 45, collectionPct: 100,
    mrProjectedMonthly: 165_000, actualMRBalance: 7_560_000,
    originationStage: "1", currentStage: "1",
    plannedEnd: "2032-08-01", projectedEnd: "2032-08-01",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function collectionColor(pct: number) {
  if (pct >= 98) return "#15803D";
  if (pct >= 88) return "#B45309";
  return "#B91C1C";
}

function collectionBg(pct: number) {
  if (pct >= 98) return "rgba(21,128,61,0.08)";
  if (pct >= 88) return "rgba(180,83,9,0.08)";
  return "rgba(185,28,28,0.08)";
}

function mrVarianceColor(v: number) {
  return v >= 0 ? "#15803D" : "#B91C1C";
}

function endDeltaColor(days: number) {
  if (days === 0) return "#15803D";
  if (days > 90)  return "#B91C1C";
  return "#B45309";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PerformanceVsPlan() {
  const rows = useMemo(
    () =>
      PERF_DATA.map((r) => {
        const contractedTotal  = r.monthlyRentUSD * r.monthsElapsed;
        const actualCollected  = Math.round(contractedTotal * (r.collectionPct / 100));
        const projectedMRTotal = r.mrProjectedMonthly * r.monthsElapsed;
        const mrVariance       = r.actualMRBalance - projectedMRTotal;
        const endDelta         = daysBetween(r.plannedEnd, r.projectedEnd);
        const stageDiff        = parseInt(r.currentStage) - parseInt(r.originationStage);
        const migration        = stageDiff > 0 ? "downgraded" : stageDiff < 0 ? "upgraded" : "stable";
        return { ...r, contractedTotal, actualCollected, projectedMRTotal, mrVariance, endDelta, migration };
      }),
    [],
  );

  // ── Portfolio KPIs ──────────────────────────────────────────────────────────
  const totalContracted  = rows.reduce((s, r) => s + r.contractedTotal,  0);
  const totalCollected   = rows.reduce((s, r) => s + r.actualCollected,  0);
  const collectionRate   = totalCollected / totalContracted;
  const netMRVariance    = rows.reduce((s, r) => s + r.mrVariance, 0);
  const downgradedCount  = rows.filter((r) => r.migration === "downgraded").length;
  const upgradedCount    = rows.filter((r) => r.migration === "upgraded").length;
  const stableCount      = rows.length - downgradedCount - upgradedCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── KPI Strip ────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        <KpiCard
          label="Rent Collection Rate"
          value={`${(collectionRate * 100).toFixed(1)}%`}
          subtitle={`${fmtM(totalCollected)} collected · ${fmtM(totalContracted)} contracted`}
          delta={collectionRate >= 0.99
            ? "Fully on plan"
            : `${fmtM(totalContracted - totalCollected)} uncollected`}
          deltaType={collectionRate >= 0.97 ? "positive" : "negative"}
        />
        <KpiCard
          label="MR Adequacy vs. Underwriting"
          value={netMRVariance >= 0 ? `+${fmtM(netMRVariance)}` : fmtM(netMRVariance)}
          subtitle="Net MR vs. projected balances at signing"
          delta={netMRVariance >= 0 ? "Over-accrued — lessor favorable" : "MR shortfall vs. plan"}
          deltaType={netMRVariance >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="Stage Migration (Since Origination)"
          value={`${downgradedCount} downgraded`}
          subtitle={`${upgradedCount} upgraded · ${stableCount} stable`}
          delta={downgradedCount > 0
            ? `${downgradedCount} lease${downgradedCount > 1 ? "s" : ""} deteriorated vs. underwriting`
            : "No credit deterioration"}
          deltaType={downgradedCount > 0 ? "negative" : "positive"}
        />
      </div>

      {/* ── Alert Banner: at-risk leases ─────────────────────────────────────── */}
      {(() => {
        const atRisk = rows.filter((r) => r.collectionPct < 75 || r.currentStage === "3");
        if (atRisk.length === 0) return null;
        return (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: "0.875rem",
            background: "rgba(185,28,28,0.05)", border: "1px solid rgba(185,28,28,0.18)",
            borderLeft: "3px solid #B91C1C", borderRadius: "0.625rem",
            padding: "0.875rem 1.25rem",
          }}>
            <span style={{ fontSize: "1rem", marginTop: "0.05rem" }}>⚠</span>
            <div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#991B1B", marginBottom: "0.2rem" }}>
                {atRisk.length} lease{atRisk.length > 1 ? "s" : ""} with significant underperformance vs. plan
              </div>
              <div style={{ fontSize: "0.75rem", color: "#B91C1C" }}>
                {atRisk.map((r) => `${r.lessee} (${r.collectionPct}% rent collected · Stage ${r.currentStage})`).join(" · ")}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Main Comparison Table ─────────────────────────────────────────────── */}
      <Card title="Actuals vs. Underwriting — Per Lease" noPadding>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                {[
                  { label: "Lessee",              width: "16%" },
                  { label: "Aircraft",             width: "8%"  },
                  { label: "Stage (Orig → Now)",   width: "12%" },
                  { label: "Monthly Rent",         width: "10%" },
                  { label: "Collected vs. Plan",   width: "16%" },
                  { label: "MR Balance",           width: "12%" },
                  { label: "MR vs. Plan",          width: "10%" },
                  { label: "Lease End",            width: "16%" },
                ].map(({ label, width }) => (
                  <th
                    key={label}
                    style={{
                      width,
                      padding: "0.75rem 1rem",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#0F172A",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const stageClr   = row.migration === "downgraded" ? "#B91C1C" : row.migration === "upgraded" ? "#15803D" : "#94A3B8";
                const collClr    = collectionColor(row.collectionPct);
                const collBgClr  = collectionBg(row.collectionPct);
                const mrClr      = mrVarianceColor(row.mrVariance);
                const endClr     = endDeltaColor(row.endDelta);
                const rowBg      = i % 2 === 0 ? "#FFFFFF" : "#F4F5F7";

                return (
                  <tr
                    key={row.leaseId}
                    style={{ borderBottom: "1px solid #E2E8F0", background: rowBg }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = rowBg)}
                  >
                    {/* Lessee */}
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ fontWeight: 600, color: "#0F172A", lineHeight: 1.3 }}>{row.lessee}</div>
                      <div style={{ fontSize: "0.6875rem", fontFamily: "monospace", color: "#94A3B8", marginTop: "0.15rem" }}>{row.leaseId}</div>
                    </td>

                    {/* Aircraft */}
                    <td style={{ padding: "0.875rem 1rem", color: "#475569" }}>{row.aircraft}</td>

                    {/* Stage migration */}
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <StatusPill stage={row.originationStage} label={`S${row.originationStage}`} />
                        <span style={{ color: stageClr, fontSize: "0.8rem", fontWeight: 700 }}>→</span>
                        <StatusPill stage={row.currentStage}     label={`S${row.currentStage}`}     />
                      </div>
                      {row.migration !== "stable" && (
                        <div style={{ fontSize: "0.6875rem", color: stageClr, fontWeight: 700, marginTop: "0.3rem" }}>
                          {row.migration === "downgraded" ? "▼ downgraded" : "▲ upgraded"}
                        </div>
                      )}
                    </td>

                    {/* Monthly rent */}
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ fontWeight: 600, color: "#0F172A" }}>{fmtM(row.monthlyRentUSD)}<span style={{ fontWeight: 400, color: "#94A3B8", fontSize: "0.75rem" }}>/mo</span></div>
                      <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.15rem" }}>{row.monthsElapsed} months on lease</div>
                    </td>

                    {/* Collection vs plan */}
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                        {/* progress bar */}
                        <div style={{ flex: 1, height: "5px", background: "#E2E8F0", borderRadius: "3px", minWidth: "48px" }}>
                          <div style={{ width: `${row.collectionPct}%`, height: "100%", borderRadius: "3px", background: collClr, transition: "width 300ms ease-out" }} />
                        </div>
                        {/* badge */}
                        <span style={{
                          fontSize: "0.75rem", fontWeight: 700, padding: "0.15rem 0.45rem",
                          borderRadius: "9999px", background: collBgClr, color: collClr,
                          flexShrink: 0,
                        }}>
                          {row.collectionPct}%
                        </span>
                      </div>
                      <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
                        {fmtM(row.actualCollected)}{" "}
                        <span style={{ color: "#CBD5E1" }}>/</span>{" "}
                        {fmtM(row.contractedTotal)} contracted
                      </div>
                    </td>

                    {/* MR balance */}
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ fontWeight: 600, color: "#0F172A" }}>{fmtM(row.actualMRBalance)}</div>
                      <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.15rem" }}>Plan: {fmtM(row.projectedMRTotal)}</div>
                    </td>

                    {/* MR variance */}
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <span style={{ fontWeight: 700, color: mrClr, fontSize: "0.875rem" }}>
                        {row.mrVariance >= 0 ? "+" : ""}{fmtM(row.mrVariance)}
                      </span>
                      <div style={{ fontSize: "0.6875rem", color: mrClr, opacity: 0.75, marginTop: "0.15rem" }}>
                        {row.mrVariance >= 0 ? "over-accrued" : "shortfall"}
                      </div>
                    </td>

                    {/* Lease end */}
                    <td style={{ padding: "0.875rem 1rem" }}>
                      {row.endDelta === 0 ? (
                        <>
                          <div style={{ fontWeight: 600, color: "#15803D", fontSize: "0.8125rem" }}>On plan</div>
                          <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.15rem" }}>{row.plannedEnd}</div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                            <span style={{ fontWeight: 700, color: endClr }}>+{row.endDelta}d</span>
                            <span style={{ fontSize: "0.6875rem", color: endClr, opacity: 0.8 }}>extended</span>
                          </div>
                          <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.15rem" }}>
                            Plan: {row.plannedEnd} · Now: {row.projectedEnd}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Portfolio totals footer */}
            <tfoot>
              <tr style={{ borderTop: "2px solid #E2E8F0", background: "#002147" }}>
                <td colSpan={3} style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "#FFFFFF", fontSize: "0.8125rem" }}>
                  Portfolio Total
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#94A3B8", fontSize: "0.75rem" }}>—</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ flex: 1, height: "5px", background: "rgba(255,255,255,0.15)", borderRadius: "3px", minWidth: "48px" }}>
                      <div style={{ width: `${(collectionRate * 100).toFixed(1)}%`, height: "100%", borderRadius: "3px", background: collectionColor(collectionRate * 100) }} />
                    </div>
                    <span style={{ fontWeight: 700, color: collectionColor(collectionRate * 100), fontSize: "0.8125rem" }}>
                      {(collectionRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.3rem" }}>
                    {fmtM(totalCollected)} / {fmtM(totalContracted)}
                  </div>
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ fontWeight: 700, color: "#FFFFFF" }}>
                    {fmtM(rows.reduce((s, r) => s + r.actualMRBalance, 0))}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.15rem" }}>
                    Plan: {fmtM(rows.reduce((s, r) => s + r.projectedMRTotal, 0))}
                  </div>
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <span style={{ fontWeight: 700, color: netMRVariance >= 0 ? "#4ADE80" : "#F87171", fontSize: "0.875rem" }}>
                    {netMRVariance >= 0 ? "+" : ""}{fmtM(netMRVariance)}
                  </span>
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ fontSize: "0.8125rem", color: downgradedCount > 0 ? "#F87171" : "#4ADE80", fontWeight: 600 }}>
                    {downgradedCount > 0 ? `${downgradedCount} ↓ downgraded` : "No migrations"}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Legend / footnote */}
        <div style={{
          padding: "0.75rem 1rem",
          borderTop: "1px solid #E2E8F0",
          fontSize: "0.75rem",
          color: "#94A3B8",
          background: "#F8FAFC",
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}>
          <span>Actuals as of 2026-05-07</span>
          <span>·</span>
          <span>Stage origination = IFRS 9 classification at lease inception (all originated Stage 1)</span>
          <span>·</span>
          <span>MR balances from lessee submissions · Rent collection from payment ledger</span>
          <span>·</span>
          <span style={{ color: "#15803D", fontWeight: 600 }}>Green ≥ 98%</span>
          <span style={{ color: "#B45309", fontWeight: 600 }}>Amber 88–97%</span>
          <span style={{ color: "#B91C1C", fontWeight: 600 }}>Red &lt; 88%</span>
        </div>
      </Card>

      {/* ── Stage Migration Detail Card ───────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

        {/* Downgraded leases */}
        <div style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "0.875rem 1.125rem",
            borderBottom: "1px solid #E2E8F0",
            background: "#FEF2F2",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}>
            <span style={{ fontSize: "0.875rem" }}>▼</span>
            <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#991B1B" }}>
              Downgraded Since Origination
            </span>
            <span style={{
              marginLeft: "auto",
              background: "#B91C1C",
              color: "#FFFFFF",
              borderRadius: "9999px",
              fontSize: "0.6875rem",
              fontWeight: 700,
              padding: "0.1rem 0.5rem",
            }}>
              {downgradedCount}
            </span>
          </div>
          <div style={{ padding: "0.75rem 0" }}>
            {rows.filter((r) => r.migration === "downgraded").map((r) => (
              <div key={r.leaseId} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 1.125rem",
                borderBottom: "1px solid #F8FAFC",
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: "#0F172A", fontSize: "0.8125rem" }}>{r.lessee}</div>
                  <div style={{ fontSize: "0.6875rem", color: "#94A3B8", fontFamily: "monospace" }}>{r.leaseId}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <StatusPill stage={r.originationStage} label={`S${r.originationStage}`} />
                  <span style={{ color: "#B91C1C", fontWeight: 700, fontSize: "0.75rem" }}>→</span>
                  <StatusPill stage={r.currentStage}     label={`S${r.currentStage}`}     />
                </div>
              </div>
            ))}
            {downgradedCount === 0 && (
              <div style={{ padding: "1rem 1.125rem", fontSize: "0.8125rem", color: "#94A3B8" }}>No downgrades</div>
            )}
          </div>
        </div>

        {/* Lease end extensions */}
        <div style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "0.875rem 1.125rem",
            borderBottom: "1px solid #E2E8F0",
            background: "#FFFBEB",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}>
            <span style={{ fontSize: "0.875rem" }}>📅</span>
            <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#92400E" }}>
              Lease End Date Deviations
            </span>
            <span style={{
              marginLeft: "auto",
              background: "#B45309",
              color: "#FFFFFF",
              borderRadius: "9999px",
              fontSize: "0.6875rem",
              fontWeight: 700,
              padding: "0.1rem 0.5rem",
            }}>
              {rows.filter((r) => r.endDelta !== 0).length}
            </span>
          </div>
          <div style={{ padding: "0.75rem 0" }}>
            {rows.filter((r) => r.endDelta !== 0).map((r) => (
              <div key={r.leaseId} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 1.125rem",
                borderBottom: "1px solid #F8FAFC",
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: "#0F172A", fontSize: "0.8125rem" }}>{r.lessee}</div>
                  <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
                    {r.plannedEnd} → <span style={{ color: endDeltaColor(r.endDelta) }}>{r.projectedEnd}</span>
                  </div>
                </div>
                <span style={{
                  fontWeight: 700,
                  color: endDeltaColor(r.endDelta),
                  fontSize: "0.875rem",
                }}>
                  +{r.endDelta}d
                </span>
              </div>
            ))}
            {rows.filter((r) => r.endDelta !== 0).length === 0 && (
              <div style={{ padding: "1rem 1.125rem", fontSize: "0.8125rem", color: "#94A3B8" }}>All leases on original schedule</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
