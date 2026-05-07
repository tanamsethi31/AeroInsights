/**
 * LeasePricingTab — IRR reverse-engineering calculator.
 *
 * Given a target IRR, solves analytically for the minimum monthly base rent
 * that achieves it. No iteration required — the monthly rent appears linearly
 * in the NPV equation once the discount rate is fixed.
 *
 * Cash-flow model:
 *   t=0  : −(aircraftValue − securityDeposit)   [net lessor outlay]
 *   t=1…T: +R                                   [monthly base rent]
 *   t=T  : +RV + SD×sdRecovery − reposCost      [terminal receipts]
 *
 * Solving NPV = 0 for R gives a closed-form answer.
 */

import { useState, useMemo } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";

// ─── Lookup tables ─────────────────────────────────────────────────────────────

const JURISDICTIONS: Record<string, number> = {
  "UAE":            0.20,
  "Canada":         0.30,
  "EU (general)":   0.40,
  "USA":            0.25,
  "Mexico":         1.40,
  "Brazil":         1.80,
  "Sri Lanka":      1.60,
  "India":          2.10,
  "Indonesia":      1.90,
  "China":          3.20,
  "Russia":         5.00,
  "Other":          1.00,
};

// Fraction of SD returned to lessee at lease end (lessor retains remainder as credit protection)
const SD_RECOVERY: Record<string, number> = {
  "1": 1.00,   // Stage 1 — full return, no credit concern
  "2": 0.70,   // Stage 2 — partial retention
  "3": 0.20,   // Stage 3 — largely forfeited
  "custom": 0.60,
};

// Haircut applied to terminal repossession risk based on credit stage
const REPO_HAIRCUT: Record<string, number> = {
  "1": 0.25,   // Low probability of needing repossession
  "2": 0.60,   // Elevated
  "3": 1.00,   // Full expected cost
  "custom": 0.75,
};

// Default residual value factors (fraction of current market value) by lease term bucket
function defaultRV(aircraftValue: number, termMonths: number): number {
  const years = termMonths / 12;
  const annualDepreciation = 0.030;  // ~3% p.a. — narrow-body heuristic
  return aircraftValue * Math.max(0.40, 1 - annualDepreciation * years);
}

// ─── Core formula ──────────────────────────────────────────────────────────────

interface PricingInputs {
  aircraftValue: number;      // $M
  targetIRR: number;          // % p.a.
  termMonths: number;
  securityDeposit: number;    // $M
  jurisdiction: string;
  creditStage: "1" | "2" | "3" | "custom";
  customPD: number;           // % — used for display only in custom mode
  residualValue: number;      // $M
}

/** Returns implied monthly base rent in $k, or null if inputs are degenerate. */
function solveRent(inputs: PricingInputs): number | null {
  const { aircraftValue, targetIRR, termMonths, securityDeposit, jurisdiction, creditStage, residualValue } = inputs;
  if (aircraftValue <= 0 || termMonths <= 0 || targetIRR <= 0) return null;

  const r = Math.pow(1 + targetIRR / 100, 1 / 12) - 1;               // monthly rate
  const annuityFactor = r > 0 ? (1 - Math.pow(1 + r, -termMonths)) / r : termMonths;

  const repoCost   = JURISDICTIONS[jurisdiction] ?? 1.0;               // $M
  const sdRecovery = SD_RECOVERY[creditStage];
  const repoWeight = REPO_HAIRCUT[creditStage];

  const terminalCF = residualValue + securityDeposit * sdRecovery - repoCost * repoWeight;
  const terminalPV = terminalCF / Math.pow(1 + r, termMonths);
  const netOutlay  = aircraftValue - securityDeposit;

  const monthlyRentM = (netOutlay - terminalPV) / annuityFactor;      // $M/month
  return monthlyRentM * 1000;                                          // $k/month
}

// ─── UI helpers ────────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: "0.75rem", fontWeight: 600, color: "#64748B",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem",
  padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "#0F172A",
  outline: "none", background: "#FFFFFF", boxSizing: "border-box",
};

const SELECT_STYLE: React.CSSProperties = { ...INPUT_STYLE, cursor: "pointer" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={LABEL}>{label}</div>
      {children}
    </div>
  );
}

