import { useState, useRef } from "react";
import { ChevronDown, ChevronUp, Download, RotateCcw } from "lucide-react";
import { Card } from "../ui/Card";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AircraftIAS36 {
  msn: string;
  type: string;
  lessee: string;
  vintage: number;
  carryingAmount: number;
  usefulLifeYears: number;
  wacc: number;
  cashflows: number[];
  residualValue: number;
  fvlcd: number;
  priorImpairments: number;
}

// ─── Default data ─────────────────────────────────────────────────────────────

const CURRENT_YEAR = 2026;

const DEFAULT_AIRCRAFT: AircraftIAS36[] = [
  {
    msn: "9218",
    type: "A320neo",
    lessee: "IndiGo Airlines",
    vintage: 2019,
    carryingAmount: 24.2,
    usefulLifeYears: 2,
    wacc: 0.0875,
    cashflows: [3.42, 3.42],
    residualValue: 14.8,
    fvlcd: 23.1,
    priorImpairments: 0.8,
  },
  {
    msn: "41234",
    type: "B737-800",
    lessee: "Aeromexico",
    vintage: 2020,
    carryingAmount: 32.1,
    usefulLifeYears: 1,
    wacc: 0.0925,
    cashflows: [3.72],
    residualValue: 18.5,
    fvlcd: 27.4,
    priorImpairments: 2.1,
  },
  {
    msn: "62047",
    type: "B777-300ER",
    lessee: "Emirates",
    vintage: 2021,
    carryingAmount: 88.4,
    usefulLifeYears: 4,
    wacc: 0.0575,
    cashflows: [14.88, 14.88, 14.88, 14.88],
    residualValue: 52.0,
    fvlcd: 91.2,
    priorImpairments: 0.0,
  },
  {
    msn: "1728",
    type: "A330-300",
    lessee: "SriLankan Airlines",
    vintage: 2015,
    carryingAmount: 34.2,
    usefulLifeYears: 1,
    wacc: 0.0850,
    cashflows: [5.76],
    residualValue: 20.1,
    fvlcd: 28.3,
    priorImpairments: 3.4,
  },
  {
    msn: "67892",
    type: "B737 MAX 8",
    lessee: "Ryanair",
    vintage: 2022,
    carryingAmount: 44.7,
    usefulLifeYears: 6,
    wacc: 0.0575,
    cashflows: [4.08, 4.08, 4.08, 4.08, 4.08, 4.08],
    residualValue: 28.5,
    fvlcd: 47.3,
    priorImpairments: 0.0,
  },
  {
    msn: "0378",
    type: "A350-900",
    lessee: "Air France",
    vintage: 2018,
    carryingAmount: 68.3,
    usefulLifeYears: 2,
    wacc: 0.0625,
    cashflows: [11.52, 11.52],
    residualValue: 41.0,
    fvlcd: 71.4,
    priorImpairments: 0.0,
  },
];

// ─── Calculations ─────────────────────────────────────────────────────────────

interface IAS36Results {
  viu: number;
  recoverableAmount: number;
  impairmentLoss: number;
  reversalCeiling: number;
  reversal: number;
  dcfRows: { year: number; cashflow: number; discountFactor: number; pv: number }[];
  residualPV: number;
}

