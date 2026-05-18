// src/app/pages/ExcelAddinDocs.tsx
// Full documentation for the Aeroinsights Excel Add-in and AER.* custom functions.

import { useState } from "react";

const FUNCTIONS = [
  // ECL & Risk
  {
    id: "AER.ECL",
    group: "ECL & Risk",
    syntax: `=AER.ECL(leaseId, scenario, asOfDate)`,
    description: "Returns the Expected Credit Loss in $M for a single lease under a named scenario.",
    params: [
      { name: "leaseId",   type: "Text",     desc: 'Internal lease identifier, e.g. "LSE-2019-001"' },
      { name: "scenario",  type: "Text",     desc: '"Baseline", "Adverse", or "Upside"' },
      { name: "asOfDate",  type: "Text",     desc: 'ISO 8601 date, e.g. "2026-04-29"' },
    ],
    returns: "Number — ECL in $M (positive).",
    example: `=AER.ECL("LSE-2019-001","Baseline","2026-04-29")`,
    notes: "Uses the PD curve, LGD recovery factor, and scenario weights configured in Settings → Model Params.",
  },
  {
    id: "AER.PORTFOLIO_ECL",
    group: "ECL & Risk",
    syntax: `=AER.PORTFOLIO_ECL(scenario, asOfDate)`,
    description: "Returns the total portfolio ECL in $M across all active leases.",
    params: [
      { name: "scenario",  type: "Text", desc: '"Baseline", "Adverse", or "Upside"' },
      { name: "asOfDate",  type: "Text", desc: 'ISO 8601 date' },
    ],
    returns: "Number — aggregate ECL in $M.",
    example: `=AER.PORTFOLIO_ECL("Baseline","2026-04-29")`,
    notes: "Equivalent to the Total ECL figure shown on the Risk ECL page.",
  },
  {
    id: "AER.STAGE",
    group: "ECL & Risk",
    syntax: `=AER.STAGE(leaseId, asOfDate)`,
    description: "Returns the IFRS 9 impairment stage (1, 2, or 3) for a lease.",
    params: [
      { name: "leaseId",  type: "Text", desc: "Internal lease identifier" },
      { name: "asOfDate", type: "Text", desc: "ISO 8601 date" },
    ],
    returns: "Number — 1, 2, or 3.",
    example: `=AER.STAGE("LSE-2019-001","2026-04-29")`,
    notes: "Stage assignments respect any manual SICR overrides set in the Risk ECL page.",
  },
  {
    id: "AER.LGD",
    group: "ECL & Risk",
    syntax: `=AER.LGD(leaseId)`,
    description: "Returns the Loss Given Default as a decimal, net of security deposit and maintenance reserve offsets.",
    params: [
      { name: "leaseId", type: "Text", desc: "Internal lease identifier" },
    ],
    returns: "Number — decimal between 0 and 1.",
    example: `=AER.LGD("LSE-2019-001")`,
    notes: "Uses the recovery factor from Settings → Model Params (or the org-level LGD override if set).",
  },
  {
    id: "AER.PD",
    group: "ECL & Risk",
    syntax: `=AER.PD(leaseId, horizon)`,
    description: "Returns the Probability of Default for a lease over a given horizon.",
    params: [
      { name: "leaseId", type: "Text", desc: "Internal lease identifier" },
      { name: "horizon", type: "Text", desc: '"12m" for 12-month PD, "lifetime" for lifetime PD' },
    ],
    returns: "Number — decimal probability (e.g. 0.032 = 3.2%).",
    example: `=AER.PD("LSE-2019-001","12m")`,
    notes: "Reads from the active PD curve. Override the curve in Settings → Model Params.",
  },
  {
    id: "AER.EAD",
    group: "ECL & Risk",
    syntax: `=AER.EAD(leaseId)`,
    description: "Returns the Exposure at Default in $M.",
    params: [
      { name: "leaseId", type: "Text", desc: "Internal lease identifier" },
    ],
    returns: "Number — EAD in $M.",
    example: `=AER.EAD("LSE-2019-001")`,
    notes: "Calculated as net book value less security deposit and maintenance reserves.",
  },
  // Maintenance & SD
  {
    id: "AER.MR_BALANCE",
    group: "Maintenance & SD",
    syntax: `=AER.MR_BALANCE(leaseId, asOfDate)`,
    description: "Returns the maintenance reserve balance in $M for a lease at a given date.",
    params: [
      { name: "leaseId",  type: "Text", desc: "Internal lease identifier" },
      { name: "asOfDate", type: "Text", desc: "ISO 8601 date" },
    ],
    returns: "Number — MR balance in $M.",
    example: `=AER.MR_BALANCE("LSE-2019-001","2026-04-29")`,
  },
  {
    id: "AER.SD_POSTED",
    group: "Maintenance & SD",
    syntax: `=AER.SD_POSTED(leaseId)`,
    description: "Returns the security deposit posted for a lease in $M.",
    params: [
      { name: "leaseId", type: "Text", desc: "Internal lease identifier" },
    ],
    returns: "Number — security deposit in $M.",
    example: `=AER.SD_POSTED("LSE-2019-001")`,
  },
  {
    id: "AER.MR_SHORTFALL",
    group: "Maintenance & SD",
    syntax: `=AER.MR_SHORTFALL(leaseId)`,
    description: "Returns the projected maintenance reserve shortfall at end of lease in $M. Negative values indicate a surplus.",
    params: [
      { name: "leaseId", type: "Text", desc: "Internal lease identifier" },
    ],
    returns: "Number — shortfall in $M (negative = surplus).",
    example: `=AER.MR_SHORTFALL("LSE-2019-001")`,
  },
  // Jurisdictions
  {
    id: "AER.REPO_P50",
    group: "Jurisdictions",
    syntax: `=AER.REPO_P50(jurisdictionCode)`,
    description: "Returns the P50 repossession timeline in months for a jurisdiction.",
    params: [
      { name: "jurisdictionCode", type: "Text", desc: 'ISO 3166-1 alpha-2 country code, e.g. "IE", "US", "SG"' },
    ],
    returns: "Number — months.",
    example: `=AER.REPO_P50("IE")`,
  },
  {
    id: "AER.REPO_P90",
    group: "Jurisdictions",
    syntax: `=AER.REPO_P90(jurisdictionCode)`,
    description: "Returns the P90 repossession timeline in months (worst-case estimate).",
    params: [
      { name: "jurisdictionCode", type: "Text", desc: "ISO 3166-1 alpha-2 country code" },
    ],
    returns: "Number — months.",
    example: `=AER.REPO_P90("IE")`,
  },
  {
    id: "AER.REPO_COST",
    group: "Jurisdictions",
    syntax: `=AER.REPO_COST(jurisdictionCode)`,
    description: "Returns the expected repossession cost as a proportion of aircraft value.",
    params: [
      { name: "jurisdictionCode", type: "Text", desc: "ISO 3166-1 alpha-2 country code" },
    ],
    returns: "Number — decimal (e.g. 0.08 = 8%).",
    example: `=AER.REPO_COST("IE")`,
  },
  {
    id: "AER.CTC_SCORE",
    group: "Jurisdictions",
    syntax: `=AER.CTC_SCORE(jurisdictionCode)`,
    description: "Returns the Cape Town Convention compliance score (0–100) for a jurisdiction.",
    params: [
      { name: "jurisdictionCode", type: "Text", desc: "ISO 3166-1 alpha-2 country code" },
    ],
    returns: "Number — 0 (non-compliant) to 100 (fully compliant).",
    example: `=AER.CTC_SCORE("IE")`,
  },
  // Counterparty
  {
    id: "AER.BEHAVIOR_SCORE",
    group: "Counterparty",
    syntax: `=AER.BEHAVIOR_SCORE(lesseeId)`,
    description: "Returns the OCPI behavior score (0–100) for a lessee. Lower scores indicate worse contractual performance history.",
    params: [
      { name: "lesseeId", type: "Text", desc: "Lessee identifier (name or internal ID)" },
    ],
    returns: "Number — 0 to 100.",
    example: `=AER.BEHAVIOR_SCORE("AirAsia")`,
  },
  {
    id: "AER.WATCHLIST_STATUS",
    group: "Counterparty",
    syntax: `=AER.WATCHLIST_STATUS(lesseeId)`,
    description: `Returns the current watchlist status for a lessee.`,
    params: [
      { name: "lesseeId", type: "Text", desc: "Lessee identifier" },
    ],
    returns: `Text — "GREEN", "AMBER", or "RED".`,
    example: `=AER.WATCHLIST_STATUS("AirAsia")`,
  },
  {
    id: "AER.LESSEE_STAGE",
    group: "Counterparty",
    syntax: `=AER.LESSEE_STAGE(lesseeId)`,
    description: "Returns the worst IFRS 9 stage across all active leases for a lessee.",
    params: [
      { name: "lesseeId", type: "Text", desc: "Lessee identifier" },
    ],
    returns: "Number — 1, 2, or 3.",
    example: `=AER.LESSEE_STAGE("AirAsia")`,
  },
  {
    id: "AER.LESSEE_ECL",
    group: "Counterparty",
    syntax: `=AER.LESSEE_ECL(lesseeId, scenario)`,
    description: "Returns the total ECL in $M across all leases for a lessee under a named scenario.",
    params: [
      { name: "lesseeId", type: "Text", desc: "Lessee identifier" },
      { name: "scenario", type: "Text", desc: '"Baseline", "Adverse", or "Upside"' },
    ],
    returns: "Number — aggregate ECL in $M.",
    example: `=AER.LESSEE_ECL("AirAsia","Baseline")`,
  },
  // Portfolio
  {
    id: "AER.MARKET_VALUE",
    group: "Portfolio",
    syntax: `=AER.MARKET_VALUE(msn)`,
    description: "Returns the half-life market value of an aircraft in $M by MSN.",
    params: [
      { name: "msn", type: "Text", desc: "Aircraft manufacturer serial number" },
    ],
    returns: "Number — market value in $M.",
    example: `=AER.MARKET_VALUE("41020")`,
  },
  {
    id: "AER.ENCUMBERED_VALUE",
    group: "Portfolio",
    syntax: `=AER.ENCUMBERED_VALUE(msn)`,
    description: "Returns the lease-encumbered value (LEV) of an aircraft in $M by MSN.",
    params: [
      { name: "msn", type: "Text", desc: "Aircraft manufacturer serial number" },
    ],
    returns: "Number — LEV in $M.",
    example: `=AER.ENCUMBERED_VALUE("41020")`,
  },
  {
    id: "AER.KPI",
    group: "Portfolio",
    syntax: `=AER.KPI(metricName, asOfDate)`,
    description: "Returns a named portfolio-level KPI.",
    params: [
      { name: "metricName", type: "Text", desc: '"portfolio_ecl" | "book_value" | "ecl_rate" | "stage2_pct" | "stage3_pct" | "weighted_pd" | "avg_coverage"' },
      { name: "asOfDate",   type: "Text", desc: "ISO 8601 date" },
    ],
    returns: "Number.",
    example: `=AER.KPI("ecl_rate","2026-04-29")`,
    notes: "portfolio_ecl → $M · book_value → $M · ecl_rate, stage2_pct, stage3_pct, weighted_pd, avg_coverage → decimal",
  },
] as const;

