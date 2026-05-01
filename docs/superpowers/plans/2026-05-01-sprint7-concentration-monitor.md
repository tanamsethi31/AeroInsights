# Sprint 7 — F12: Portfolio Aggregator & Concentration Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Portfolio → Concentration tab with a richer monitor: a KPI strip, 6 dimension sub-tabs (bar chart + ranked table + user-editable policy threshold), and a lessee × country ECL-density heatmap.

**Architecture:** New `ConcentrationTab.tsx` holds all types, synthetic datasets for 6 concentration dimensions and the heatmap matrix, helper functions, and all UI (following the SDMRTab/AircraftValuationPanel isolation pattern). `Portfolio.tsx` is trimmed: old concentration constants removed, Concentration tab block replaced with `<ConcentrationTab />`.

**Tech Stack:** React 18, TypeScript, Vite, Recharts (`BarChart`, `Bar`, `Cell`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `ReferenceLine`), existing `KpiCard` and `Card` UI components, inline `style={{}}` (no CSS modules).

---

### Task 1: Types, dataset constants, helpers, and stub export

**Files:**
- Create: `src/app/components/portfolio/ConcentrationTab.tsx`

**Context:** No test runner — verification is `npm run build` from `/Users/tanamsethi/Downloads/Aeroinsights`. Follow the isolation pattern of `src/app/components/portfolio/SDMRTab.tsx` — all data, types, logic, and UI in one file.

- [ ] **Step 1: Create the file**

Create `/Users/tanamsethi/Downloads/Aeroinsights/src/app/components/portfolio/ConcentrationTab.tsx` with this exact content:

