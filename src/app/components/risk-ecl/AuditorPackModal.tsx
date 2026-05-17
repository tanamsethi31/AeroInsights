// src/app/components/risk-ecl/AuditorPackModal.tsx
// Full-screen IFRS 9 Auditor Evidence Pack preview.
// 8-section formatted report, scrollable, with PDF + DOCX download.

import { useRef, useState, useEffect, type RefObject } from "react";
import { X, Download, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  generateReportDOCX,
  generateReportPDF,
  type AuditorPackData,
} from "../../services/reportGenerators";

// ─── Section navigator config ─────────────────────────────────────────────────

const SECTIONS = [
  { id: "s1", label: "§1  Methodology"        },
  { id: "s2", label: "§2  Scenario Defs"      },
  { id: "s3", label: "§3  Weighted ECL"        },
  { id: "s4", label: "§4  ECL by Lease"        },
  { id: "s5", label: "§5  Roll-Forward"        },
  { id: "s6", label: "§6  Credit Quality"      },
  { id: "s7", label: "§7  SICR Config"         },
  { id: "s8", label: "§8  Assumptions"         },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AuditorPackModalProps {
  open: boolean;
  onClose: () => void;
  data: AuditorPackData;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtM   = (n: number) => `$${n.toFixed(1)}M`;
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 style={{
      fontSize: "0.9375rem", fontWeight: 700, color: "#002147",
      marginBottom: "0.875rem", paddingBottom: "0.5rem",
      borderBottom: "2px solid #002147",
      marginTop: 0,
    }}>
      {title}
    </h2>
  );
}

