import { useState, useMemo, useEffect } from "react";
import { Download, Info } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PORTFOLIO_AIRCRAFT,
  PORTFOLIO_LEASES,
  monthlyRate,
  annuityFactor,
  fmtM,
  fmtPct,
  monthsBetween,
  toDealsAircraft,
  toDealsLeases,
  type DealsAircraftRow,
  type DealsLeaseRow,
} from "../../data/dealsData";
import { usePortfolioData } from "../../hooks/usePortfolioData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExitRow {
  leaseId:    string;
  lessee:     string;
  aircraft:   string;
  msn:        string;
  monthsLeft: number;
  rentPV:     number;   // PV of rent stream
  sdHeld:     number;   // SD held (not discounted — held as cash today)
  mrBalance:  number;   // MR balance held (cash today)
  residualPV: number;   // PV of terminal aircraft value
  totalNPV:   number;
  nbv:        number;
  premium:    number;   // NPV − NBV (positive = above book)
  premiumPct: number;
}

// ─── NPV computation ──────────────────────────────────────────────────────────

function computeExitRow(
  leaseId: string,
  discountRate: number,
  leaseRows: DealsLeaseRow[],
  acRows: DealsAircraftRow[]
): ExitRow | null {
  const lease = leaseRows.find(l => l.id === leaseId);
  const ac    = lease ? acRows.find(a => a.msn === lease.msn) : null;
  if (!lease || !ac) return null;

  const today = new Date(2026, 4, 6); // May 6 2026
  const leaseEnd = new Date(lease.end);
  const months = Math.max(1, monthsBetween(today, leaseEnd));
  const r = monthlyRate(discountRate);

  // PV of remaining rent stream
  const rentPV = lease.rentPerMonth * annuityFactor(r, months);

  // SD held by lessor — it's cash in hand today (no discount needed, returned at end offset by time value)
  // For simplicity: show current SD balance as a positive asset
  const sdHeld = lease.sdM * 1_000_000;

  // MR balance — held by lessor as maintenance reserve
  const mrBalance = lease.mrBalanceM * 1_000_000;

  // Terminal aircraft value: current MV depreciated at 3% p.a., then discounted
  const currentMV = ac.mvM * 1_000_000;
  const terminalMV = currentMV * Math.pow(1 - 0.03 / 12, months);
  const residualPV = terminalMV * Math.pow(1 + r, -months);

  const totalNPV = rentPV + sdHeld + mrBalance + residualPV;
  const nbv = lease.nbvM * 1_000_000;
  const premium = totalNPV - nbv;
  const premiumPct = nbv > 0 ? (premium / nbv) * 100 : 0;

  return {
    leaseId,
    lessee:     lease.lessee,
    aircraft:   lease.aircraft,
    msn:        lease.msn,
    monthsLeft: months,
    rentPV,
    sdHeld,
    mrBalance,
    residualPV,
    totalNPV,
    nbv,
    premium,
    premiumPct,
  };
}

// ─── PDF export ───────────────────────────────────────────────────────────────