const GROUPS = ["ECL & Risk", "Maintenance & SD", "Jurisdictions", "Counterparty", "Portfolio"] as const;

const GROUP_COLORS: Record<string, { bg: string; text: string }> = {
  "ECL & Risk":       { bg: "#EEF2FF", text: "#4338CA" },
  "Maintenance & SD": { bg: "#ECFDF5", text: "#065F46" },
  "Jurisdictions":    { bg: "#FFF7ED", text: "#9A3412" },
  "Counterparty":     { bg: "#FDF4FF", text: "#7E22CE" },
  "Portfolio":        { bg: "#F0F9FF", text: "#0369A1" },
};

const INSTALL_STEPS = [
  {
    platform: "Mac Desktop",
    steps: [
      "Download manifest.xml from Settings → Excel Add-in.",
      "Open Finder and create a local folder, e.g. ~/AeroinsightsAddin.",
      "Copy manifest.xml into that folder.",
      "In Excel: Insert → Add-ins → My Add-ins → Shared Folder → select "Aeroinsights Decision Platform".",
    ],
  },
  {
    platform: "Windows Desktop",
    steps: [
      "Download manifest.xml from Settings → Excel Add-in.",
      `Create a local shared folder, e.g. C:\\AeroinsightsAddin, and copy manifest.xml into it.`,
      "In Excel: File → Options → Trust Center → Trust Center Settings → Trusted Add-in Catalogs.",
      "Add the folder path as a catalog. Restart Excel.",
      'Insert → My Add-ins → Shared Folder → "Aeroinsights Decision Platform".',
    ],
  },
  {
    platform: "Excel Online",
    steps: [
      "Download manifest.xml from Settings → Excel Add-in.",
      "In Excel Online: Insert → Add-ins → Upload My Add-in.",
      "Browse to the downloaded manifest.xml and click Upload.",
    ],
  },
];