function computeIAS36(a: AircraftIAS36): IAS36Results {
  const dcfRows = a.cashflows.map((cf, i) => {
    const t = i + 1;
    const df = 1 / Math.pow(1 + a.wacc, t);
    return { year: t, cashflow: cf, discountFactor: df, pv: cf * df };
  });

  const sumPV = dcfRows.reduce((s, r) => s + r.pv, 0);
  const residualPV = a.residualValue / Math.pow(1 + a.wacc, a.usefulLifeYears);
  const viu = sumPV + residualPV;
  const recoverableAmount = Math.max(a.fvlcd, viu);
  const impairmentLoss = Math.max(0, a.carryingAmount - recoverableAmount);

  const yearsElapsed = CURRENT_YEAR - a.vintage;
  const totalLife = a.usefulLifeYears + yearsElapsed;
  const originalCost = a.carryingAmount + a.priorImpairments;
  const straightLineDep = originalCost / totalLife;
  const depHistoricCost = originalCost - straightLineDep * yearsElapsed;
  const reversalCeiling = Math.max(0, depHistoricCost - a.carryingAmount);
  const reversal =
    a.priorImpairments > 0
      ? Math.max(0, Math.min(recoverableAmount - a.carryingAmount, reversalCeiling))
      : 0;

  return { viu, recoverableAmount, impairmentLoss, reversalCeiling, reversal, dcfRows, residualPV };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${n.toFixed(2)}M`;
const pctFmt = (n: number) => `${(n * 100).toFixed(2)}%`;

function statusBadge(r: IAS36Results) {
  if (r.impairmentLoss > 0)
    return { label: `Impairment ${fmt(r.impairmentLoss)}`, color: "#DC2626", bg: "#FEF2F2" };
  if (r.reversal > 0)
    return { label: `Reversal ${fmt(r.reversal)}`, color: "#16A34A", bg: "#F0FDF4" };
  return { label: "No Impairment", color: "#475569", bg: "#F8FAFC" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  onChange,
  suffix = "",
  prefix = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <label style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        {prefix && <span style={{ fontSize: "0.875rem", color: "#475569" }}>{prefix}</span>}
        <input
          type="number"
          value={value}
          step="0.01"
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: "100%",
            padding: "0.375rem 0.5rem",
            border: "1px solid #E2E8F0",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
            color: "#0F172A",
            background: "#FFFFFF",
            outline: "none",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#002147")}
          onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
        />
        {suffix && <span style={{ fontSize: "0.875rem", color: "#475569", whiteSpace: "nowrap" }}>{suffix}</span>}
      </div>
    </div>
  );
}

function ResultMetric({
  label,
  value,
  color,
  large,
}: {
  label: string;
  value: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: large ? "1.5rem" : "1.125rem",
          fontWeight: 700,
          color: color ?? "#0F172A",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IAS36Tab() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [inputs, setInputs] = useState<AircraftIAS36[]>(DEFAULT_AIRCRAFT);
  const [showCalc, setShowCalc] = useState(false);
  const calcPanelRef = useRef<HTMLDivElement>(null);

  const aircraft = inputs[selectedIdx];
  const results = computeIAS36(aircraft);
  const badge = statusBadge(results);

  function updateField(field: keyof AircraftIAS36, value: number) {
    setInputs((prev) =>
      prev.map((a, i) => (i === selectedIdx ? { ...a, [field]: value } : a))
    );
  }

  function updateCashflow(cfIdx: number, value: number) {
    setInputs((prev) =>
      prev.map((a, i) => {
        if (i !== selectedIdx) return a;
        const updated = [...a.cashflows];
        updated[cfIdx] = value;
        return { ...a, cashflows: updated };
      })
    );
  }

  function resetToDefault() {
    setInputs((prev) =>
      prev.map((a, i) => (i === selectedIdx ? DEFAULT_AIRCRAFT[selectedIdx] : a))
    );
    setShowCalc(false);
  }

  async function handleExport() {
    const payload = {
      aircraft: {
        msn: aircraft.msn,
        type: aircraft.type,
        lessee: aircraft.lessee,
      },
      inputs: {
        carryingAmount: aircraft.carryingAmount,
        usefulLifeYears: aircraft.usefulLifeYears,
        wacc: aircraft.wacc,
        cashflows: aircraft.cashflows,
        residualValue: aircraft.residualValue,
        fvlcd: aircraft.fvlcd,
        priorImpairments: aircraft.priorImpairments,
      },
      outputs: {
        viu: results.viu,
        recoverableAmount: results.recoverableAmount,
        impairmentLoss: results.impairmentLoss,
        reversalCeiling: results.reversalCeiling,
        reversal: results.reversal,
      },
      timestamp: new Date().toISOString(),
      hash: "",
    };

    const text = JSON.stringify({ ...payload, hash: undefined });
    const encoded = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    payload.hash = hashHex;

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `ias36-evidence-${aircraft.msn}-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
      {/* ── Left: Aircraft selector ── */}
      <div
        style={{
          width: "280px",
          flexShrink: 0,
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #E2E8F0" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#002147", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Aircraft
          </span>
        </div>
        {inputs.map((a, i) => {
          const r = computeIAS36(a);
          const b = statusBadge(r);
          const active = i === selectedIdx;
          return (
            <button
              key={a.msn}
              onClick={() => { setSelectedIdx(i); setShowCalc(false); }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                width: "100%",
                padding: "0.75rem 1rem",
                borderLeft: active ? "3px solid #002147" : "3px solid transparent",
                borderRight: "none",
                borderTop: "none",
                borderBottom: i < inputs.length - 1 ? "1px solid #F1F5F9" : "none",
                background: active ? "#F8FAFC" : "#FFFFFF",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
                  {a.type}
                </span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: b.color,
                    background: b.bg,
                    padding: "0.125rem 0.4rem",
                    borderRadius: "9999px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.label}
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                MSN {a.msn} · {a.lessee}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Right: Workspace ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
              {aircraft.type} — MSN {aircraft.msn}
            </h3>
            <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>{aircraft.lessee}</span>
          </div>
          <button
            onClick={resetToDefault}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.8125rem",
              color: "#475569",
              background: "none",
              border: "1px solid #E2E8F0",
              borderRadius: "0.5rem",
              padding: "0.375rem 0.75rem",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={13} />
            Reset to defaults
          </button>
        </div>

        {/* Card 1 — Inputs */}
        <Card title="Inputs" subtitle="Edit values to recompute in real time" blueHeader={false}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Main inputs grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
              <EditableField
                label="Carrying Amount ($M)"
                prefix="$"
                suffix="M"
                value={aircraft.carryingAmount}
                onChange={(v) => updateField("carryingAmount", v)}
              />
              <EditableField
                label="Useful Life Remaining (yrs)"
                suffix="yrs"
                value={aircraft.usefulLifeYears}
                onChange={(v) => {
                  const newLife = Math.max(1, Math.round(v));
                  const currentCFs = aircraft.cashflows;
                  const newCFs =
                    newLife > currentCFs.length
                      ? [...currentCFs, ...Array(newLife - currentCFs.length).fill(currentCFs[currentCFs.length - 1] ?? 0)]
                      : currentCFs.slice(0, newLife);
                  setInputs((prev) =>
                    prev.map((a, i) =>
                      i === selectedIdx ? { ...a, usefulLifeYears: newLife, cashflows: newCFs } : a
                    )
                  );
                }}
              />
              <EditableField
                label="WACC / Discount Rate"
                suffix="%"
                value={parseFloat((aircraft.wacc * 100).toFixed(4))}
                onChange={(v) => updateField("wacc", v / 100)}
              />
              <EditableField
                label="Residual Value ($M)"
                prefix="$"
                suffix="M"
                value={aircraft.residualValue}
                onChange={(v) => updateField("residualValue", v)}
              />
              <EditableField
                label="FVLCD ($M)"
                prefix="$"
                suffix="M"
                value={aircraft.fvlcd}
                onChange={(v) => updateField("fvlcd", v)}
              />
              <EditableField
                label="Prior Impairments ($M)"
                prefix="$"
                suffix="M"
                value={aircraft.priorImpairments}
                onChange={(v) => updateField("priorImpairments", v)}
              />
            </div>

            {/* Cashflow rows */}
            <div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                Contractual Cashflows (Rental Income $M/yr)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                {aircraft.cashflows.map((cf, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: "0.25rem", width: "100px" }}>
                    <label style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>Year {i + 1}</label>
                    <input
                      type="number"
                      value={cf}
                      step="0.01"
                      onChange={(e) => updateCashflow(i, parseFloat(e.target.value) || 0)}
                      style={{
                        padding: "0.375rem 0.5rem",
                        border: "1px solid #E2E8F0",
                        borderRadius: "0.375rem",
                        fontSize: "0.875rem",
                        color: "#0F172A",
                        background: "#FFFFFF",
                        outline: "none",
                        width: "100%",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#002147")}
                      onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Card 2 — Results */}
        <Card
          title="Results"
          subtitle="IAS 36 recoverable amount and impairment assessment"
          headerRight={
            <button
              onClick={() => setShowCalc((p) => !p)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                fontSize: "0.8125rem",
                color: "rgba(255,255,255,0.85)",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: "0.5rem",
                padding: "0.375rem 0.75rem",
                cursor: "pointer",
                transition: "background 140ms ease-out",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.14)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
            >
              <ChevronDown
                size={13}
                style={{
                  transform: showCalc ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)",
                }}
              />
              Show Calculation
            </button>
          }
        >
          {/* Metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1.5rem 2rem", marginBottom: showCalc ? "1.5rem" : 0 }}>
            <ResultMetric label="Value in Use (VIU)" value={fmt(results.viu)} />
            <ResultMetric label="FVLCD" value={fmt(aircraft.fvlcd)} />
            <ResultMetric
              label="Recoverable Amount"
              value={fmt(results.recoverableAmount)}
              color="#002147"
              large
            />
            {results.impairmentLoss > 0 ? (
              <ResultMetric
                label="Impairment Loss"
                value={fmt(results.impairmentLoss)}
                color="#DC2626"
                large
              />
            ) : results.reversal > 0 ? (
              <ResultMetric
                label="Impairment Reversal"
                value={fmt(results.reversal)}
                color="#16A34A"
                large
              />
            ) : (
              <ResultMetric
                label="Impairment Loss"
                value="—"
                color="#64748B"
              />
            )}
            {aircraft.priorImpairments > 0 && (
              <ResultMetric
                label="Reversal Ceiling"
                value={fmt(results.reversalCeiling)}
                color="#475569"
              />
            )}
          </div>

          {/* Show Calculation expandable — animated via max-height */}
          <div
            ref={calcPanelRef}
            style={{
              overflow: "hidden",
              maxHeight: showCalc ? "1200px" : "0px",
              opacity: showCalc ? 1 : 0,
              transition: showCalc
                ? "max-height 320ms cubic-bezier(0.23,1,0.32,1), opacity 200ms ease-out"
                : "max-height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease-in",
            }}
          >
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "1.25rem" }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", marginBottom: "0.75rem" }}>
                DCF Workings — Value in Use
              </div>

              {/* DCF table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    {["Year", "Cashflow ($M)", "Discount Factor", "PV ($M)"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "0.5rem 0.75rem",
                          textAlign: "left",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          color: "#64748B",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.dcfRows.map((row) => (
                    <tr key={row.year} style={{ borderBottom: "1px solid #F8FAFC" }}>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                        Year {row.year}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0F172A" }}>
                        {row.cashflow.toFixed(2)}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#475569" }}>
                        {row.discountFactor.toFixed(6)}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0F172A" }}>
                        {row.pv.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#475569" }}>
                      Residual (Year {aircraft.usefulLifeYears})
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0F172A" }}>
                      {aircraft.residualValue.toFixed(2)}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#475569" }}>
                      {(1 / Math.pow(1 + aircraft.wacc, aircraft.usefulLifeYears)).toFixed(6)}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0F172A" }}>
                      {results.residualPV.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#002147", fontSize: "0.875rem" }}>
                      VIU (Sum of PVs)
                    </td>
                    <td style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#002147", fontSize: "0.875rem", fontVariantNumeric: "tabular-nums" }}>
                      {results.viu.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Step summary */}
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.875rem 1rem",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0.5rem",
                  fontSize: "0.8125rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                }}
              >
                <div style={{ color: "#475569" }}>
                  <span style={{ fontWeight: 600, color: "#0F172A" }}>Step 1 — Recoverable Amount:</span>{" "}
                  max(FVLCD {fmt(aircraft.fvlcd)}, VIU {fmt(results.viu)}) = <strong>{fmt(results.recoverableAmount)}</strong>
                </div>
                <div style={{ color: "#475569" }}>
                  <span style={{ fontWeight: 600, color: "#0F172A" }}>Step 2 — Impairment Loss:</span>{" "}
                  max(0, Carrying {fmt(aircraft.carryingAmount)} − Recoverable {fmt(results.recoverableAmount)}) ={" "}
                  <strong style={{ color: results.impairmentLoss > 0 ? "#DC2626" : "#475569" }}>
                    {fmt(results.impairmentLoss)}
                  </strong>
                </div>
                {aircraft.priorImpairments > 0 && (
                  <div style={{ color: "#475569" }}>
                    <span style={{ fontWeight: 600, color: "#0F172A" }}>Step 3 — Reversal (IAS 36.117):</span>{" "}
                    min(Recoverable − Carrying, Reversal Ceiling {fmt(results.reversalCeiling)}) ={" "}
                    <strong style={{ color: results.reversal > 0 ? "#16A34A" : "#475569" }}>
                      {fmt(results.reversal)}
                    </strong>
                  </div>
                )}
                <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#94A3B8" }}>
                  WACC: {pctFmt(aircraft.wacc)} · Vintage: {aircraft.vintage} · Years elapsed: {CURRENT_YEAR - aircraft.vintage}
                </div>
              </div>
            </div>
          </div>{/* end animated wrapper */}
        </Card>

        {/* Card 3 — Export */}
        <Card
          title="Auditor Evidence Pack"
          subtitle="JSON export of all inputs and computed outputs with SHA-256 integrity hash"
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "0.8125rem", color: "#64748B" }}>
              Includes: aircraft metadata, all editable inputs, VIU DCF table, recoverable amount,
              impairment loss / reversal, reversal ceiling, WACC, timestamp, and integrity hash.
            </div>
            <button
              onClick={handleExport}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "#002147",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "9999px",
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                marginLeft: "1.5rem",
              }}
            >
              <Download size={14} />
              Download Evidence Pack (JSON)
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