```tsx
import { useState, useEffect, Fragment } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { KpiCard } from "../ui/KpiCard";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DimKey = "Lessee" | "Country" | "Region" | "Type" | "Vintage" | "Currency";

interface ConcentrationRow {
  name: string;
  exposure: number;    // USD
  exposurePct: number; // % of total portfolio exposure
  ecl: number;         // USD
  eclPct: number;      // ecl / exposure (loss rate %)
}

interface HeatmapCell {
  lessee: string;
  country: string;
  exposure: number; // USD
  ecl: number;      // USD
}

type ThresholdMap = Record<DimKey, number>;

// ─── Constants ────────────────────────────────────────────────────────────────

const M = 1_000_000;

const KPI = {
  bookValue:       2_840_000_000,
  encumberedValue: 2_610_000_000,
  encumberedPct:   91.9,
  totalECL:           47_200_000,
  eclRate:             2.12,
  waLeaseTerm:         5.8,
  waCredit:           "BB+",
};

const DEFAULT_THRESHOLDS: ThresholdMap = {
  Lessee:   15,
  Country:  20,
  Region:   35,
  Type:     35,
  Vintage:  30,
  Currency: 25,
};

// ─── Dataset ──────────────────────────────────────────────────────────────────

const CONCENTRATION_DATA: Record<DimKey, ConcentrationRow[]> = {
  Lessee: [
    { name: "Emirates",                 exposure: 412*M, exposurePct: 18.5, ecl:  2.1*M, eclPct:  0.5 },
    { name: "Ryanair",                  exposure: 386*M, exposurePct: 17.4, ecl:  1.9*M, eclPct:  0.5 },
    { name: "Singapore Airlines",       exposure: 290*M, exposurePct: 13.1, ecl:  1.2*M, eclPct:  0.4 },
    { name: "Air France",               exposure: 278*M, exposurePct: 12.5, ecl:  2.2*M, eclPct:  0.8 },
    { name: "Lufthansa",                exposure: 194*M, exposurePct:  8.7, ecl:  1.2*M, eclPct:  0.6 },
    { name: "IndiGo Airlines",          exposure: 184*M, exposurePct:  8.3, ecl:  4.6*M, eclPct:  2.5 },
    { name: "Aeromexico",               exposure: 122*M, exposurePct:  5.5, ecl:  2.2*M, eclPct:  1.8 },
    { name: "SriLankan Airlines",       exposure: 118*M, exposurePct:  5.3, ecl: 11.8*M, eclPct: 10.0 },
    { name: "Azul Brazilian Airlines",  exposure: 142*M, exposurePct:  6.4, ecl: 11.4*M, eclPct:  8.0 },
    { name: "Air Transat",              exposure:  96*M, exposurePct:  4.3, ecl:  8.6*M, eclPct:  9.0 },
  ],
  Country: [
    { name: "UAE",       exposure: 405*M, exposurePct: 18.2, ecl:  2.0*M, eclPct:  0.5 },
    { name: "Ireland",   exposure: 320*M, exposurePct: 14.4, ecl:  1.6*M, eclPct:  0.5 },
    { name: "France",    exposure: 274*M, exposurePct: 12.3, ecl:  2.2*M, eclPct:  0.8 },
    { name: "Germany",   exposure: 264*M, exposurePct: 11.9, ecl:  1.5*M, eclPct:  0.6 },
    { name: "Singapore", exposure: 265*M, exposurePct: 11.9, ecl:  1.1*M, eclPct:  0.4 },
    { name: "India",     exposure: 216*M, exposurePct:  9.7, ecl:  4.8*M, eclPct:  2.2 },
    { name: "Brazil",    exposure: 142*M, exposurePct:  6.4, ecl: 11.4*M, eclPct:  8.0 },
    { name: "Mexico",    exposure: 122*M, exposurePct:  5.5, ecl:  2.2*M, eclPct:  1.8 },
    { name: "Sri Lanka", exposure: 118*M, exposurePct:  5.3, ecl: 11.8*M, eclPct: 10.0 },
    { name: "Canada",    exposure:  96*M, exposurePct:  4.3, ecl:  8.6*M, eclPct:  9.0 },
  ],
  Region: [
    { name: "Europe",   exposure: 858*M, exposurePct: 38.6, ecl:  5.3*M, eclPct: 0.6 },
    { name: "APAC",     exposure: 599*M, exposurePct: 27.0, ecl: 17.7*M, eclPct: 3.0 },
    { name: "MEA",      exposure: 405*M, exposurePct: 18.2, ecl:  2.0*M, eclPct: 0.5 },
    { name: "Americas", exposure: 360*M, exposurePct: 16.2, ecl: 22.2*M, eclPct: 6.2 },
  ],
  Type: [
    { name: "A350-900",    exposure: 568*M, exposurePct: 25.6, ecl:  3.4*M, eclPct:  0.6 },
    { name: "B737 Family", exposure: 508*M, exposurePct: 22.9, ecl:  4.1*M, eclPct:  0.8 },
    { name: "A320 Family", exposure: 422*M, exposurePct: 19.0, ecl: 24.6*M, eclPct:  5.8 },
    { name: "B777-300ER",  exposure: 412*M, exposurePct: 18.5, ecl:  2.1*M, eclPct:  0.5 },
    { name: "A220-300",    exposure: 194*M, exposurePct:  8.7, ecl:  1.2*M, eclPct:  0.6 },
    { name: "A330-300",    exposure: 118*M, exposurePct:  5.3, ecl: 11.8*M, eclPct: 10.0 },
  ],
  Vintage: [
    { name: "2021–22", exposure: 1_134*M, exposurePct: 51.0, ecl: 16.6*M, eclPct: 1.5  },
    { name: "2019–20", exposure:   402*M, exposurePct: 18.1, ecl: 15.4*M, eclPct: 3.8  },
    { name: "2023+",   exposure:   290*M, exposurePct: 13.1, ecl:  1.2*M, eclPct: 0.4  },
    { name: "2017–18", exposure:   278*M, exposurePct: 12.5, ecl:  2.2*M, eclPct: 0.8  },
    { name: "2015–16", exposure:   118*M, exposurePct:  5.3, ecl: 11.8*M, eclPct: 10.0 },
  ],
  Currency: [
    { name: "USD", exposure: 1_126*M, exposurePct: 50.7, ecl: 21.9*M, eclPct: 1.9 },
    { name: "EUR", exposure:   858*M, exposurePct: 38.6, ecl:  5.3*M, eclPct: 0.6 },
    { name: "BRL", exposure:   142*M, exposurePct:  6.4, ecl: 11.4*M, eclPct: 8.0 },
    { name: "CAD", exposure:    96*M, exposurePct:  4.3, ecl:  8.6*M, eclPct: 9.0 },
  ],
};

const HEATMAP_CELLS: HeatmapCell[] = [
  { lessee: "Emirates",                country: "UAE",       exposure: 380*M, ecl:  1.9*M },
  { lessee: "Emirates",                country: "India",     exposure:  32*M, ecl:  0.2*M },
  { lessee: "Ryanair",                 country: "Ireland",   exposure: 320*M, ecl:  1.6*M },
  { lessee: "Ryanair",                 country: "Germany",   exposure:  66*M, ecl:  0.3*M },
  { lessee: "Singapore Airlines",      country: "Singapore", exposure: 265*M, ecl:  1.1*M },
  { lessee: "Singapore Airlines",      country: "UAE",       exposure:  25*M, ecl:  0.1*M },
  { lessee: "Air France",              country: "France",    exposure: 248*M, ecl:  2.0*M },
  { lessee: "Air France",              country: "Germany",   exposure:  30*M, ecl:  0.2*M },
  { lessee: "Lufthansa",               country: "Germany",   exposure: 168*M, ecl:  1.0*M },
  { lessee: "Lufthansa",               country: "France",    exposure:  26*M, ecl:  0.2*M },
  { lessee: "Azul Brazilian Airlines", country: "Brazil",    exposure: 142*M, ecl: 11.4*M },
  { lessee: "Air Transat",             country: "Canada",    exposure:  96*M, ecl:  8.6*M },
  { lessee: "SriLankan Airlines",      country: "Sri Lanka", exposure: 118*M, ecl: 11.8*M },
  { lessee: "IndiGo Airlines",         country: "India",     exposure: 184*M, ecl:  4.6*M },
  { lessee: "Aeromexico",              country: "Mexico",    exposure: 122*M, ecl:  2.2*M },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtM(n: number): string {
  const m = n / 1_000_000;
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  if (m % 1 === 0) return `$${m.toFixed(0)}M`;
  return `$${m.toFixed(1)}M`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function breachLevel(exposurePct: number, threshold: number): "none" | "amber" | "red" {
  if (exposurePct > threshold * 1.5) return "red";
  if (exposurePct > threshold) return "amber";
  return "none";
}

function barColour(level: "none" | "amber" | "red"): string {
  if (level === "red") return "#B91C1C";
  if (level === "amber") return "#B45309";
  return "#002147";
}

function heatColour(eclPct: number): string {
  if (eclPct >= 10) return "#FECACA";
  if (eclPct >= 5)  return "#FED7AA";
  if (eclPct >= 2)  return "#FEF3C7";
  if (eclPct > 0)   return "#BBF7D0";
  return "#F0FDF4";
}

// ─── ConcentrationTab (stub — UI added in Task 2) ─────────────────────────────

export function ConcentrationTab() {
  return (
    <div style={{ padding: "1rem", color: "#94A3B8", fontSize: "0.8125rem" }}>
      Concentration tab loading…
    </div>
  );
}

// Suppress unused import warnings until Task 2
void useState; void useEffect; void Fragment;
void BarChart; void Bar; void XAxis; void YAxis; void CartesianGrid;
void Tooltip; void ResponsiveContainer; void ReferenceLine; void Cell;
void KpiCard;
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build`
Expected: `✓ built in ~Xs` — no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/portfolio/ConcentrationTab.tsx
git commit -m "feat(sprint7): add ConcentrationTab types, datasets, helpers, stub"
```

---

### Task 2: ConcentrationView sub-component + full ConcentrationTab

**Files:**
- Modify: `src/app/components/portfolio/ConcentrationTab.tsx`

**Context:** Replace everything from `// ─── ConcentrationTab (stub...)` to end of file with the full implementation. The file already has types, data, and helpers from Task 1 — do not touch those sections.

