import { useState, useMemo, useEffect } from "react";
import {
  PORTFOLIO_AIRCRAFT,
  MARKET_RENT_USD,
  holdingCostMonthly,
  npvOfCashflows,
  computeIRR,
  monthsBetween,
  fmtM,
  toDealsAircraft,
  type DealsAircraftRow,
} from "../../data/dealsData";
import { usePortfolioData } from "../../hooks/usePortfolioData";

// ─── Types ────────────────────────────────────────────────────────────────────

const NOW = new Date(2026, 4, 1); // May 2026

interface StackOption {
  id: string;
  label: string;
  sublabel: string;
  term: number;      // months of the strategy horizon
  cashflows: number[];
  category: "extension" | "remarketing" | "sale" | "partout" | "hold";
}

// ─── Build option cashflows ───────────────────────────────────────────────────

function buildOptions(
  mvM: number,
  partOutM: number,
  currentRent: number,
  marketRent: number,
  holdingCost: number,
  vintage: number,
  type: string,
): StackOption[] {
  const mv = mvM * 1e6;
  const partOut = partOutM * 1e6;

  function mvAt(months: number) {
    // Simple 3% p.a. real depreciation
    return mv * Math.pow(1 - 0.03 / 12, months);
  }

  // Extension options: current lessee stays, then sell at terminal MV
  function extension(termMonths: number): StackOption {
    const cfs = [-mv];
    for (let t = 1; t < termMonths; t++) cfs.push(currentRent);
    cfs.push(currentRent + mvAt(termMonths));
    return {
      id: `ext${termMonths}`, label: `Extension +${termMonths}m`, term: termMonths,
      sublabel: `Current rent ${fmtM(currentRent)}/mo`,
      cashflows: cfs, category: "extension",
    };
  }

  // Re-lease: 3m remarketing gap, then 60m lease at market rent
  const remarkTerm = 63;
  const remarketCFs: number[] = [-mv];
  for (let t = 1; t <= 3; t++) remarketCFs.push(-holdingCost); // gap
  for (let t = 4; t <= remarkTerm; t++) {
    const income = t === remarkTerm ? marketRent + mvAt(remarkTerm) : marketRent;
    remarketCFs.push(income);
  }

  // Sale: immediate at current MV
  const saleCFs = [-mv, mv];

  // Part-out: 14m process with teardown costs, then part-out value
  const teardownMonthly = mv * 0.006; // ~0.6% MV/month teardown running costs
  const partOutTerm = 14;
  const partOutCFs: number[] = [-mv];
  for (let t = 1; t < partOutTerm; t++) partOutCFs.push(-teardownMonthly);
  partOutCFs.push(partOut);

  // Do nothing: 24m hold, then sell at depreciated MV
  const holdTerm = 24;
  const holdCFs: number[] = [-mv];
  for (let t = 1; t < holdTerm; t++) holdCFs.push(-holdingCost);
  holdCFs.push(mvAt(holdTerm) - holdingCost);

  return [
    extension(12),
    extension(24),
    extension(36),
    {
      id: "remarket", label: "Re-lease at Market", term: remarkTerm,
      sublabel: `3m gap + 60m @ ${fmtM(marketRent)}/mo`,
      cashflows: remarketCFs, category: "remarketing",
    },
    {
      id: "sale", label: "Sale at Market Value", term: 1,
      sublabel: `${fmtM(mvM * 1e6, 1)} — immediate`,
      cashflows: saleCFs, category: "sale",
    },
    {
      id: "partout", label: "Part-Out", term: partOutTerm,
      sublabel: `${fmtM(partOut, 1)} net — 14m process`,
      cashflows: partOutCFs, category: "partout",
    },
    {
      id: "hold", label: "Do Nothing (Hold)", term: holdTerm,
      sublabel: `${fmtM(holdingCost)}/mo carrying cost`,
      cashflows: holdCFs, category: "hold",
    },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RackAndStack() {
  const [msnIndex,     setMsnIndex]     = useState(0);
  const [discountRate, setDiscountRate] = useState(8);
  const [marketRentOverride, setMarketRentOverride] = useState<number | null>(null);

  const { assets, lessees, leases, provisions, isDemo } = usePortfolioData();

  const portfolioAircraft: DealsAircraftRow[] = useMemo(
    () => isDemo ? PORTFOLIO_AIRCRAFT : toDealsAircraft(assets, lessees, leases, provisions),
    [assets, lessees, leases, provisions, isDemo]
  );

  // Reset index when aircraft list changes (e.g. live data loads)
  useEffect(() => {
    setMsnIndex(0);
  }, [portfolioAircraft]);

  const leaseByLeaseId = useMemo(
    () => new Map(leases.map(l => [l.id, l])),
    [leases]
  );

  if (portfolioAircraft.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#64748B", fontSize: "0.875rem" }}>
        Loading portfolio data…
      </div>
    );
  }

  const aircraft = portfolioAircraft[msnIndex] ?? portfolioAircraft[0];

  const currentLease = leaseByLeaseId.get(aircraft?.leaseId ?? "");
  const currentRent  = isDemo
    ? ({ "9218": 285_000, "41234": 310_000, "62047": 1_240_000, "1728": 480_000, "67892": 340_000, "0378": 960_000 } as Record<string, number>)[aircraft?.msn ?? ""] ?? 0
    : (currentLease?.monthly_rental ?? 0);
  const leaseEndStr  = isDemo
    ? ({ "9218": "2028-03-01", "41234": "2027-06-15", "62047": "2030-01-10", "1728": "2026-09-01", "67892": "2032-04-15", "0378": "2028-07-20" } as Record<string, string>)[aircraft?.msn ?? ""] ?? "2028-01-01"
    : (currentLease?.end_date ?? "2028-01-01");
  const remaining = monthsBetween(NOW, new Date(leaseEndStr));

  const marketMid   = MARKET_RENT_USD[aircraft.type]?.mid ?? currentRent;
  const marketRent  = marketRentOverride ?? marketMid;
  const holding     = holdingCostMonthly(aircraft.type);

  const options = useMemo(
    () => buildOptions(aircraft.mvM, aircraft.partOutM, currentRent, marketRent, holding, aircraft.vintage, aircraft.type),
    [aircraft, currentRent, marketRent, holding],
  );

  const results = useMemo(() => options.map((opt) => {
    const npv = npvOfCashflows(opt.cashflows, discountRate);
    const irr = computeIRR(opt.cashflows);
    return { ...opt, npv, irr };
  }), [options, discountRate]);

  const bestNPV = Math.max(...results.map((r) => r.npv));

  const catColor: Record<StackOption["category"], string> = {
    extension: "#0369A1", remarketing: "#15803D", sale: "#002147",
    partout: "#7C3AED", hold: "#B45309",
  };

  function rankBadge(npv: number) {
    if (npv === bestNPV) return { label: "Best NPV", bg: "#15803D", color: "#FFFFFF" };
    if (npv >= bestNPV * 0.90) return { label: "Good", bg: "rgba(21,128,61,0.1)", color: "#15803D" };
    if (npv >= bestNPV * 0.70) return { label: "Neutral", bg: "rgba(180,83,9,0.1)", color: "#B45309" };
    return { label: "Low", bg: "rgba(185,28,28,0.1)", color: "#B91C1C" };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Controls ────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>
            Select Aircraft
          </div>
          <select
            value={msnIndex}
            onChange={(e) => { setMsnIndex(Number(e.target.value)); setMarketRentOverride(null); }}
            style={{ padding: "0.5rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "0.5rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF", cursor: "pointer" }}
          >
            {portfolioAircraft.map((a, i) => (
              <option key={a.msn} value={i}>
                {a.msn} · {a.type} · {a.lessee}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>
            Market Rent Override ($/mo)
          </div>
          <input
            type="number" step={5_000}
            placeholder={marketMid.toLocaleString()}
            value={marketRentOverride ?? ""}
            onChange={(e) => setMarketRentOverride(e.target.value ? Number(e.target.value) : null)}
            style={{ padding: "0.5rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "0.5rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF", width: "160px" }}
          />
        </div>

        <div>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>
            Discount Rate
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="range" min={4} max={16} step={0.5} value={discountRate}
              onChange={(e) => setDiscountRate(Number(e.target.value))}
              style={{ width: "100px", cursor: "pointer" }} />
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", minWidth: "40px" }}>
              {discountRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Aircraft context strip ───────────────────────────── */}
      <div style={{ display: "flex", gap: "1.5rem", padding: "0.75rem 1rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.5rem", fontSize: "0.8125rem", color: "#475569", flexWrap: "wrap" }}>
        <span><strong style={{ color: "#0F172A" }}>MSN {aircraft.msn}</strong> · {aircraft.type} · {aircraft.reg}</span>
        <span>Vintage: <strong>{aircraft.vintage}</strong></span>
        <span>Current MV: <strong>{fmtM(aircraft.mvM * 1e6, 1)}</strong></span>
        <span>Part-out: <strong>{fmtM(aircraft.partOutM * 1e6, 1)}</strong></span>
        <span>Current rent: <strong>{fmtM(currentRent)}/mo</strong></span>
        <span>Market rent (mid): <strong>{fmtM(marketMid)}/mo</strong></span>
        <span>Remaining term: <strong>{remaining}m</strong></span>
        <span>Stage: <strong>{aircraft.stage}</strong></span>
      </div>

      {/* ── Comparison table ────────────────────────────────── */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E2E8F0", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Re-marketing Options — NPV at {discountRate.toFixed(1)}% Discount Rate
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Option", "Strategy", "Horizon", "NPV", "IRR", "vs. Sale NPV", "Recommendation"].map((h) => (
                  <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results
                .slice()
                .sort((a, b) => b.npv - a.npv)
                .map((opt, i) => {
                  const saleNPV = results.find((r) => r.id === "sale")?.npv ?? 0;
                  const vsSale  = opt.npv - saleNPV;
                  const badge   = rankBadge(opt.npv);
                  return (
                    <tr key={opt.id} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                      <td style={{ padding: "0.625rem 1rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: catColor[opt.category], background: `${catColor[opt.category]}14`, border: `1px solid ${catColor[opt.category]}30`, borderRadius: "0.375rem", padding: "0.125rem 0.5rem" }}>
                          {opt.category === "extension" ? "Ext" : opt.category === "remarketing" ? "Re-lease" : opt.category === "sale" ? "Sale" : opt.category === "partout" ? "Part-out" : "Hold"}
                        </span>
                      </td>
                      <td style={{ padding: "0.625rem 1rem" }}>
                        <div style={{ fontWeight: 600, color: "#0F172A" }}>{opt.label}</div>
                        <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{opt.sublabel}</div>
                      </td>
                      <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>
                        {opt.term === 1 ? "Immediate" : `${opt.term} months`}
                      </td>
                      <td style={{ padding: "0.625rem 1rem" }}>
                        <span style={{ fontWeight: 700, color: opt.npv >= 0 ? "#0F172A" : "#B91C1C" }}>
                          {fmtM(opt.npv, 1)}
                        </span>
                      </td>
                      <td style={{ padding: "0.625rem 1rem", color: opt.irr !== null ? (opt.irr >= discountRate ? "#15803D" : "#B91C1C") : "#94A3B8", fontWeight: 600 }}>
                        {opt.irr !== null ? `${opt.irr.toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 1rem", fontWeight: 600, color: vsSale >= 0 ? "#15803D" : "#B91C1C" }}>
                        {vsSale >= 0 ? "+" : ""}{fmtM(vsSale, 1)}
                      </td>
                      <td style={{ padding: "0.625rem 1rem" }}>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: badge.bg, color: badge.color, borderRadius: "0.375rem", padding: "0.2rem 0.5rem" }}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #E2E8F0", background: "#F8FAFC" }}>
          {(() => {
            const best = results.slice().sort((a, b) => b.npv - a.npv)[0];
            return (
              <div style={{ fontSize: "0.8125rem", color: "#0F172A" }}>
                <strong style={{ color: "#15803D" }}>Recommendation: </strong>
                <strong>{best.label}</strong> yields the highest NPV of{" "}
                <strong>{fmtM(best.npv, 1)}</strong> at {discountRate}% discount rate
                {best.irr !== null ? `, with an implied IRR of ${best.irr.toFixed(1)}%.` : "."}
                {" "}NPV figures assume 3% p.a. aircraft depreciation, 3-month re-marketing gap, and 14-month part-out process.
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Visual NPV bar chart (div-based) ────────────────── */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1.25rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
          NPV Comparison
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {results
            .slice()
            .sort((a, b) => b.npv - a.npv)
            .map((opt) => {
              const maxNPV = Math.max(...results.map((r) => Math.abs(r.npv)));
              const pct = maxNPV > 0 ? (Math.abs(opt.npv) / maxNPV) * 100 : 0;
              const isNeg = opt.npv < 0;
              const barColor = opt.npv === bestNPV ? "#15803D" : isNeg ? "#B91C1C" : catColor[opt.category];
              return (
                <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: "160px", fontSize: "0.8125rem", fontWeight: 500, color: "#0F172A", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {opt.label}
                  </div>
                  <div style={{ flex: 1, height: "20px", background: "#F1F5F9", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: "4px", transition: "width 300ms cubic-bezier(0.23,1,0.32,1)" }} />
                  </div>
                  <div style={{ width: "80px", textAlign: "right", fontWeight: 700, color: barColor, fontVariantNumeric: "tabular-nums", flexShrink: 0, fontSize: "0.8125rem" }}>
                    {fmtM(opt.npv, 1)}
                  </div>
                </div>
              );
            })}
        </div>
        <div style={{ marginTop: "0.75rem", fontSize: "0.6875rem", color: "#94A3B8" }}>
          Green = best option · All NPVs relative to aircraft current market value as cost basis
        </div>
      </div>
    </div>
  );
}