export default function ExcelAddinDocs() {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [openFn, setOpenFn] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = activeGroup
    ? FUNCTIONS.filter(f => f.group === activeGroup)
    : FUNCTIONS;

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const downloadManifest = () => {
    const a = document.createElement("a");
    a.href = "/manifest.xml";
    a.download = "manifest.xml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#002147", color: "#FFFFFF", padding: "3rem 4rem 2.5rem" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
            Excel Add-in · Documentation
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 0.75rem", lineHeight: 1.2 }}>
            AER.* Custom Functions
          </h1>
          <p style={{ fontSize: "0.9375rem", color: "rgba(255,255,255,0.7)", margin: "0 0 2rem", maxWidth: 580, lineHeight: 1.65 }}>
            20 custom Excel functions that pull live Aeroinsights data directly into cells — ECL, maintenance reserves,
            counterparty risk, jurisdiction scores, and portfolio KPIs.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={downloadManifest}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                background: "#FFFFFF", color: "#002147",
                border: "none", borderRadius: "0.5rem",
                padding: "0.625rem 1.25rem", fontSize: "0.8125rem",
                fontWeight: 700, cursor: "pointer",
              }}
            >
              ↓ Download manifest.xml
            </button>
            <a
              href="/settings/excel"
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                background: "rgba(255,255,255,0.12)", color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.2)", borderRadius: "0.5rem",
                padding: "0.625rem 1.25rem", fontSize: "0.8125rem",
                fontWeight: 600, cursor: "pointer", textDecoration: "none",
              }}
            >
              ← Back to Settings
            </a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "2.5rem 4rem" }}>

        {/* Quick start */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 1rem" }}>Quick start</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            {[
              { step: "1", title: "Download & sideload", body: "Download manifest.xml and sideload it into Excel Desktop or Online. See Installation below." },
              { step: "2", title: "Sign in", body: "Open the Aeroinsights task pane in Excel and sign in with your account. Your session is stored locally." },
              { step: "3", title: "Use AER.* functions", body: 'Type any AER.* function in a cell, e.g. =AER.ECL("LSE-2019-001","Baseline","2026-04-29"), and press Enter.' },
            ].map(s => (
              <div key={s.step} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1.25rem" }}>
                <div style={{ width: 28, height: 28, background: "#002147", color: "#FFFFFF", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                  {s.step}
                </div>
                <div style={{ fontWeight: 600, color: "#0F172A", fontSize: "0.875rem", marginBottom: "0.375rem" }}>{s.title}</div>
                <div style={{ fontSize: "0.8125rem", color: "#64748B", lineHeight: 1.6 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Authentication note */}
        <section style={{ marginBottom: "2.5rem" }}>
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "0.75rem", padding: "1.25rem 1.5rem" }}>
            <div style={{ fontWeight: 700, color: "#1D4ED8", fontSize: "0.875rem", marginBottom: "0.375rem" }}>Authentication</div>
            <p style={{ fontSize: "0.8125rem", color: "#1E40AF", lineHeight: 1.65, margin: 0 }}>
              After sideloading the manifest, open the task pane (Insert → Add-ins → Aeroinsights) and sign in.
              Your session token is stored in the add-in's localStorage and automatically included in every{" "}
              <code style={{ fontFamily: "monospace", background: "rgba(29,78,216,0.15)", padding: "0 4px", borderRadius: 3 }}>AER.*</code>{" "}
              function call. Tokens expire after 8 hours — re-open the task pane to refresh.
              <br /><br />
              Functions return <code style={{ fontFamily: "monospace", background: "rgba(29,78,216,0.15)", padding: "0 4px", borderRadius: 3 }}>#VALUE!</code> if
              you are not signed in or your token has expired.
            </p>
          </div>
        </section>

        {/* Function reference */}
        <section style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>Function reference</h2>
            <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
              <button
                onClick={() => setActiveGroup(null)}
                style={{
                  fontSize: "0.75rem", fontWeight: 600, padding: "0.3rem 0.75rem",
                  borderRadius: "9999px", border: "1px solid #E2E8F0",
                  background: activeGroup === null ? "#002147" : "transparent",
                  color: activeGroup === null ? "#FFFFFF" : "#475569",
                  cursor: "pointer",
                }}
              >
                All
              </button>
              {GROUPS.map(g => (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g === activeGroup ? null : g)}
                  style={{
                    fontSize: "0.75rem", fontWeight: 600, padding: "0.3rem 0.75rem",
                    borderRadius: "9999px", border: "1px solid #E2E8F0",
                    background: activeGroup === g ? GROUP_COLORS[g].bg : "transparent",
                    color: activeGroup === g ? GROUP_COLORS[g].text : "#475569",
                    cursor: "pointer",
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {filtered.map(fn => {
              const isOpen = openFn === fn.id;
              const gc = GROUP_COLORS[fn.group];
              return (
                <div key={fn.id} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
                  <button
                    onClick={() => setOpenFn(isOpen ? null : fn.id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "1rem",
                      padding: "1rem 1.25rem", background: "transparent",
                      border: "none", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <code style={{ fontFamily: "monospace", fontWeight: 700, color: "#002147", fontSize: "0.875rem", flexShrink: 0, minWidth: 200 }}>
                      {fn.id}
                    </code>
                    <span style={{ fontSize: "0.8125rem", color: "#475569", flex: 1, textAlign: "left" }}>{fn.description}</span>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: gc.bg, color: gc.text, flexShrink: 0, whiteSpace: "nowrap" }}>
                      {fn.group}
                    </span>
                    <span style={{ color: "#94A3B8", fontSize: "0.75rem", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid #E2E8F0", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                      {/* Syntax */}
                      <div>
                        <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.375rem" }}>Syntax</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <code style={{ fontFamily: "monospace", fontSize: "0.875rem", background: "#F1F5F9", padding: "0.5rem 0.875rem", borderRadius: "0.5rem", color: "#002147", flex: 1 }}>
                            {fn.syntax}
                          </code>
                          <button
                            onClick={() => copy(fn.syntax, fn.id + "-syntax")}
                            style={{ flexShrink: 0, fontSize: "0.75rem", fontWeight: 500, color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", cursor: "pointer" }}
                          >
                            {copied === fn.id + "-syntax" ? "Copied ✓" : "Copy"}
                          </button>
                        </div>
                      </div>

                      {/* Parameters */}
                      <div>
                        <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>Parameters</div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                          <thead>
                            <tr style={{ background: "#F8FAFC" }}>
                              {["Name", "Type", "Description"].map(h => (
                                <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fn.params.map(p => (
                              <tr key={p.name} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                <td style={{ padding: "0.5rem 0.75rem" }}><code style={{ fontFamily: "monospace", color: "#002147", fontSize: "0.8125rem" }}>{p.name}</code></td>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#64748B" }}>{p.type}</td>
                                <td style={{ padding: "0.5rem 0.75rem", color: "#475569" }}>{p.desc}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Returns */}
                      <div>
                        <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.375rem" }}>Returns</div>
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "#475569" }}>{fn.returns}</p>
                      </div>

                      {/* Example */}
                      <div>
                        <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.375rem" }}>Example</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <code style={{ fontFamily: "monospace", fontSize: "0.875rem", background: "#F1F5F9", padding: "0.5rem 0.875rem", borderRadius: "0.5rem", color: "#065F46", flex: 1 }}>
                            {fn.example}
                          </code>
                          <button
                            onClick={() => copy(fn.example, fn.id + "-example")}
                            style={{ flexShrink: 0, fontSize: "0.75rem", fontWeight: 500, color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.375rem 0.75rem", cursor: "pointer" }}
                          >
                            {copied === fn.id + "-example" ? "Copied ✓" : "Copy"}
                          </button>
                        </div>
                      </div>

                      {/* Notes */}
                      {"notes" in fn && fn.notes && (
                        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
                          <span style={{ fontSize: "0.8125rem", color: "#92400E" }}>
                            <strong>Note:</strong> {fn.notes}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Installation */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 1rem" }}>Installation</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {INSTALL_STEPS.map(({ platform, steps }) => (
              <div key={platform} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1.25rem 1.5rem" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "0.9375rem", marginBottom: "0.875rem" }}>{platform}</div>
                <ol style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {steps.map((step, i) => (
                    <li key={i} style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.65 }}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* Troubleshooting */}
        <section style={{ marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 1rem" }}>Troubleshooting</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              {
                q: "Function returns #VALUE!",
                a: "You are not signed in or your session token has expired. Open the Aeroinsights task pane and sign in again.",
              },
              {
                q: "Function returns #NAME?",
                a: "The add-in is not installed or not loaded. Ensure the manifest is sideloaded and the add-in is enabled in the Add-ins manager.",
              },
              {
                q: "Function is slow or returns #BUSY!",
                a: "Each AER.* call makes a live API request. If many cells recalculate simultaneously, some may queue. Try pressing Ctrl+Alt+F9 to force a full recalculation.",
              },
              {
                q: "The task pane shows a blank screen",
                a: "Clear the add-in cache: in Excel, go to File → Options → Trust Center → Trust Center Settings → Trusted Add-in Catalogs and remove the entry, then re-add it. On Mac, delete ~/Library/Containers/com.microsoft.Excel/Data/Library/Application Support/Microsoft/Office/16.0/Wef/.",
              },
              {
                q: "manifest.xml was rejected by Excel",
                a: "Ensure the manifest folder is set up as a Trusted Catalog in Excel's Trust Center. On Windows the folder must be a UNC path or a local path with sharing enabled.",
              },
            ].map(({ q, a }) => (
              <div key={q} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1.25rem 1.5rem" }}>
                <div style={{ fontWeight: 600, color: "#0F172A", fontSize: "0.875rem", marginBottom: "0.375rem" }}>{q}</div>
                <div style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.65 }}>{a}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "#94A3B8" }}>Aeroinsights Decision Platform · Excel Add-in v1.0</span>
          <a href="/settings/excel" style={{ fontSize: "0.8125rem", color: "#002147", textDecoration: "none", fontWeight: 600 }}>← Back to Settings</a>
        </div>
      </div>
    </div>
  );
}