function exportMemo(rows: ExitRow[], discountRate: number) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const today = new Date(2026, 4, 6);

  // Header
  doc.setFillColor(0, 33, 71);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("INVESTMENT MEMO — PORTFOLIO EXIT NPV", 14, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Aeroinsights  |  ${today.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}  |  Discount Rate: ${discountRate.toFixed(1)}% p.a.`, 14, 17);

  // Assumptions box
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("ASSUMPTIONS", 14, 30);
  doc.setFont("helvetica", "normal");
  const assumptions = [
    `Discount rate: ${discountRate.toFixed(1)}% p.a. (monthly compounding)`,
    "Aircraft residual: Current MV depreciated at 3.0% p.a., discounted at deal rate",
    "SD held: Current balance held by lessor (cash-on-hand)",
    "MR balance: Maintenance reserves held by lessor",
    "NBV: Net book value as at 06-May-2026",
  ];
  assumptions.forEach((a, i) => doc.text(`• ${a}`, 14, 36 + i * 4.5));

  // Table
  const totRentPV     = rows.reduce((s, r) => s + r.rentPV,    0);
  const totSD         = rows.reduce((s, r) => s + r.sdHeld,    0);
  const totMR         = rows.reduce((s, r) => s + r.mrBalance, 0);
  const totResidual   = rows.reduce((s, r) => s + r.residualPV, 0);
  const totNPV        = rows.reduce((s, r) => s + r.totalNPV,  0);
  const totNBV        = rows.reduce((s, r) => s + r.nbv,       0);
  const totPremium    = totNPV - totNBV;
  const totPremiumPct = totNBV > 0 ? (totPremium / totNBV) * 100 : 0;

  autoTable(doc, {
    startY: 62,
    head: [[
      "Lessee", "Aircraft", "MSN", "Mths Left",
      "Rent PV", "SD Held", "MR Bal.", "Residual PV", "Total NPV", "NBV", "Prem/(Disc)",
    ]],
    body: [
      ...rows.map(r => [
        r.lessee,
        r.aircraft,
        r.msn,
        r.monthsLeft,
        fmtM(r.rentPV),
        fmtM(r.sdHeld),
        fmtM(r.mrBalance),
        fmtM(r.residualPV),
        fmtM(r.totalNPV),
        fmtM(r.nbv),
        `${fmtM(r.premium)} (${r.premiumPct >= 0 ? "+" : ""}${r.premiumPct.toFixed(1)}%)`,
      ]),
      [
        { content: "PORTFOLIO TOTAL", colSpan: 4, styles: { fontStyle: "bold" } },
        fmtM(totRentPV), fmtM(totSD), fmtM(totMR), fmtM(totResidual),
        { content: fmtM(totNPV), styles: { fontStyle: "bold" } },
        { content: fmtM(totNBV), styles: { fontStyle: "bold" } },
        { content: `${fmtM(totPremium)} (${totPremiumPct >= 0 ? "+" : ""}${totPremiumPct.toFixed(1)}%)`, styles: { fontStyle: "bold", textColor: totPremium >= 0 ? [22, 163, 74] : [185, 28, 28] } },
      ],
    ],
    headStyles: { fillColor: [0, 33, 71], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28 }, 1: { cellWidth: 18 }, 2: { cellWidth: 12 }, 3: { cellWidth: 12, halign: "center" },
      4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" },
      7: { halign: "right" }, 8: { halign: "right" }, 9: { halign: "right" }, 10: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = (doc.internal as { getNumberOfPages(): number }).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("CONFIDENTIAL — FOR INTERNAL USE ONLY", 14, 288);
    doc.text(`Page ${i} of ${pageCount}`, W - 14, 288, { align: "right" });
  }

  doc.save(`AeroInsights_PortfolioExit_${today.toISOString().slice(0, 10)}.pdf`);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PortfolioExitNPV() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [discountRate, setDiscountRate] = useState(8.0);

  const { assets, lessees, leases: liveLeases, provisions, isDemo } = usePortfolioData();

  const portfolioAircraft: DealsAircraftRow[] = useMemo(
    () => isDemo ? PORTFOLIO_AIRCRAFT : toDealsAircraft(assets, lessees, liveLeases, provisions),
    [assets, lessees, liveLeases, provisions, isDemo]
  );

  const portfolioLeases: DealsLeaseRow[] = useMemo(
    () => isDemo ? PORTFOLIO_LEASES : toDealsLeases(assets, lessees, liveLeases, provisions),
    [assets, lessees, liveLeases, provisions, isDemo]
  );

  // Sync selected set whenever the lease list changes (e.g. live data loads)
  useEffect(() => {
    setSelected(new Set(portfolioLeases.map(l => l.id)));
  }, [portfolioLeases]);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(prev =>
      prev.size === portfolioLeases.length
        ? new Set()
        : new Set(portfolioLeases.map(l => l.id))
    );

  const rows = useMemo(() =>
    portfolioLeases
      .filter(l => selected.has(l.id))
      .map(l => computeExitRow(l.id, discountRate, portfolioLeases, portfolioAircraft))
      .filter((r): r is ExitRow => r !== null),
    [selected, discountRate, portfolioLeases, portfolioAircraft]
  );

  const totRentPV   = rows.reduce((s, r) => s + r.rentPV,    0);
  const totSD       = rows.reduce((s, r) => s + r.sdHeld,    0);
  const totMR       = rows.reduce((s, r) => s + r.mrBalance, 0);
  const totResidual = rows.reduce((s, r) => s + r.residualPV, 0);
  const totNPV      = rows.reduce((s, r) => s + r.totalNPV,  0);
  const totNBV      = rows.reduce((s, r) => s + r.nbv,       0);
  const totPremium  = totNPV - totNBV;
  const totPremiumPct = totNBV > 0 ? (totPremium / totNBV) * 100 : 0;

  return (
    <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>

      {/* ── Left panel: controls ─────────────────────────────────────── */}
      <div style={{
        width: "260px",
        flexShrink: 0,
        background: "#F8FAFC",
        border: "1px solid #E2E8F0",
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "#64748B", marginBottom: "12px", textTransform: "uppercase" }}>
            Lease Selection
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "8px", padding: "6px 8px", borderRadius: "6px", background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
            <input
              type="checkbox"
              checked={selected.size === portfolioLeases.length && portfolioLeases.length > 0}
              onChange={toggleAll}
              style={{ accentColor: "#002147" }}
            />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1E40AF" }}>Select All</span>
          </label>
          {portfolioLeases.map(l => {
            const a = portfolioAircraft.find(a => a.msn === l.msn);
            return (
              <label key={l.id} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                cursor: "pointer",
                padding: "8px 10px",
                borderRadius: "8px",
                marginBottom: "4px",
                background: selected.has(l.id) ? "#F0F9FF" : "transparent",
                border: `1px solid ${selected.has(l.id) ? "#BAE6FD" : "#E2E8F0"}`,
                transition: "all 150ms ease-out",
              }}>
                <input
                  type="checkbox"
                  checked={selected.has(l.id)}
                  onChange={() => toggle(l.id)}
                  style={{ marginTop: "2px", accentColor: "#002147" }}
                />
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#1E293B" }}>{l.lessee}</div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>{l.aircraft} · MSN {l.msn}</div>
                  <div style={{ fontSize: "10px", color: "#94A3B8" }}>NBV {fmtM(l.nbvM * 1_000_000)}</div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Discount rate */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "#64748B", marginBottom: "10px", textTransform: "uppercase" }}>
            Discount Rate
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "#64748B" }}>4%</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#002147" }}>{discountRate.toFixed(1)}% p.a.</span>
            <span style={{ fontSize: "11px", color: "#64748B" }}>16%</span>
          </div>
          <input
            type="range" min={4} max={16} step={0.5}
            value={discountRate}
            onChange={e => setDiscountRate(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#002147" }}
          />
        </div>

        {/* Export button */}
        <button
          disabled={rows.length === 0}
          onClick={() => exportMemo(rows, discountRate)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            background: rows.length > 0 ? "#002147" : "#94A3B8",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: rows.length > 0 ? "pointer" : "not-allowed",
            transition: "background 150ms ease-out",
          }}
        >
          <Download size={15} />
          Export Investment Memo
        </button>

        {/* Methodology note */}
        <div style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "8px", padding: "10px 12px" }}>
          <div style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
            <Info size={13} style={{ color: "#64748B", flexShrink: 0, marginTop: "1px" }} />
            <p style={{ fontSize: "10.5px", color: "#475569", lineHeight: 1.5, margin: 0 }}>
              <strong>Methodology:</strong> Rent PV discounted at deal rate. Aircraft residual uses current MV depreciated at 3% p.a. SD and MR balances treated as lessor cash assets at current date.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right panel: results ─────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: "600px" }}>

        {/* Portfolio KPI strip */}
        {rows.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            {[
              { label: "Portfolio NPV",   val: fmtM(totNPV),     sub: `vs NBV ${fmtM(totNBV)}`, positive: true },
              { label: "Premium / (Disc)", val: fmtM(totPremium), sub: `${totPremiumPct >= 0 ? "+" : ""}${totPremiumPct.toFixed(1)}% to book`, positive: totPremium >= 0 },
              { label: "Rent Stream PV",  val: fmtM(totRentPV),  sub: `${fmtPct((totRentPV / totNPV) * 100)} of NPV`, positive: true },
              { label: "Residual PV",     val: fmtM(totResidual), sub: `${fmtPct((totResidual / totNPV) * 100)} of NPV`, positive: true },
            ].map(k => (
              <div key={k.label} style={{
                background: "#F8FAFC", border: "1px solid #E2E8F0",
                borderRadius: "10px", padding: "14px 16px",
              }}>
                <div style={{ fontSize: "10.5px", color: "#64748B", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "4px" }}>{k.label}</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: k.label === "Premium / (Disc)" ? (k.positive ? "#16A34A" : "#DC2626") : "#0F172A" }}>{k.val}</div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* NPV decomposition bar */}
        {rows.length > 0 && (
          <div style={{ marginBottom: "20px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px 20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "10px" }}>NPV Composition (portfolio total)</div>
            {[
              { label: "Rent PV",      val: totRentPV,   color: "#002147" },
              { label: "Residual PV",  val: totResidual, color: "#0EA5E9" },
              { label: "MR Balance",   val: totMR,       color: "#10B981" },
              { label: "SD Held",      val: totSD,       color: "#F59E0B" },
            ].map(seg => {
              const pct = totNPV > 0 ? (seg.val / totNPV) * 100 : 0;
              return (
                <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <div style={{ width: "90px", fontSize: "11px", color: "#475569", flexShrink: 0 }}>{seg.label}</div>
                  <div style={{ flex: 1, height: "10px", background: "#E2E8F0", borderRadius: "5px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: seg.color, borderRadius: "5px", transition: "width 300ms ease-out" }} />
                  </div>
                  <div style={{ width: "80px", textAlign: "right", fontSize: "11px", fontWeight: 600, color: "#1E293B" }}>{fmtM(seg.val)}</div>
                  <div style={{ width: "40px", textAlign: "right", fontSize: "10px", color: "#94A3B8" }}>{pct.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Per-lease table */}
        {rows.length > 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>Lease-by-Lease Decomposition</span>
              <span style={{ fontSize: "11px", color: "#94A3B8" }}>{rows.length} lease{rows.length !== 1 ? "s" : ""} selected · {discountRate.toFixed(1)}% discount rate</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["Lessee", "Aircraft", "Mths Left", "Rent PV", "SD Held", "MR Bal.", "Residual PV", "Total NPV", "NBV", "Prem / (Disc)"].map(h => (
                      <th key={h} style={{
                        padding: "10px 14px", textAlign: h === "Lessee" || h === "Aircraft" ? "left" : "right",
                        fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.04em",
                        color: "#64748B", textTransform: "uppercase",
                        borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.leaseId} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ fontWeight: 600, color: "#0F172A" }}>{row.lessee}</div>
                        <div style={{ fontSize: "10px", color: "#94A3B8" }}>{row.leaseId}</div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#475569" }}>{row.aircraft}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#475569" }}>{row.monthsLeft}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtM(row.rentPV)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtM(row.sdHeld)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtM(row.mrBalance)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtM(row.residualPV)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmtM(row.totalNPV)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#64748B", fontVariantNumeric: "tabular-nums" }}>{fmtM(row.nbv)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                        color: row.premium >= 0 ? "#16A34A" : "#DC2626" }}>
                        {fmtM(row.premium)}
                        <span style={{ fontSize: "10px", fontWeight: 400, marginLeft: "4px" }}>
                          ({row.premiumPct >= 0 ? "+" : ""}{row.premiumPct.toFixed(1)}%)
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Totals row */}
                  <tr style={{ background: "#002147", color: "#FFFFFF" }}>
                    <td colSpan={3} style={{ padding: "12px 14px", fontWeight: 700, fontSize: "12px" }}>Portfolio Total</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtM(totRentPV)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtM(totSD)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtM(totMR)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtM(totResidual)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtM(totNPV)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtM(totNBV)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                      color: totPremium >= 0 ? "#86EFAC" : "#FCA5A5" }}>
                      {fmtM(totPremium)}
                      <span style={{ fontSize: "10px", fontWeight: 400, marginLeft: "4px" }}>
                        ({totPremiumPct >= 0 ? "+" : ""}{totPremiumPct.toFixed(1)}%)
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{
            background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px",
            padding: "60px 40px", textAlign: "center",
          }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>
              <i className="bi bi-clipboard" style={{ color: "#94A3B8" }} />
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#475569" }}>No leases selected</div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>Select one or more leases from the left panel to compute exit NPV</div>
          </div>
        )}
      </div>
    </div>
  );
}
