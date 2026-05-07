import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "../ui/Card";

// ─── Types ────────────────────────────────────────────────────────────────────

type PriorityLevel = "High" | "Moderate-High" | "Moderate" | "Low-Moderate" | "Low";

interface Regime {
  id: string;
  name: string;
  jurisdiction: string;
  flag: string;
  stayDuration: string;
  cureWindow: string;
  executoryContracts: string;
  lessorPriority: PriorityLevel;
  priorityNote: string;
  recoveryMonths: { p25: number; p50: number; p75: number; p90: number };
  haircutPct: { p25: number; p50: number; p75: number; p90: number };
  keyRisk: string;
  lesseeExamples: string[];
}

type LesseeOption = "IndiGo" | "Aeromexico" | "SriLankan" | "Azul" | "Air Transat" | "Emirates" | "Custom";

// ─── Regime Data ──────────────────────────────────────────────────────────────

const REGIMES: Regime[] = [
  {
    id: "chapter11",
    name: "US Chapter 11 (§1110 / §365)",
    jurisdiction: "United States",
    flag: "🇺🇸",
    stayDuration: "Automatic stay. 60-day §1110 cure window for aircraft leases",
    cureWindow: "60 days from filing; lessor may repossess if not cured or assumption agreed",
    executoryContracts: "§365 — trustee may assume or reject; §1110 provides lessor a priority cure mechanism",
    lessorPriority: "High",
    priorityNote: "§1110 is the gold standard for aviation lessor protection",
    recoveryMonths: { p25: 6, p50: 12, p75: 18, p90: 36 },
    haircutPct: { p25: 0, p50: 8, p75: 18, p90: 35 },
    keyRisk: "DIP financing priority may prime some lessor claims in extended cases",
    lesseeExamples: ["Aeromexico"],
  },
  {
    id: "india_ibc",
    name: "India IBC (CTC Act 2025)",
    jurisdiction: "India",
    flag: "🇮🇳",
    stayDuration: "Moratorium under §14 IBC. CTC Act 2025 amends to mandate 90-day cure / repossession window",
    cureWindow: "90 days (CTC Act 2025). Pre-2025 cases could run 270 days",
    executoryContracts: "Cape Town Convention applies; CTC Act 2025 requires courts to honour deregistration requests",
    lessorPriority: "Moderate-High",
    priorityNote: "Material improvement from pre-2025 IBC position",
    recoveryMonths: { p25: 8, p50: 18, p75: 30, p90: 48 },
    haircutPct: { p25: 5, p50: 15, p75: 28, p90: 45 },
    keyRisk: "Court congestion; political pressure on airline-industry employers",
    lesseeExamples: ["IndiGo"],
  },
  {
    id: "brazil_rj",
    name: "Brazil RJ (Recuperação Judicial)",
    jurisdiction: "Brazil",
    flag: "🇧🇷",
    stayDuration: "180-day initial stay; extensions common (AerCap LATAM precedent: 380 days)",
    cureWindow: "60 days (CTC in force since 2013 but enforcement mixed)",
    executoryContracts: "RJ plan must include lease treatment; lessor has retention-of-title claim",
    lessorPriority: "Moderate",
    priorityNote: "CTC helps but Brazilian courts have historically allowed extensions",
    recoveryMonths: { p25: 12, p50: 24, p75: 36, p90: 60 },
    haircutPct: { p25: 8, p50: 20, p75: 35, p90: 55 },
    keyRisk: "RJ plan can cram down lessor with 55% majority creditor vote",
    lesseeExamples: ["Azul"],
  },
  {
    id: "mexico_concurso",
    name: "Mexico Concurso Mercantil",
    jurisdiction: "Mexico",
    flag: "🇲🇽",
    stayDuration: "Automatic stay on filing; conciliador appointed within 5 days",
    cureWindow: "90 days from conciliador appointment",
    executoryContracts: "Contract reviewed by conciliador; CTC in force and Cape Town certificates honoured",
    lessorPriority: "Moderate",
    priorityNote: "Foreign lessor protection strong but concurso can be prolonged",
    recoveryMonths: { p25: 10, p50: 20, p75: 36, p90: 54 },
    haircutPct: { p25: 6, p50: 18, p75: 32, p90: 52 },
    keyRisk: "Concurso can convert to quiebra (liquidation) in contested cases",
    lesseeExamples: ["Aeromexico (prior 2010 filing precedent)"],
  },
  {
    id: "indonesia_pkpu",
    name: "Indonesia PKPU",
    jurisdiction: "Indonesia",
    flag: "🇮🇩",
    stayDuration: "45-day initial + up to 270-day maximum suspension of payments",
    cureWindow: "N/A — PKPU is a suspension, not a cure; lessor must negotiate within the plan",
    executoryContracts: "PKPU plan requires 50%+ creditor vote by value; not CTC-compliant",
    lessorPriority: "Low-Moderate",
    priorityNote: "Government often pressures for airline continuity; repossession difficult",
    recoveryMonths: { p25: 12, p50: 24, p75: 42, p90: 72 },
    haircutPct: { p25: 10, p50: 25, p75: 42, p90: 65 },
    keyRisk: "Indonesia is not a Cape Town Convention signatory for aircraft; no deregistration priority",
    lesseeExamples: ["(none in current portfolio — general exposure)"],
  },
  {
    id: "generic_liquidation",
    name: "Generic Civil-Law Liquidation",
    jurisdiction: "Various",
    flag: "bi-globe",
    stayDuration: "Immediate stay on appointment of liquidator; no cure mechanism",
    cureWindow: "None — full liquidation process; lessor files as a creditor",
    executoryContracts: "All executory contracts terminated; lessor ranks with unsecured creditors if no retention-of-title registration",
    lessorPriority: "Low",
    priorityNote: "Pari passu with general unsecured unless perfected security interest",
    recoveryMonths: { p25: 18, p50: 36, p75: 60, p90: 96 },
    haircutPct: { p25: 15, p50: 35, p75: 55, p90: 80 },
    keyRisk: "Maximum loss scenario for lessor; used as the baseline floor assumption",
    lesseeExamples: ["Applicable to any jurisdiction not covered above"],
  },
];