- [ ] **Step 1: Replace stub section with full ConcentrationView + ConcentrationTab**

Remove everything from `// ─── ConcentrationTab (stub — UI added in Task 2) ─────────────────────────────` to end of file, and replace with:

```tsx
// ─── Sub-tab definitions ─────────────────────────────────────────────────────

const VALUE_DIMS: DimKey[] = ["Lessee", "Country", "Region", "Type", "Vintage", "Currency"];
type SubTab = DimKey | "Heatmap";

// ─── ConcentrationView ────────────────────────────────────────────────────────

function ConcentrationView({
  dimKey,
  data,
  threshold,
  onThresholdChange,
}: {
  dimKey: DimKey;
  data: ConcentrationRow[];
  threshold: number;
  onThresholdChange: (val: number) => void;
}) {
  const [draft, setDraft] = useState(String(threshold));
  useEffect(() => { setDraft(String(threshold)); }, [threshold]);

  function handleApply() {
    const val = parseFloat(draft);
    if (!isNaN(val) && val > 0 && val <= 100) onThresholdChange(val);
  }

  const chartHeight = Math.max(220, data.length * 46);
  const xMax = Math.max(30, Math.ceil(threshold * 2));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>

      {/* ── Left: Bar chart ── */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          {dimKey} Concentration — % of Portfolio
        </div>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 52, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
            <XAxis
              type="number"
              domain={[0, xMax]}
              tick={{ fontSize: 10, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
              width={136}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,33,71,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as ConcentrationRow;
                return (
                  <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "0.625rem 0.875rem", fontSize: "0.8125rem" }}>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: "0.25rem" }}>{row.name}</div>
                    <div style={{ color: "#475569" }}>Exposure: {fmtM(row.exposure)} ({fmtPct(row.exposurePct)})</div>
                    <div style={{ color: "#475569" }}>ECL: {fmtM(row.ecl)} · Loss rate: {fmtPct(row.eclPct)}</div>
                  </div>
                );
              }}
            />
            <ReferenceLine
              x={threshold}
              stroke="#B45309"
              strokeDasharray="4 2"
              label={{ value: `${threshold}%`, position: "insideTopRight", fontSize: 9, fill: "#B45309" }}
            />
            <Bar dataKey="exposurePct" radius={[0, 3, 3, 0]}>
              {data.map((row) => (
                <Cell key={row.name} fill={barColour(breachLevel(row.exposurePct, threshold))} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Right: Threshold + Ranked table ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>

        {/* Threshold input */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "0.875rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8125rem", color: "#475569", fontWeight: 500 }}>Policy limit:</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
              style={{ width: "3.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.25rem 0.5rem", textAlign: "right", outline: "none" }}
            />
            <span style={{ fontSize: "0.875rem", color: "#475569" }}>%</span>
          </div>
          <button
            onClick={handleApply}
            style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.3rem 0.875rem", background: "#002147", color: "#FFFFFF", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}
          >
            Apply
          </button>
          <span style={{ fontSize: "0.6875rem", color: "#94A3B8", marginLeft: "auto" }}>
            ▲ amber &gt;{threshold}% · ● red &gt;{(threshold * 1.5).toFixed(0)}%
          </span>
        </div>

        {/* Ranked table */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                {["#", "Name", "Exposure", "% Portfolio", "ECL", "Loss Rate"].map((h) => (
                  <th key={h} style={{ padding: "0.625rem 0.875rem", textAlign: h === "#" ? "center" : "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const level = breachLevel(row.exposurePct, threshold);
                return (
                  <tr key={row.name} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                    <td style={{ padding: "0.5rem 0.875rem", textAlign: "center", fontSize: "0.75rem", color: "#94A3B8", fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: "0.5rem 0.875rem", fontWeight: 600, color: "#0F172A" }}>{row.name}</td>
                    <td style={{ padding: "0.5rem 0.875rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{fmtM(row.exposure)}</td>
                    <td style={{ padding: "0.5rem 0.875rem", fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <span style={{ color: level === "none" ? "#0F172A" : level === "amber" ? "#B45309" : "#B91C1C", fontWeight: level !== "none" ? 700 : 500 }}>
                          {fmtPct(row.exposurePct)}
                        </span>
                        {level !== "none" && (
                          <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "0.1rem 0.3rem", borderRadius: "0.25rem", background: level === "amber" ? "rgba(180,83,9,0.1)" : "rgba(185,28,28,0.1)", color: level === "amber" ? "#B45309" : "#B91C1C", border: `1px solid ${level === "amber" ? "rgba(180,83,9,0.2)" : "rgba(185,28,28,0.2)"}` }}>
                            {level === "amber" ? "▲" : "●"} +{(row.exposurePct - threshold).toFixed(1)}pp
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem 0.875rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>{fmtM(row.ecl)}</td>
                    <td style={{ padding: "0.5rem 0.875rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: row.eclPct >= 5 ? "#B91C1C" : row.eclPct >= 2 ? "#B45309" : "#15803D" }}>
                      {fmtPct(row.eclPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── HeatmapView (stub — replaced in Task 3) ──────────────────────────────────

function HeatmapView() {
  return (
    <div style={{ padding: "3rem", color: "#94A3B8", textAlign: "center", fontSize: "0.8125rem", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem" }}>
      Heatmap loading…
    </div>
  );
}

// ─── ConcentrationTab ─────────────────────────────────────────────────────────

export function ConcentrationTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("Lessee");
  const [thresholds, setThresholds] = useState<ThresholdMap>({ ...DEFAULT_THRESHOLDS });

  function handleThresholdChange(dim: DimKey, val: number) {
    setThresholds((prev) => ({ ...prev, [dim]: val }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        <KpiCard label="Book Value"       value={fmtM(KPI.bookValue)} />
        <KpiCard label="Encumbered Value" value={fmtM(KPI.encumberedValue)} subtitle={`${KPI.encumberedPct}% of book`} />
        <KpiCard label="Total ECL"        value={fmtM(KPI.totalECL)} delta="+5.4% vs Q4" deltaType="negative" />
        <KpiCard label="ECL Rate"         value={fmtPct(KPI.eclRate)} />
        <KpiCard label="WA Lease Term"    value={`${KPI.waLeaseTerm} yrs`} />
        <KpiCard label="WA Credit"        value={KPI.waCredit} />
      </div>

      {/* Sub-tab nav */}
      <div style={{ borderBottom: "1px solid #E2E8F0", display: "flex", gap: 0 }}>
        {([...VALUE_DIMS, "Heatmap"] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            style={{
              padding: "0.625rem 1rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              border: "none",
              borderBottom: activeSubTab === tab ? "2px solid #002147" : "2px solid transparent",
              background: "transparent",
              color: activeSubTab === tab ? "#002147" : "#475569",
              cursor: "pointer",
              transition: "all 200ms ease",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSubTab === "Heatmap" ? (
        <HeatmapView />
      ) : (
        <ConcentrationView
          key={activeSubTab}
          dimKey={activeSubTab}
          data={CONCENTRATION_DATA[activeSubTab]}
          threshold={thresholds[activeSubTab]}
          onThresholdChange={(val) => handleThresholdChange(activeSubTab, val)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build`
