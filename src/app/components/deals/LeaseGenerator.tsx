import { useState, useMemo, useEffect } from "react";
import { Save, Info, CheckCircle2 } from "lucide-react";
import {
  MARKET_RENT_USD,
  AIRCRAFT_BASE_VALUE,
  monthlyRate,
  annuityFactor,
  npvOfCashflows,
  computeIRR,
  residualFactor,
  autoMonthlyMR,
  fmtM,
} from "../../data/dealsData";

// ─── Types ────────────────────────────────────────────────────────────────────

const AIRCRAFT_TYPES = [
  "A320", "A320neo", "A321neo", "A330-300", "A350-900",
  "B737-800", "B737 MAX 8", "B777-300ER", "B787-9",
  "A220-300", "E190", "E195", "CRJ900", "Q400", "ATR 72",
];

const JURISDICTIONS = [
  "Ireland", "United States", "Netherlands", "Singapore", "India",
  "Brazil", "Mexico", "South Africa", "China", "UAE", "UK", "Australia",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCashflows(
  aircraftValue: number,
  sdAmount: number,
  rent: number,
  monthlyMR: number,
  termMonths: number,
  vintage: number,
): number[] {
  const cfs: number[] = new Array(termMonths + 1).fill(0);
  cfs[0] = -(aircraftValue - sdAmount);
  for (let t = 1; t <= termMonths; t++) {
    cfs[t] = rent + monthlyMR;
  }
  const residual = aircraftValue * residualFactor(vintage, termMonths);
  cfs[termMonths] += residual - sdAmount;
  return cfs;
}

function yearlyTable(
  rent: number,
  monthlyMR: number,
  termMonths: number,
  discountRate: number,
  aircraftValue: number,
  sdAmount: number,
  vintage: number,
) {
  const r = monthlyRate(discountRate);
  let cumPV = -(aircraftValue - sdAmount);
  const rows: Array<{
    year: number; annRent: number; annMR: number; annTotal: number; discCF: number; cumPV: number;
  }> = [];

  const years = Math.ceil(termMonths / 12);
  for (let y = 1; y <= years; y++) {
    const mStart = (y - 1) * 12 + 1;
    const mEnd   = Math.min(y * 12, termMonths);
    let annRent = 0, annMR = 0, discCF = 0;
    for (let t = mStart; t <= mEnd; t++) {
      const cf = rent + monthlyMR + (t === termMonths
        ? aircraftValue * residualFactor(vintage, termMonths) - sdAmount
        : 0);
      annRent += rent;
      annMR   += monthlyMR;
      discCF  += cf / Math.pow(1 + r, t);
    }
    cumPV += discCF;
    rows.push({ year: y, annRent, annMR, annTotal: annRent + annMR, discCF, cumPV });
  }
  return rows;
}

// ─── TAB_STYLE shared helper ─────────────────────────────────────────────────

function inputStyle(wide = false): React.CSSProperties {
  return {
    width: wide ? "100%" : "120px",
    padding: "0.375rem 0.625rem",
    border: "1px solid #E2E8F0",
    borderRadius: "0.375rem",
    fontSize: "0.8125rem",
    color: "#0F172A",
    background: "#FFFFFF",
    outline: "none",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LeaseGenerator() {
  const [aircraftType,  setAircraftType]  = useState("A320neo");
  const [vintage,       setVintage]       = useState(2020);
  const [jurisdiction,  setJurisdiction]  = useState("Ireland");
  const [aircraftValue, setAircraftValue] = useState(26_500_000);
  const [rent,          setRent]          = useState(302_000);
  const [termMonths,    setTermMonths]    = useState(84);
  const [sdAmount,      setSdAmount]      = useState(906_000);  // 3× rent
  const [discountRate,  setDiscountRate]  = useState(8);
  const [useAutoMR,     setUseAutoMR]     = useState(true);
  const [manualMR,      setManualMR]      = useState(0);
  const [saved,         setSaved]         = useState(false);

  // Auto-populate when type changes
  useEffect(() => {
    const mr   = MARKET_RENT_USD[aircraftType];
    const base = AIRCRAFT_BASE_VALUE[aircraftType];
    if (mr)   setRent(mr.mid);
    if (base) setAircraftValue(base);
    setSdAmount(mr ? mr.mid * 3 : 0);
  }, [aircraftType]);

  const monthlyMR = useAutoMR ? autoMonthlyMR(aircraftType) : manualMR;

  const cashflows = useMemo(
    () => buildCashflows(aircraftValue, sdAmount, rent, monthlyMR, termMonths, vintage),
    [aircraftValue, sdAmount, rent, monthlyMR, termMonths, vintage],
  );

  const npv = useMemo(() => npvOfCashflows(cashflows, discountRate), [cashflows, discountRate]);
  const r   = monthlyRate(discountRate);
  const lev = rent * annuityFactor(r, termMonths);
  const irr = useMemo(() => computeIRR(cashflows), [cashflows]);
  const lrf = ((rent / aircraftValue) * 100).toFixed(3);

  const table = useMemo(
    () => yearlyTable(rent, monthlyMR, termMonths, discountRate, aircraftValue, sdAmount, vintage),
    [rent, monthlyMR, termMonths, discountRate, aircraftValue, sdAmount, vintage],
  );

  function handleSave() {
    const option = {
      id:           Date.now().toString(),
      savedAt:      new Date().toISOString(),
      label:        `${aircraftType} ${termMonths}mo @ ${fmtM(rent)}/mo`,
      aircraftType, vintage, jurisdiction,
      aircraftValue, rent, termMonths, sdAmount, discountRate,
      monthlyMR, npv, lev, irr, lrf,
    };
    const existing = JSON.parse(localStorage.getItem("aero_restructuring_options") || "[]");
    existing.push(option);
    localStorage.setItem("aero_restructuring_options", JSON.stringify(existing));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0.5rem 0", borderBottom: "1px solid #F1F5F9",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.8125rem", color: "#475569", flexShrink: 0, width: "160px",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1.5rem", alignItems: "start" }}>

      {/* ── Left: Inputs ────────────────────────────────────── */}
      <div style={{ background: "#FAFAFA", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          Lease Parameters
        </div>

        {/* Aircraft type */}
        <div style={rowStyle}>
          <span style={labelStyle}>Aircraft Type</span>
          <select value={aircraftType} onChange={(e) => setAircraftType(e.target.value)} style={inputStyle(false)}>
            {AIRCRAFT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Vintage */}
        <div style={rowStyle}>
          <span style={labelStyle}>Manufacture Year</span>
          <input type="number" min={2000} max={2026} value={vintage}
            onChange={(e) => setVintage(Number(e.target.value))} style={inputStyle(false)} />
        </div>

        {/* Jurisdiction */}
        <div style={rowStyle}>
          <span style={labelStyle}>Lessee Jurisdiction</span>
          <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} style={inputStyle(false)}>
            {JURISDICTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        <div style={{ height: "0.75rem" }} />
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Economics</div>

        {/* Aircraft value */}
        <div style={rowStyle}>
          <span style={labelStyle}>Aircraft Value ($)</span>
          <input type="number" step={500_000} value={aircraftValue}
            onChange={(e) => setAircraftValue(Number(e.target.value))} style={inputStyle(false)} />
        </div>

        {/* Monthly rent */}
        <div style={rowStyle}>
          <span style={labelStyle}>Monthly Rent ($)</span>
          <input type="number" step={5_000} value={rent}
            onChange={(e) => setRent(Number(e.target.value))} style={inputStyle(false)} />
        </div>

        {/* Market band hint */}
        {MARKET_RENT_USD[aircraftType] && (
          <div style={{ fontSize: "0.6875rem", color: "#94A3B8", paddingLeft: "160px", marginTop: "-0.25rem", marginBottom: "0.25rem" }}>
            Market: {fmtM(MARKET_RENT_USD[aircraftType].low)}–{fmtM(MARKET_RENT_USD[aircraftType].high)}/mo
          </div>
        )}

        {/* Lease term */}
        <div style={rowStyle}>
          <span style={labelStyle}>Lease Term</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="range" min={12} max={144} step={12} value={termMonths}
              onChange={(e) => setTermMonths(Number(e.target.value))}
              style={{ width: "80px", cursor: "pointer" }} />
            <span style={{ fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums", color: "#0F172A", width: "32px" }}>
              {termMonths}m
            </span>
          </div>
        </div>

        {/* Security deposit */}
        <div style={rowStyle}>
          <span style={labelStyle}>Security Deposit ($)</span>
          <input type="number" step={50_000} value={sdAmount}
            onChange={(e) => setSdAmount(Number(e.target.value))} style={inputStyle(false)} />
        </div>

        {/* MR */}
        <div style={rowStyle}>
          <span style={labelStyle}>MR Collection</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["Auto", "Manual"] as const).map((m) => (
              <button key={m} onClick={() => setUseAutoMR(m === "Auto")}
                style={{
                  padding: "0.25rem 0.625rem", fontSize: "0.6875rem", fontWeight: 600, cursor: "pointer",
                  border: "1px solid", borderRadius: "0.375rem",
                  background: (m === "Auto") === useAutoMR ? "#002147" : "transparent",
                  color:      (m === "Auto") === useAutoMR ? "#FFFFFF" : "#475569",
                  borderColor:(m === "Auto") === useAutoMR ? "#002147" : "#E2E8F0",
                }}>
                {m}
              </button>
            ))}
          </div>
        </div>
        {useAutoMR ? (
          <div style={{ fontSize: "0.6875rem", color: "#94A3B8", paddingLeft: "160px", marginTop: "-0.25rem" }}>
            Heuristic: {fmtM(monthlyMR)}/mo ({aircraftType})
          </div>
        ) : (
          <div style={rowStyle}>
            <span style={labelStyle}>Monthly MR ($)</span>
            <input type="number" step={5_000} value={manualMR}
              onChange={(e) => setManualMR(Number(e.target.value))} style={inputStyle(false)} />
          </div>
        )}

        <div style={{ height: "0.75rem" }} />
        {/* Discount rate */}
        <div style={rowStyle}>
          <span style={labelStyle}>Discount Rate</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="range" min={4} max={16} step={0.5} value={discountRate}
              onChange={(e) => setDiscountRate(Number(e.target.value))}
              style={{ width: "80px", cursor: "pointer" }} />
            <span style={{ fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums", color: "#0F172A", width: "36px" }}>
              {discountRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Save button */}
        <div style={{ marginTop: "1rem" }}>
          <button onClick={handleSave} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            background: saved ? "#15803D" : "#002147", color: "#FFFFFF",
            border: "none", borderRadius: "0.5rem", padding: "0.625rem", fontSize: "0.8125rem", fontWeight: 600,
            cursor: "pointer", transition: "background 200ms",
          }}>
            <Save size={14} />
            {saved
              ? <><CheckCircle2 size={14} style={{ marginRight: "4px" }} /> Saved to Restructuring Simulator</>
              : "Save as Restructuring Option"}
          </button>
        </div>
      </div>

      {/* ── Right: Results ──────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
          {[
            {
              label: "Portfolio NPV",
              value: fmtM(npv),
              sub: `at ${discountRate}% discount rate`,
              color: npv >= 0 ? "#15803D" : "#B91C1C",
              large: true,
            },
            {
              label: "Lease Encumbered Value",
              value: fmtM(lev),
              sub: "PV of rent stream only",
              color: "#002147",
              large: true,
            },
            {
              label: "Implied IRR",
              value: irr != null ? `${irr.toFixed(2)}%` : "N/A",
              sub: "total return on capital",
              color: (irr ?? 0) >= discountRate ? "#15803D" : "#B91C1C",
              large: true,
            },
            {
              label: "Annual LRF",
              value: `${lrf}%`,
              sub: "rent / aircraft value × 100",
              color: "#0F172A",
              large: false,
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.625rem", padding: "1rem" }}>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>{label}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.25rem" }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Assumptions strip */}
        <div style={{ display: "flex", gap: "1.5rem", padding: "0.625rem 0.875rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.5rem", fontSize: "0.75rem", color: "#64748B", flexWrap: "wrap" }}>
          <span><strong style={{ color: "#0F172A" }}>Aircraft:</strong> {aircraftType} ({vintage})</span>
          <span><strong style={{ color: "#0F172A" }}>Value:</strong> {fmtM(aircraftValue, 2)}</span>
          <span><strong style={{ color: "#0F172A" }}>Rent:</strong> {fmtM(rent, 0)}/mo</span>
          <span><strong style={{ color: "#0F172A" }}>MR:</strong> {fmtM(monthlyMR, 0)}/mo</span>
          <span><strong style={{ color: "#0F172A" }}>Term:</strong> {termMonths}m</span>
          <span><strong style={{ color: "#0F172A" }}>SD:</strong> {fmtM(sdAmount, 2)}</span>
          <span><strong style={{ color: "#0F172A" }}>Residual:</strong> {(residualFactor(vintage, termMonths) * 100).toFixed(0)}% at EOL</span>
          <span><strong style={{ color: "#0F172A" }}>Jurisdiction:</strong> {jurisdiction}</span>
        </div>

        {/* Year-by-year cashflow table */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E2E8F0", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", justifyContent: "space-between" }}>
            <span>Projected Cashflow Stream</span>
            <span style={{ fontWeight: 400, textTransform: "none", color: "#94A3B8" }}>
              Terminal residual included in final year
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Year", "Annual Rent", "Annual MR", "Total Annual CF", "Discounted CF", "Cum. NPV"].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 1rem", textAlign: h === "Year" ? "left" : "right", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Initial outlay row */}
                <tr style={{ background: "rgba(0,33,71,0.04)", borderBottom: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "0.5rem 1rem", fontWeight: 600, color: "#002147" }}>Year 0</td>
                  <td style={{ padding: "0.5rem 1rem", textAlign: "right", color: "#94A3B8" }}>—</td>
                  <td style={{ padding: "0.5rem 1rem", textAlign: "right", color: "#94A3B8" }}>—</td>
                  <td style={{ padding: "0.5rem 1rem", textAlign: "right", fontWeight: 600, color: "#B91C1C" }}>
                    {fmtM(-(aircraftValue - sdAmount), 2)}
                  </td>
                  <td style={{ padding: "0.5rem 1rem", textAlign: "right", color: "#B91C1C" }}>{fmtM(-(aircraftValue - sdAmount), 2)}</td>
                  <td style={{ padding: "0.5rem 1rem", textAlign: "right", color: "#B91C1C" }}>{fmtM(-(aircraftValue - sdAmount), 2)}</td>
                </tr>
                {table.map(({ year, annRent, annMR, annTotal, discCF, cumPV }, i) => {
                  const isLast = i === table.length - 1;
                  return (
                    <tr key={year} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                      <td style={{ padding: "0.5rem 1rem", fontWeight: isLast ? 700 : 500, color: "#0F172A" }}>
                        Year {year}{isLast && termMonths % 12 !== 0 ? " *" : ""}
                      </td>
                      <td style={{ padding: "0.5rem 1rem", textAlign: "right", color: "#15803D" }}>{fmtM(annRent, 2)}</td>
                      <td style={{ padding: "0.5rem 1rem", textAlign: "right", color: "#0369A1" }}>{fmtM(annMR, 2)}</td>
                      <td style={{ padding: "0.5rem 1rem", textAlign: "right", fontWeight: 600, color: isLast ? "#002147" : "#0F172A" }}>{fmtM(annTotal, 2)}</td>
                      <td style={{ padding: "0.5rem 1rem", textAlign: "right", color: "#0F172A" }}>{fmtM(discCF, 2)}</td>
                      <td style={{ padding: "0.5rem 1rem", textAlign: "right", fontWeight: 700, color: cumPV >= 0 ? "#15803D" : "#B91C1C" }}>
                        {fmtM(cumPV, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "0.5rem 1rem", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", fontSize: "0.6875rem", color: "#94A3B8", display: "flex", gap: "1.5rem" }}>
            <span>
              <Info size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: "0.25rem" }} />
              Net initial outlay = aircraft value − security deposit. Terminal year includes residual aircraft value less SD return.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