const REGIME_BY_ID: Record<string, Regime> = Object.fromEntries(REGIMES.map(r => [r.id, r]));

// Lessee portfolio data — EAD in dollars and default regime id
const LESSEE_DATA: Record<LesseeOption, { ead: number; regimeId: string } | null> = {
  IndiGo:      { ead: 184_000_000, regimeId: "india_ibc" },
  Aeromexico:  { ead: 122_000_000, regimeId: "chapter11" },
  SriLankan:   { ead: 118_000_000, regimeId: "generic_liquidation" },
  Azul:        { ead: 142_000_000, regimeId: "brazil_rj" },
  "Air Transat": { ead: 96_000_000, regimeId: "generic_liquidation" },
  Emirates:    { ead: 412_000_000, regimeId: "generic_liquidation" },
  Custom:      null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLOUR: Record<PriorityLevel, string> = {
  "High":          "#15803D",
  "Moderate-High": "#0369A1",
  "Moderate":      "#B45309",
  "Low-Moderate":  "#92400E",
  "Low":           "#B91C1C",
};

const PRIORITY_BG: Record<PriorityLevel, string> = {
  "High":          "rgba(21,128,61,0.1)",
  "Moderate-High": "rgba(3,105,161,0.1)",
  "Moderate":      "rgba(180,83,9,0.1)",
  "Low-Moderate":  "rgba(146,64,14,0.1)",
  "Low":           "rgba(185,28,28,0.1)",
};

function fmtM(n: number): string {
  const m = n / 1_000_000;
  return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
}

function recoveryColor(pct: number): string {
  return pct >= 70 ? "#15803D" : pct >= 50 ? "#B45309" : "#B91C1C";
}

function recoveryBg(pct: number): string {
  return pct >= 70 ? "rgba(21,128,61,0.1)" : pct >= 50 ? "rgba(180,83,9,0.1)" : "rgba(185,28,28,0.1)";
}

// ─── InsolvencyTab ────────────────────────────────────────────────────────────

export function InsolvencyTab() {
  const [selectedRegimeId, setSelectedRegimeId] = useState<string>("chapter11");
  const [selectedLessee, setSelectedLessee] = useState<LesseeOption>("Aeromexico");
  const [ead, setEad] = useState<number>(122); // in $M
  const [pRestructure, setPRestructure] = useState<number>(60);
  const [pAssumed, setPAssumed] = useState<number>(45);
  const [haircutOverride, setHaircutOverride] = useState<number | null>(null);

  const regime = REGIME_BY_ID[selectedRegimeId];
  const haircutPct = haircutOverride !== null ? haircutOverride : regime.haircutPct.p50;
  const pRejected = 100 - pAssumed;

  // Computation
  const pR = pRestructure / 100;
  const pA = pAssumed / 100;
  const pRej = pRejected / 100;
  const pLiq = 1 - pR;

  const pFullRecovery = pR * pA;
  const pHaircutLoss = pR * pRej;
  // pLiq is already computed

  const expectedRecoveryPct =
    pFullRecovery * 100 +
    pHaircutLoss * (100 - haircutPct) +
    pLiq * (100 - regime.haircutPct.p90);

  const eadDollars = ead * 1_000_000;
  const expectedLoss = eadDollars * (1 - expectedRecoveryPct / 100);

  function handleLesseeChange(lessee: LesseeOption) {
    setSelectedLessee(lessee);
    const data = LESSEE_DATA[lessee];
    if (data) {
      setEad(data.ead / 1_000_000);
      setSelectedRegimeId(data.regimeId);
      setHaircutOverride(null);
    }
  }

  function handleRegimeChange(regimeId: string) {
    setSelectedRegimeId(regimeId);
    setHaircutOverride(null);
    setSelectedLessee("Custom");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" }}>

      {/* ── Left: Regime Selector ─────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {REGIMES.map(r => {
          const isSelected = r.id === selectedRegimeId;
          return (
            <button
              key={r.id}
              onClick={() => handleRegimeChange(r.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "0.25rem",
                padding: "0.75rem",
                background: isSelected ? "#F4F5F7" : "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderLeft: isSelected ? "3px solid #002147" : "3px solid transparent",
                borderRadius: "0.5rem",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                <span style={{ fontSize: "1.125rem", lineHeight: 1 }}>
                  {r.flag.startsWith("bi-")
                    ? <i className={`bi ${r.flag}`} />
                    : r.flag}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", lineHeight: 1.3 }}>{r.name}</div>
                  <div style={{ fontSize: "0.6875rem", color: "#64748B" }}>{r.jurisdiction}</div>
                </div>
              </div>
              <span style={{
                fontSize: "0.6875rem", fontWeight: 600,
                color: PRIORITY_COLOUR[r.lessorPriority],
                background: PRIORITY_BG[r.lessorPriority],
                borderRadius: "4px", padding: "0.1rem 0.375rem",
              }}>
                {r.lessorPriority}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Right: Detail + Simulation ────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Section A: Regime Detail Card */}
        <Card
          title={`${regime.flag.startsWith("bi-") ? "" : regime.flag + " "}${regime.name}`}
          subtitle={regime.jurisdiction}
          headerRight={
            <span style={{
              fontSize: "0.75rem", fontWeight: 600,
              color: PRIORITY_COLOUR[regime.lessorPriority],
              background: PRIORITY_BG[regime.lessorPriority],
              borderRadius: "4px", padding: "0.2rem 0.6rem",
            }}>
              {regime.lessorPriority}
            </span>
          }
        >
          {/* 4-column grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
            {[
              { label: "Stay Duration", value: regime.stayDuration },
              { label: "Cure Window", value: regime.cureWindow },
              { label: "Executory Contracts", value: regime.executoryContracts },
              { label: "Lessor Priority", value: regime.priorityNote },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.375rem" }}>{label}</div>
                <div style={{ fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.5 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Recovery distribution table */}
          <div style={{ marginBottom: "1rem", overflowX: "auto" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.5rem" }}>Recovery Distribution</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ background: "#F4F5F7" }}>
                  {["Percentile", "P25", "P50", "P75", "P90"].map(h => (
                    <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: "#FFFFFF" }}>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontWeight: 500 }}>Recovery (months)</td>
                  {["p25", "p50", "p75", "p90"].map(p => (
                    <td key={p} style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0F172A" }}>
                      {regime.recoveryMonths[p as keyof typeof regime.recoveryMonths]}
                    </td>
                  ))}
                </tr>
                <tr style={{ background: "#F8FAFC" }}>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontWeight: 500 }}>Haircut %</td>
                  {["p25", "p50", "p75", "p90"].map(p => (
                    <td key={p} style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0F172A" }}>
                      {regime.haircutPct[p as keyof typeof regime.haircutPct]}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Key risk */}
          <div style={{ background: "rgba(180,83,9,0.08)", border: "1px solid rgba(180,83,9,0.2)", borderRadius: "0.375rem", padding: "0.625rem 0.875rem", marginBottom: "0.75rem", display: "flex", gap: "0.5rem" }}>
            <AlertTriangle size={15} style={{ color: "#92400E", flexShrink: 0 }} />
            <span style={{ fontSize: "0.8125rem", color: "#92400E" }}><strong>Key risk:</strong> {regime.keyRisk}</span>
          </div>

          {/* Examples */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>Portfolio examples:</span>
            {regime.lesseeExamples.map(ex => (
              <span key={ex} style={{ fontSize: "0.75rem", background: "#F1F5F9", color: "#475569", borderRadius: "4px", padding: "0.1rem 0.5rem" }}>{ex}</span>
            ))}
          </div>
        </Card>

        {/* Section B: Branching Simulation */}
        <Card title="Expected Recovery Simulator" subtitle="Weighted expected recovery from branching probability tree">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>

            {/* Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* Lessee selector */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>Lessee</label>
                <select
                  value={selectedLessee}
                  onChange={e => handleLesseeChange(e.target.value as LesseeOption)}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                >
                  {(Object.keys(LESSEE_DATA) as LesseeOption[]).map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* EAD */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>EAD ($M)</label>
                <input
                  type="number" min={0} step={1}
                  value={ead}
                  onChange={e => setEad(Math.max(0, Number(e.target.value)))}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", boxSizing: "border-box" as const, fontVariantNumeric: "tabular-nums" }}
                />
              </div>

              {/* Regime override */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>Insolvency Regime</label>
                <select
                  value={selectedRegimeId}
                  onChange={e => { setSelectedRegimeId(e.target.value); setHaircutOverride(null); setSelectedLessee("Custom"); }}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                >
                  {REGIMES.map(r => (
                    <option key={r.id} value={r.id}>{r.flag.startsWith("bi-") ? "" : r.flag + " "}{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Slider 1: P(restructure | filing) */}
              <SimSlider
                label="P(restructure | filing)"
                value={pRestructure}
                onChange={setPRestructure}
                min={0} max={100} step={1}
                fmt={v => `${v}%`}
              />

              {/* Slider 2: P(lease assumed | restructure) */}
              <SimSlider
                label="P(lease assumed | restructure)"
                value={pAssumed}
                onChange={setPAssumed}
                min={0} max={100} step={1}
                fmt={v => `${v}%`}
              />

              {/* P(rejected) — derived, read-only */}
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  P(rejected | restructure) <span style={{ fontWeight: 400, color: "#94A3B8" }}>(derived)</span>
                </div>
                <div style={{ padding: "0.5rem 0.75rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.375rem", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums", color: "#475569" }}>
                  {pRejected}%
                </div>
              </div>

              {/* Slider 3: Haircut in rejection scenario */}
              <SimSlider
                label={`Haircut in rejection scenario (default: P50 = ${regime.haircutPct.p50}%)`}
                value={haircutOverride !== null ? haircutOverride : regime.haircutPct.p50}
                onChange={v => setHaircutOverride(v)}
                min={0} max={100} step={1}
                fmt={v => `${v}%`}
              />
            </div>

            {/* Outputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* KPI tiles */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <KpiTile
                  label="Expected Recovery"
                  value={`${expectedRecoveryPct.toFixed(1)}%`}
                  color={recoveryColor(expectedRecoveryPct)}
                  bg={recoveryBg(expectedRecoveryPct)}
                />
                <KpiTile
                  label="Expected Loss"
                  value={fmtM(expectedLoss)}
                  color="#B91C1C"
                  bg="rgba(185,28,28,0.08)"
                />
                <KpiTile
                  label="P50 Timeline"
                  value={`${regime.recoveryMonths.p50} mo`}
                  color="#002147"
                  bg="rgba(0,33,71,0.08)"
                />
              </div>

              {/* Probability tree */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.875rem" }}>Probability Tree</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", fontSize: "0.8125rem" }}>

                  {/* Row 1: Filing */}
                  <TreeRow
                    indent={0}
                    label="Filing"
                    value={null}
                    outcome={null}
                    color="#002147"
                  />

                  {/* Row 2: Restructure branch */}
                  <TreeRow
                    indent={1}
                    label={`Restructure`}
                    value={`${pRestructure}%`}
                    outcome={null}
                    color="#0369A1"
                  />

                  {/* Row 3: Assumed */}
                  <TreeRow
                    indent={2}
                    label="Lease Assumed"
                    value={`${pAssumed}%`}
                    outcome="Full recovery"
                    color="#15803D"
                  />

                  {/* Row 4: Rejected */}
                  <TreeRow
                    indent={2}
                    label="Lease Rejected"
                    value={`${pRejected}%`}
                    outcome={`Haircut ${haircutPct}%`}
                    color="#B45309"
                  />

                  {/* Row 5: Liquidation */}
                  <TreeRow
                    indent={1}
                    label="Liquidation"
                    value={`${(pLiq * 100).toFixed(0)}%`}
                    outcome={`P90 haircut ${regime.haircutPct.p90}%`}
                    color="#B91C1C"
                  />

                  {/* Summary row */}
                  <div style={{ borderTop: "1px solid #E2E8F0", marginTop: "0.25rem", paddingTop: "0.625rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>Weighted Expected Recovery</span>
                    <span style={{
                      fontSize: "0.875rem", fontWeight: 700,
                      color: recoveryColor(expectedRecoveryPct),
                      background: recoveryBg(expectedRecoveryPct),
                      borderRadius: "4px", padding: "0.15rem 0.5rem",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {expectedRecoveryPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SimSlider({ label, value, onChange, min, max, step, fmt }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number; max: number; step: number;
  fmt: (v: number) => string;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>{label}</label>
        <span style={{ fontSize: "0.75rem", fontVariantNumeric: "tabular-nums", color: "#0F172A", fontWeight: 600 }}>{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: "100%", height: "4px", appearance: "auto",
          accentColor: "#002147",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.15rem" }}>
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}

function KpiTile({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}22`, borderRadius: "0.5rem", padding: "0.75rem", textAlign: "center" as const }}>
      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.375rem" }}>{label}</div>
      <div style={{ fontSize: "1.125rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function TreeRow({ indent, label, value, outcome, color }: {
  indent: 0 | 1 | 2;
  label: string;
  value: string | null;
  outcome: string | null;
  color: string;
}) {
  const paddingLeft = indent === 0 ? 0 : indent === 1 ? 16 : 32;
  const prefix = indent === 0
    ? <i className="bi bi-circle-fill" style={{ color: "#002147", fontSize: "0.55rem" }} />
    : indent === 1 ? "├─" : "└─";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingLeft }}>
      <span style={{ fontSize: "0.75rem", color: "#94A3B8", flexShrink: 0, fontFamily: "monospace" }}>{prefix}</span>
      <span style={{ fontWeight: 600, color }}>{label}</span>
      {value && (
        <span style={{ fontSize: "0.75rem", fontVariantNumeric: "tabular-nums", background: `${color}18`, color, borderRadius: "4px", padding: "0.1rem 0.35rem", fontWeight: 600 }}>{value}</span>
      )}
      {outcome && (
        <>
          <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>→</span>
          <span style={{ fontSize: "0.75rem", color: "#475569", fontStyle: "italic" as const }}>{outcome}</span>
        </>
      )}
    </div>
  );
}