Expected: `✓ built in ~Xs` — no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/portfolio/ConcentrationTab.tsx
git commit -m "feat(sprint7): add ConcentrationView bar chart, threshold input, ranked table, and ConcentrationTab with KPI strip and sub-tabs"
```

---

### Task 3: HeatmapView — lessee × country ECL-density grid

**Files:**
- Modify: `src/app/components/portfolio/ConcentrationTab.tsx`

**Context:** Replace the `HeatmapView` stub (the function that returns `<div>Heatmap loading…</div>`) with the full implementation. The `HEATMAP_CELLS`, `fmtM`, `fmtPct`, `heatColour`, and `Fragment` are already in scope from Task 1.

- [ ] **Step 1: Replace the HeatmapView stub**

Find the section:
```tsx
// ─── HeatmapView (stub — replaced in Task 3) ──────────────────────────────────

function HeatmapView() {
  return (
    <div style={{ padding: "3rem", color: "#94A3B8", textAlign: "center", fontSize: "0.8125rem", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem" }}>
      Heatmap loading…
    </div>
  );
}
```

Replace it with:

```tsx
// ─── HeatmapView ──────────────────────────────────────────────────────────────

const HEATMAP_LESSEES = [
  "Emirates", "Ryanair", "Singapore Airlines", "Air France", "Lufthansa",
  "IndiGo Airlines", "SriLankan Airlines", "Azul Brazilian Airlines", "Air Transat", "Aeromexico",
];

const HEATMAP_COUNTRIES = [
  "UAE", "Ireland", "France", "Germany", "Singapore",
  "India", "Sri Lanka", "Brazil", "Canada", "Mexico",
];

const LESSEE_SHORT: Record<string, string> = {
  "Emirates":                "Emirates",
  "Ryanair":                 "Ryanair",
  "Singapore Airlines":      "Singapore AL.",
  "Air France":              "Air France",
  "Lufthansa":               "Lufthansa",
  "IndiGo Airlines":         "IndiGo",
  "SriLankan Airlines":      "SriLankan AL.",
  "Azul Brazilian Airlines": "Azul Brazilian",
  "Air Transat":             "Air Transat",
  "Aeromexico":              "Aeromexico",
};

function HeatmapView() {
  const cellMap = new Map<string, HeatmapCell>();
  HEATMAP_CELLS.forEach((c) => cellMap.set(`${c.lessee}::${c.country}`, c));

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1.25rem", overflowX: "auto" }}>
      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
        Lessee × Country — ECL Density
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `164px repeat(${HEATMAP_COUNTRIES.length}, minmax(68px, 1fr))`,
          gap: "3px",
          minWidth: "880px",
        }}
      >
        {/* Header row */}
        <div /> {/* top-left corner */}
        {HEATMAP_COUNTRIES.map((country) => (
          <div
            key={country}
            style={{ padding: "0.25rem 0.375rem", fontSize: "0.625rem", fontWeight: 600, color: "#475569", textAlign: "center", background: "#F4F5F7", borderRadius: "0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {country}
          </div>
        ))}

        {/* Data rows */}
        {HEATMAP_LESSEES.map((lessee) => (
          <Fragment key={lessee}>
            {/* Row header */}
            <div style={{ padding: "0.375rem 0.5rem", fontSize: "0.75rem", fontWeight: 600, color: "#0F172A", display: "flex", alignItems: "center" }}>
              {LESSEE_SHORT[lessee] ?? lessee}
            </div>
            {/* Cells */}
            {HEATMAP_COUNTRIES.map((country) => {
              const cell = cellMap.get(`${lessee}::${country}`);
              const eclPct = cell ? (cell.ecl / cell.exposure) * 100 : 0;
              const bg = cell ? heatColour(eclPct) : "#F8FAFC";
              return (
                <div
                  key={country}
                  title={cell ? `${lessee} · ${country}\nExposure: ${fmtM(cell.exposure)}\nECL: ${fmtM(cell.ecl)} (${fmtPct(eclPct)} loss rate)` : `${lessee} · ${country}: no exposure`}
                  style={{
                    background: bg,
                    borderRadius: "0.25rem",
                    padding: "0.375rem 0.25rem",
                    textAlign: "center",
                    fontSize: "0.625rem",
                    fontWeight: cell ? 700 : 400,
                    color: cell ? "#0F172A" : "#CBD5E1",
                    minHeight: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: cell ? "default" : "default",
                  }}
                >
                  {cell ? fmtM(cell.exposure) : "—"}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #F1F5F9", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.6875rem", color: "#64748B", fontWeight: 600 }}>ECL loss rate:</span>
        {([ 
          { label: "<2%",   colour: "#BBF7D0" },
          { label: "2–5%",  colour: "#FEF3C7" },
          { label: "5–10%", colour: "#FED7AA" },
          { label: "≥10%",  colour: "#FECACA" },
        ] as { label: string; colour: string }[]).map(({ label, colour }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <div style={{ width: "14px", height: "14px", background: colour, borderRadius: "0.2rem", flexShrink: 0 }} />
            <span style={{ fontSize: "0.6875rem", color: "#475569" }}>{label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <div style={{ width: "14px", height: "14px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.2rem", flexShrink: 0 }} />
          <span style={{ fontSize: "0.6875rem", color: "#475569" }}>No exposure</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build`
Expected: `✓ built in ~Xs` — no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/portfolio/ConcentrationTab.tsx
git commit -m "feat(sprint7): add HeatmapView lessee x country ECL-density grid with legend"
```

---

### Task 4: Wire ConcentrationTab into Portfolio.tsx

**Files:**
- Modify: `src/app/pages/Portfolio.tsx`

**Context:** `Portfolio.tsx` currently has:
1. Module-level constants `concentrationByLessee`, `concentrationByCountry`, `PIE_COLORS` (lines ~56–76) — these are replaced by ConcentrationTab's internal data and must be deleted.
2. Recharts imports `PieChart, Pie, Cell, Legend` — used only in the Concentration tab; all recharts imports can be removed once the Concentration tab block is replaced (the other tabs render tables only).
3. A `{/* Concentration Tab */}` block rendering a 2-column grid of 4 charts — replace the entire `{activeTab === "Concentration" && ( ... )}` block with a single line.

- [ ] **Step 1: Add ConcentrationTab import**

At the top of `/Users/tanamsethi/Downloads/Aeroinsights/src/app/pages/Portfolio.tsx`, after the existing `SDMRTab` import line:

```tsx
import { SDMRTab } from "../components/portfolio/SDMRTab";
```

add:

```tsx
import { ConcentrationTab } from "../components/portfolio/ConcentrationTab";
```

- [ ] **Step 2: Remove recharts import and old concentration constants**

Remove the entire recharts import line:

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
```

Then remove the three module-level constants:

```tsx
const concentrationByLessee = [
  { name: "Emirates", value: 14.5 },
  { name: "Ryanair", value: 13.6 },
  { name: "Singapore Airlines", value: 10.2 },
  { name: "Air France", value: 9.8 },
  { name: "Lufthansa", value: 6.8 },
  { name: "Others", value: 45.1 },
];

const concentrationByCountry = [
  { name: "UAE", pct: 14.5 },
  { name: "Ireland", pct: 13.6 },
  { name: "India", pct: 11.2 },
  { name: "France", pct: 9.8 },
  { name: "Mexico", pct: 8.4 },
  { name: "Brazil", pct: 7.1 },
  { name: "Germany", pct: 6.8 },
  { name: "Other", pct: 28.6 },
];

const PIE_COLORS = ["#002147", "#475569", "#0F4C5C", "#6B7280", "#94A3B8", "#CBD5E1"];
```

- [ ] **Step 3: Replace the Concentration tab block**

Find the entire block (starts `{/* Concentration Tab */}` and ends with its closing `})`):

```tsx
      {/* Concentration Tab */}
      {activeTab === "Concentration" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          ...
        </div>
      )}
```

Replace it with:

```tsx
      {/* Concentration Tab */}
      {activeTab === "Concentration" && <ConcentrationTab />}
```

- [ ] **Step 4: Verify build passes**

Run: `cd /Users/tanamsethi/Downloads/Aeroinsights && npm run build`
Expected: `✓ built in ~Xs` — no TypeScript errors.

If you see "Cannot find name 'BarChart'" or similar, check that all recharts references were removed from the Concentration tab block (they all move into ConcentrationTab.tsx).

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/Portfolio.tsx
git commit -m "feat(sprint7): wire ConcentrationTab into Portfolio, remove old concentration charts"
```

---

## Self-Review

**Spec coverage:**
- ✅ 6 concentration sub-tabs: Lessee, Country, Region, Type, Vintage, Currency — each with bar chart + table
- ✅ Aggregate KPI row: 6 KPIs from synthetic dataset
- ✅ User-editable policy thresholds: `ThresholdMap` state, Apply button, amber/red breach badges
- ✅ ReferenceLine on chart at threshold value
- ✅ Heatmap: lessee × country, ECL loss rate drives cell colour, legend strip
- ✅ `breachLevel` consistent between chart bar colour and table badge
- ✅ `ConcentrationView` remounts on tab change (via `key={activeSubTab}`) so draft threshold resets

**Type consistency:**
- `DimKey`, `ConcentrationRow`, `HeatmapCell`, `ThresholdMap` defined in Task 1, used consistently throughout Tasks 2–4
- `CONCENTRATION_DATA` keyed by `DimKey` matches the `ThresholdMap` keys exactly
- `barColour(breachLevel(...))` call chain consistent in both chart `Cell` fill and table badge logic
- `fmtM`, `fmtPct`, `heatColour` defined in Task 1, referenced in Tasks 2–3 without redefinition

**No placeholders:** All code is complete and explicit. ✅