function PreviewTable({
  headers, rows,
}: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: "2rem" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ background: "#002147" }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "0.5rem 0.75rem", textAlign: i === 0 ? "left" : "right", color: "#FFFFFF", fontWeight: 600, fontSize: "0.75rem", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "0.5rem 0.75rem", textAlign: ci === 0 ? "left" : "right", color: "#475569", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AuditorPackModal({ open, onClose, data }: AuditorPackModalProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("s1");
  const [managementOverlay, setManagementOverlay] = useState(
    "Management has considered the following overlays in addition to model outputs:\n\n[Document any qualitative adjustments, post-model overlays, or management judgements applied to the ECL estimate for this period.]"
  );
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Scroll to section
  function scrollTo(id: string) {
    document.getElementById(`auditor-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  // Download handlers
  async function handleDOCX() {
    setDownloading("docx");
    try {
      await generateReportDOCX("RPT-001", data.currency, undefined, { ...data, managementOverlay });
    } finally {
      setDownloading(null);
    }
  }

  async function handlePDF() {
    setDownloading("pdf");
    try {
      await generateReportPDF(previewRef as RefObject<HTMLDivElement>);
    } finally {
      setDownloading(null);
    }
  }

  const sc = data.sicrConfig;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 1000 }}
          />

          {/* Modal panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: "fixed",
              top: "50%", left: "50%",
              marginLeft: "-45vw",
              marginTop: "-45vh",
              width: "90vw", maxWidth: "1200px",
              height: "90vh",
              background: "#FFFFFF",
              borderRadius: "1rem",
              boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
              zIndex: 1001,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header bar */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1rem 1.5rem",
              background: "#002147",
              borderRadius: "1rem 1rem 0 0",
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
                  IFRS 9 Auditor Evidence Pack
                </div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "0.125rem" }}>
                  Q1 2026 · Generated {new Date().toLocaleDateString("en-IE", { dateStyle: "long" })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button
                  onClick={handlePDF}
                  disabled={!!downloading}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    background: "rgba(255,255,255,0.12)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255,255,255,0.25)",
                    borderRadius: "9999px", padding: "0.5rem 1rem",
                    fontSize: "0.8125rem", fontWeight: 500,
                    cursor: downloading ? "not-allowed" : "pointer",
                    opacity: downloading === "pdf" ? 0.7 : 1,
                    transition: "opacity 150ms ease",
                  }}
                >
                  <Download size={13} />
                  {downloading === "pdf" ? "Generating…" : "Download PDF"}
                </button>
                <button
                  onClick={handleDOCX}
                  disabled={!!downloading}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    background: "#FFFFFF", color: "#002147",
                    border: "none",
                    borderRadius: "9999px", padding: "0.5rem 1rem",
                    fontSize: "0.8125rem", fontWeight: 600,
                    cursor: downloading ? "not-allowed" : "pointer",
                    opacity: downloading === "docx" ? 0.7 : 1,
                    transition: "opacity 150ms ease",
                  }}
                >
                  <FileText size={13} />
                  {downloading === "docx" ? "Generating…" : "Download DOCX"}
                </button>
                <button
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(255,255,255,0.1)", border: "none",
                    borderRadius: "50%", cursor: "pointer", color: "#FFFFFF",
                    transition: "background 150ms ease",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              {/* Left navigator */}
              <div style={{ width: "210px", flexShrink: 0, borderRight: "1px solid #E2E8F0", padding: "1rem 0", overflowY: "auto", background: "#F8FAFC" }}>
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "0.625rem 1.25rem",
                      background: activeSection === s.id ? "rgba(0,33,71,0.07)" : "transparent",
                      borderLeft: `3px solid ${activeSection === s.id ? "#002147" : "transparent"}`,
                      border: "none", borderTop: "none", borderBottom: "none", borderRight: "none",
                      cursor: "pointer",
                      fontSize: "0.8125rem",
                      fontWeight: activeSection === s.id ? 600 : 400,
                      color: activeSection === s.id ? "#002147" : "#475569",
                      transition: "all 140ms ease",
                      fontFamily: "inherit",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Scrollable report content — captured by previewRef for PDF */}
              <div
                ref={previewRef}
                style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem", background: "#FFFFFF" }}
                onScroll={(e) => {
                  const container = e.currentTarget;
                  for (const s of [...SECTIONS].reverse()) {
                    const el = document.getElementById(`auditor-${s.id}`);
                    if (el) {
                      const containerRect = container.getBoundingClientRect();
                      const elRect = el.getBoundingClientRect();
                      if (elRect.top - containerRect.top <= 120) {
                        setActiveSection(s.id);
                        break;
                      }
                    }
                  }
                }}
              >
                {/* §1 Methodology */}
                <section id="auditor-s1" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§1 — Methodology Statement" />
                  <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.75, margin: 0 }}>
                    Expected Credit Loss (ECL) is measured under IFRS 9 <em>Financial Instruments</em> using the
                    three-stage impairment model. Stage 1 instruments carry a 12-month ECL allowance; Stage 2 and
                    Stage 3 instruments carry a lifetime ECL allowance. Probability of Default (PD), Loss Given
                    Default (LGD), and Exposure at Default (EAD) inputs are derived from lessee credit assessments,
                    aircraft market valuations, and contractual cash flow schedules. Forward-looking information is
                    incorporated through a minimum of three macro-economic scenarios (Baseline, Adverse, Upside)
                    probability-weighted per IFRS 9 §B5.5.41. Significant Increase in Credit Risk (SICR) is
                    assessed at each reporting date against the trigger framework documented in §7 of this pack.
                  </p>
                </section>

                {/* §2 Scenario Definitions */}
                <section id="auditor-s2" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§2 — Forward-Looking Scenario Definitions" />
                  <PreviewTable
                    headers={["Scenario", "GDP Δ", "RPK Δ", "Fuel Δ", "Asset Value Δ", "PD Mult S2", "PD Mult S3"]}
                    rows={[
                      [`Baseline (${(data.weights.base * 100).toFixed(0)}%)`,
                        `${(data.scenarioInputs.base.gdpDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.base.rpkDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.base.fuelDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.base.assetValueDelta * 100).toFixed(1)}%`,
                        `${data.scenarioInputs.base.pdS2Multi.toFixed(1)}×`,
                        `${data.scenarioInputs.base.pdS3Multi.toFixed(1)}×`,
                      ],
                      [`Adverse (${(data.weights.adverse * 100).toFixed(0)}%)`,
                        `${(data.scenarioInputs.adverse.gdpDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.adverse.rpkDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.adverse.fuelDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.adverse.assetValueDelta * 100).toFixed(1)}%`,
                        `${data.scenarioInputs.adverse.pdS2Multi.toFixed(1)}×`,
                        `${data.scenarioInputs.adverse.pdS3Multi.toFixed(1)}×`,
                      ],
                      [`Upside (${(data.weights.upside * 100).toFixed(0)}%)`,
                        `${(data.scenarioInputs.upside.gdpDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.upside.rpkDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.upside.fuelDelta * 100).toFixed(1)}%`,
                        `${(data.scenarioInputs.upside.assetValueDelta * 100).toFixed(1)}%`,
                        `${data.scenarioInputs.upside.pdS2Multi.toFixed(1)}×`,
                        `${data.scenarioInputs.upside.pdS3Multi.toFixed(1)}×`,
                      ],
                    ]}
                  />
                </section>

                {/* §3 Weighted ECL */}
                <section id="auditor-s3" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§3 — Probability Weights & Weighted ECL" />
                  <PreviewTable
                    headers={["Scenario", "ECL 12-Month", "ECL Lifetime", "Coverage Ratio"]}
                    rows={[
                      [`Baseline (${(data.weights.base * 100).toFixed(0)}%)`,  fmtM(data.scenarioSummary.base.ecl12m),    fmtM(data.scenarioSummary.base.eclLifetime),    fmtPct(data.scenarioSummary.base.coverage)],
                      [`Adverse (${(data.weights.adverse * 100).toFixed(0)}%)`, fmtM(data.scenarioSummary.adverse.ecl12m), fmtM(data.scenarioSummary.adverse.eclLifetime), fmtPct(data.scenarioSummary.adverse.coverage)],
                      [`Upside (${(data.weights.upside * 100).toFixed(0)}%)`,   fmtM(data.scenarioSummary.upside.ecl12m),  fmtM(data.scenarioSummary.upside.eclLifetime),  fmtPct(data.scenarioSummary.upside.coverage)],
                      ["Probability-Weighted",                                  fmtM(data.weighted.ecl12m),               fmtM(data.weighted.eclLifetime),               fmtPct(data.weighted.coverage)],
                    ]}
                  />
                </section>

                {/* §4 ECL by Lease */}
                <section id="auditor-s4" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§4 — ECL by Lease (Full Schedule)" />
                  <PreviewTable
                    headers={["Lease ID", "Lessee", "Aircraft", "EAD", "PD 12m", "LGD", "ECL 12m", "ECL Lifetime", "Stage"]}
                    rows={data.eclRows.map((r) => [
                      <span key="id" style={{ fontFamily: "monospace", fontSize: "0.6875rem", color: "#94A3B8" }}>{r.id}</span>,
                      <span key="lessee" style={{ fontWeight: 600, color: "#0F172A" }}>{r.lessee}</span>,
                      r.aircraft,
                      `$${r.ead.toFixed(1)}M`,
                      `${r.pd12m}%`,
                      `${r.lgd}%`,
                      `$${r.ecl12m.toFixed(2)}M`,
                      <span key="ecl" style={{ fontWeight: 600, color: r.stage === "3" ? "#B91C1C" : r.stage === "2" ? "#B45309" : "#0F172A" }}>${r.eclLT.toFixed(2)}M</span>,
                      <span key="stage" style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "4px", background: r.stage === "3" ? "rgba(185,28,28,0.1)" : r.stage === "2" ? "rgba(180,83,9,0.1)" : "rgba(21,128,61,0.1)", color: r.stage === "3" ? "#B91C1C" : r.stage === "2" ? "#B45309" : "#15803D" }}>S{r.stage}</span>,
                    ])}
                  />
                </section>

                {/* §5 Roll-Forward */}
                <section id="auditor-s5" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§5 — IFRS 7 §35H ECL Allowance Roll-Forward" />
                  <PreviewTable
                    headers={["Movement", "Stage 1", "Stage 2", "Stage 3", "Total"]}
                    rows={[
                      ["Opening ECL balance",          "$8.10M",  "$20.40M", "$16.30M", "$44.80M"],
                      ["New originations (Stage 1)",   "+$1.20M", "—",       "—",       "+$1.20M"],
                      ["SICR transfers to Stage 2",    "−$0.85M", "+$2.10M", "—",       "+$1.25M"],
                      ["SICR transfers to Stage 3",    "—",       "−$1.40M", "+$2.80M", "+$1.40M"],
                      ["Write-offs",                   "—",       "—",       "−$2.10M", "−$2.10M"],
                      ["Repayments / derecognition",   "−$0.45M", "−$0.85M", "−$0.40M", "−$1.70M"],
                      ["FX and unwinding of discount", "+$0.40M", "+$1.35M", "+$0.60M", "+$2.35M"],
                      ["Closing ECL balance",          "$8.40M",  "$21.60M", "$17.20M", "$47.20M"],
                    ]}
                  />
                </section>

                {/* §6 Credit Quality */}
                <section id="auditor-s6" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§6 — IFRS 7 §35I Credit Quality Distribution" />
                  <PreviewTable
                    headers={["Rating Grade", "Stage 1 EAD", "Stage 2 EAD", "Stage 3 EAD", "Total EAD", "% Portfolio"]}
                    rows={[
                      ["A / A−",        "$412.0M", "—",      "—",      "$412.0M", "45.1%"],
                      ["BBB",           "$185.0M", "$12.0M", "—",      "$197.0M", "21.6%"],
                      ["BB / BB−",      "$142.0M", "$48.0M", "—",      "$190.0M", "20.8%"],
                      ["B+",            "$32.0M",  "$58.0M", "—",      "$90.0M",  "9.9%"],
                      ["B / B−",        "—",       "—",      "$6.6M",  "$6.6M",   "0.7%"],
                      ["CCC and below", "—",       "—",      "$17.6M", "$17.6M",  "1.9%"],
                    ]}
                  />
                </section>

                {/* §7 SICR Config */}
                <section id="auditor-s7" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§7 — SICR Trigger Configuration" />
                  <PreviewTable
                    headers={["Trigger", "Status", "Threshold"]}
                    rows={[
                      ["30+ DPD Backstop",
                        <span key="dpd" style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: sc.dpdEnabled ? "rgba(21,128,61,0.1)" : "rgba(148,163,184,0.15)", color: sc.dpdEnabled ? "#15803D" : "#94A3B8" }}>{sc.dpdEnabled ? "ACTIVE" : "DISABLED"}</span>,
                        sc.dpdEnabled ? `${sc.dpdDays} days` : "—",
                      ],
                      ["Credit Downgrade Threshold",
                        <span key="dg" style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: sc.upgradeEnabled ? "rgba(21,128,61,0.1)" : "rgba(148,163,184,0.15)", color: sc.upgradeEnabled ? "#15803D" : "#94A3B8" }}>{sc.upgradeEnabled ? "ACTIVE" : "DISABLED"}</span>,
                        sc.upgradeEnabled ? `${sc.upgradeNotches} notches` : "—",
                      ],
                      ["Country Watchlist Event",
                        <span key="cw" style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: sc.countryWatchlistEnabled ? "rgba(21,128,61,0.1)" : "rgba(148,163,184,0.15)", color: sc.countryWatchlistEnabled ? "#15803D" : "#94A3B8" }}>{sc.countryWatchlistEnabled ? "ACTIVE" : "DISABLED"}</span>,
                        "Automatic on watchlist flag",
                      ],
                      ["Lessee Insolvency Filing",
                        <span key="ins" style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", background: sc.insolvencyEnabled ? "rgba(21,128,61,0.1)" : "rgba(148,163,184,0.15)", color: sc.insolvencyEnabled ? "#15803D" : "#94A3B8" }}>{sc.insolvencyEnabled ? "ACTIVE" : "DISABLED"}</span>,
                        "Automatic Stage 3",
                      ],
                    ]}
                  />
                </section>

                {/* §8 Key Assumptions */}
                <section id="auditor-s8" style={{ marginBottom: "2.5rem" }}>
                  <SectionHeading title="§8 — Key Assumptions & Management Overlays" />
                  <p style={{ fontSize: "0.75rem", color: "#94A3B8", marginBottom: "0.625rem", marginTop: 0 }}>
                    Edit this field before downloading to document any qualitative overlays for this period.
                  </p>
                  <textarea
                    value={managementOverlay}
                    onChange={(e) => setManagementOverlay(e.target.value)}
                    rows={8}
                    style={{
                      width: "100%",
                      padding: "0.875rem",
                      border: "1px solid #E2E8F0",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#475569",
                      lineHeight: 1.7,
                      resize: "vertical",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      outline: "none",
                      transition: "border-color 150ms ease",
                    }}
                    onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "#002147"; }}
                    onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "#E2E8F0"; }}
                  />
                </section>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