// ─── LeasePricingTab ──────────────────────────────────────────────────────────

export function LeasePricingTab() {
  // ── Inputs ──
  const [aircraftValue, setAircraftValue] = useState(52);        // $M, default A320neo
  const [targetIRR,     setTargetIRR]     = useState(8.5);       // %
  const [termMonths,    setTermMonths]    = useState(60);         // months
  const [secDep,        setSecDep]        = useState(2.5);        // $M
  const [jurisdiction,  setJurisdiction]  = useState("India");
  const [creditStage,   setCreditStage]   = useState<"1" | "2" | "3" | "custom">("2");
  const [customPD,      setCustomPD]      = useState(12);         // %
  const [rvAuto,        setRvAuto]        = useState(true);
  const [rvOverride,    setRvOverride]    = useState(38);         // $M
  const [copied,        setCopied]        = useState(false);

  const rv = rvAuto ? defaultRV(aircraftValue, termMonths) : rvOverride;

  const inputs: PricingInputs = {
    aircraftValue, targetIRR, termMonths,
    securityDeposit: secDep,
    jurisdiction, creditStage, customPD,
    residualValue: rv,
  };

  const rentKpm = solveRent(inputs);      // $k/month
  const rentValid = rentKpm !== null && rentKpm > 0;

  // Lease rate factor = monthly rent / aircraft value
  const lrf = rentValid && aircraftValue > 0 ? ((rentKpm! / 1000) / aircraftValue) * 100 : null;

  // ── Sensitivity table ──
  const TERM_DELTAS  = [-24, -12, 0, +12, +24];
  const RV_FACTORS   = [-0.10, -0.05, 0, +0.05, +0.10];

  const sensitivityGrid = useMemo(() =>
    TERM_DELTAS.map(dt =>
      RV_FACTORS.map(drv => {
        const t = Math.max(12, termMonths + dt);
        const r = rvAuto ? defaultRV(aircraftValue, t) * (1 + drv) : rvOverride * (1 + drv);
        return solveRent({ ...inputs, termMonths: t, residualValue: r });
      })
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aircraftValue, targetIRR, termMonths, secDep, jurisdiction, creditStage, rv],
  );

  // ── Export text ──
  const exportText = rentValid
    ? `Lease Pricing Summary\n` +
      `Aircraft value: $${aircraftValue}M | Term: ${termMonths}m | IRR target: ${targetIRR}%\n` +
      `Jurisdiction: ${jurisdiction} | Stage: ${creditStage} | SD: $${secDep}M | RV: $${rv.toFixed(1)}M\n` +
      `→ Implied monthly base rent: $${rentKpm!.toFixed(1)}k/month (LRF ${lrf!.toFixed(3)}%)`
    : "Inputs insufficient to price.";

  const handleCopy = () => {
    navigator.clipboard.writeText(exportText).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Page intro */}
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1rem 1.25rem" }}>
        <div style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.6 }}>
          <strong style={{ color: "#0F172A" }}>IRR Reverse Engineering</strong> — enter your target return and lease parameters.
          The calculator solves analytically for the minimum monthly base rent required to clear that IRR.
          Maintenance reserves are treated as a pass-through and do not affect the base rent.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1.5rem", alignItems: "start" }}>

        {/* ── INPUT PANEL ── */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", marginBottom: "0.25rem" }}>
            Pricing Inputs
          </div>

          <Field label="Aircraft Market Value ($M)">
            <input type="number" value={aircraftValue} min={5} max={500} step={1}
              onChange={e => setAircraftValue(parseFloat(e.target.value) || 0)}
              style={INPUT_STYLE} />
            <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.25rem" }}>
              e.g. A320neo ≈ $52M · B787-9 ≈ $150M · A350-900 ≈ $165M
            </div>
          </Field>

          <Field label="Target IRR (% p.a.)">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="range" min={3} max={20} step={0.5} value={targetIRR}
                onChange={e => setTargetIRR(parseFloat(e.target.value))}
                style={{ flex: 1 }} />
              <input type="number" value={targetIRR} min={3} max={20} step={0.5}
                onChange={e => setTargetIRR(Math.min(20, Math.max(3, parseFloat(e.target.value) || 8.5)))}
                style={{ ...INPUT_STYLE, width: "64px", textAlign: "right" }} />
            </div>
          </Field>

          <Field label="Lease Term">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="range" min={12} max={144} step={6} value={termMonths}
                onChange={e => setTermMonths(parseInt(e.target.value))}
                style={{ flex: 1 }} />
              <div style={{ ...INPUT_STYLE, width: "80px", textAlign: "right", background: "#F8FAFC" }}>
                {termMonths}m
              </div>
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.25rem" }}>
              {(termMonths / 12).toFixed(1)} years
            </div>
          </Field>

          <Field label="Security Deposit ($M)">
            <input type="number" value={secDep} min={0} max={50} step={0.5}
              onChange={e => setSecDep(parseFloat(e.target.value) || 0)}
              style={INPUT_STYLE} />
          </Field>

          <Field label="Jurisdiction">
            <select value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} style={SELECT_STYLE}>
              {Object.entries(JURISDICTIONS).map(([j, cost]) => (
                <option key={j} value={j}>{j} — avg repo cost ${cost.toFixed(2)}M</option>
              ))}
            </select>
          </Field>

          <Field label="Lessee Credit Stage">
            <select value={creditStage} onChange={e => setCreditStage(e.target.value as typeof creditStage)} style={SELECT_STYLE}>
              <option value="1">Stage 1 — Performing</option>
              <option value="2">Stage 2 — Elevated Risk</option>
              <option value="3">Stage 3 — Impaired</option>
              <option value="custom">Custom PD</option>
            </select>
            {creditStage === "custom" && (
              <input type="number" value={customPD} min={0} max={100} step={1}
                onChange={e => setCustomPD(parseFloat(e.target.value) || 0)}
                placeholder="Custom PD %"
                style={{ ...INPUT_STYLE, marginTop: "0.5rem" }} />
            )}
          </Field>

          <Field label="Residual Value ($M)">
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.375rem" }}>
              {(["auto", "manual"] as const).map(opt => (
                <button key={opt} onClick={() => setRvAuto(opt === "auto")}
                  style={{
                    flex: 1, padding: "0.375rem", fontSize: "0.75rem", fontWeight: 500,
                    borderRadius: "9999px", border: "1px solid",
                    cursor: "pointer",
                    background: (rvAuto ? opt === "auto" : opt === "manual") ? "#002147" : "#FFFFFF",
                    color:  (rvAuto ? opt === "auto" : opt === "manual") ? "#FFFFFF" : "#475569",
                    borderColor: (rvAuto ? opt === "auto" : opt === "manual") ? "#002147" : "#E2E8F0",
                  }}>
                  {opt === "auto" ? "Heuristic" : "Override"}
                </button>
              ))}
            </div>
            {rvAuto ? (
              <div style={{ ...INPUT_STYLE, background: "#F8FAFC", color: "#64748B" }}>
                ${defaultRV(aircraftValue, termMonths).toFixed(1)}M (3% p.a. depreciation)
              </div>
            ) : (
              <input type="number" value={rvOverride} min={0} max={aircraftValue} step={0.5}
                onChange={e => setRvOverride(parseFloat(e.target.value) || 0)}
                style={INPUT_STYLE} />
            )}
          </Field>
        </div>

        {/* ── RESULTS PANEL ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Primary result */}
          <div style={{
            background: rentValid ? "#002147" : "#F8FAFC",
            border: `1px solid ${rentValid ? "#002147" : "#E2E8F0"}`,
            borderRadius: "0.75rem", padding: "1.5rem",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: rentValid ? "rgba(255,255,255,0.6)" : "#94A3B8", marginBottom: "0.5rem" }}>
                Implied Monthly Base Rent
              </div>
              {rentValid ? (
                <>
                  <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "#FFFFFF", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                    ${rentKpm!.toFixed(1)}k
                    <span style={{ fontSize: "1rem", fontWeight: 400, color: "rgba(255,255,255,0.6)", marginLeft: "0.375rem" }}>/month</span>
                  </div>
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "1.5rem" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>LRF </span>
                      <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", fontVariantNumeric: "tabular-nums" }}>
                        {lrf!.toFixed(3)}%
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>Annual </span>
                      <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", fontVariantNumeric: "tabular-nums" }}>
                        ${(rentKpm! * 12 / 1000).toFixed(2)}M/yr
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>RV </span>
                      <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", fontVariantNumeric: "tabular-nums" }}>
                        ${rv.toFixed(1)}M
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: "1rem", color: "#94A3B8" }}>
                  {rentKpm !== null && rentKpm <= 0
                    ? <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <AlertTriangle size={13} style={{ color: "#B91C1C", flexShrink: 0 }} />
                        Doesn&apos;t pencil — IRR target too high for these inputs
                      </span>
                    : "Enter valid inputs to compute rent"}
                </div>
              )}
            </div>
            {rentValid && (
              <button onClick={handleCopy} title="Copy pricing summary"
                style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: "0.5rem", padding: "0.5rem 0.875rem",
                  fontSize: "0.8125rem", color: "#FFFFFF", cursor: "pointer",
                }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Export"}
              </button>
            )}
          </div>

          {/* Assumptions summary */}
          {rentValid && (
            <div style={{
              background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.5rem",
              padding: "0.75rem 1rem", display: "flex", gap: "1.5rem", flexWrap: "wrap",
              fontSize: "0.75rem", color: "#475569",
            }}>
              {[
                ["Repo cost", `$${(JURISDICTIONS[jurisdiction] ?? 1).toFixed(2)}M (${jurisdiction})`],
                ["SD recovery", `${(SD_RECOVERY[creditStage] * 100).toFixed(0)}% (Stage ${creditStage})`],
                ["Repo weight", `${(REPO_HAIRCUT[creditStage] * 100).toFixed(0)}% probability`],
                ["Monthly r", `${((Math.pow(1 + targetIRR / 100, 1 / 12) - 1) * 100).toFixed(4)}%`],
              ].map(([k, v]) => (
                <div key={k}><span style={{ fontWeight: 600, color: "#0F172A" }}>{k}:</span> {v}</div>
              ))}
            </div>
          )}

          {/* Sensitivity table */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>Sensitivity Analysis</div>
              <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.125rem" }}>
                Monthly rent ($k) across ±24 months term and ±10% residual value
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr style={{ background: "#F4F5F7" }}>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                      Term \ RV
                    </th>
                    {RV_FACTORS.map(f => (
                      <th key={f} style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: "0.6875rem", fontWeight: 600, color: f === 0 ? "#002147" : "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                        {f === 0 ? "Base" : `${f > 0 ? "+" : ""}${(f * 100).toFixed(0)}%`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TERM_DELTAS.map((dt, ri) => {
                    const t = Math.max(12, termMonths + dt);
                    const isBaseRow = dt === 0;
                    return (
                      <tr key={dt} style={{ borderBottom: "1px solid #F1F5F9", background: isBaseRow ? "#EFF6FF" : ri % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                        <td style={{ padding: "0.5rem 0.75rem", fontWeight: isBaseRow ? 700 : 500, color: isBaseRow ? "#002147" : "#475569", whiteSpace: "nowrap" }}>
                          {t}m {dt !== 0 && <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>({dt > 0 ? "+" : ""}{dt}m)</span>}
                        </td>
                        {RV_FACTORS.map((drv, ci) => {
                          const val = sensitivityGrid[ri]?.[ci];
                          const isBase = dt === 0 && drv === 0;
                          const valid = val !== null && val > 0;
                          return (
                            <td key={drv} style={{
                              padding: "0.5rem 0.75rem", textAlign: "right",
                              fontWeight: isBase ? 700 : 400,
                              color: !valid ? "#CBD5E1" : isBase ? "#002147" : "#0F172A",
                              background: isBase ? "rgba(0,33,71,0.06)" : undefined,
                            }}>
                              {valid ? `$${val!.toFixed(1)}k` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Model notes */}
          <div style={{ fontSize: "0.75rem", color: "#94A3B8", lineHeight: 1.6, padding: "0 0.25rem" }}>
            <strong style={{ color: "#64748B" }}>Model:</strong> Closed-form NPV inversion at the stated IRR.
            Security deposit treated as day-0 receipt; repossession cost probability-weighted by credit stage.
            Maintenance reserves excluded (pass-through). Base rent only — add MR rate for total lessee cash obligation.
          </div>
        </div>
      </div>
    </div>
  );
}
