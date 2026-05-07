import { useState, useEffect } from "react";
import {
  X,
  Download,
  Briefcase,
  BarChart3,
  Scale,
  Settings2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { generatePDF, generateXLSX } from "../../services/exportService";

// ─── Types ────────────────────────────────────────────────────────────────────

type Preset = "executive" | "risk" | "legal" | "custom";
type Format = "pdf" | "xlsx";

interface StoredConfig {
  preset: Preset;
  customModules: string[];
  format: Format;
}

interface Module {
  id: string;
  label: string;
  group: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "aeroinsights:export_snapshot";

const ALL_MODULES: Module[] = [
  { id: "ecl_summary",         label: "ECL Summary",            group: "Risk" },
  { id: "stage_dist",          label: "Stage Distribution",     group: "Risk" },
  { id: "ecl_trend",           label: "ECL Trend (6 months)",   group: "Risk" },
  { id: "stage_migration",     label: "Stage Migration Table",  group: "Risk" },
  { id: "book_value",          label: "Portfolio Book Value",   group: "Portfolio" },
  { id: "aircraft_mix",        label: "Aircraft Mix",           group: "Portfolio" },
  { id: "watchlist_headlines", label: "Watchlist Headlines",    group: "Intelligence" },
  { id: "watchlist_full",      label: "Watchlist Full Detail",  group: "Intelligence" },
  { id: "jurisdiction",        label: "Jurisdiction Exposure",  group: "Legal" },
  { id: "insolvency",          label: "Insolvency Risk Flags",  group: "Legal" },
  { id: "scenario_comparison", label: "Scenario Comparison",    group: "Scenarios" },
];

const PRESET_MODULE_IDS: Record<Exclude<Preset, "custom">, string[]> = {
  executive: ["ecl_summary", "book_value", "watchlist_headlines"],
  risk:      ["ecl_summary", "stage_dist", "ecl_trend", "stage_migration", "watchlist_full"],
  legal:     ["jurisdiction", "insolvency", "watchlist_headlines", "watchlist_full"],
};

const PRESETS: {
  id: Preset;
  Icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  role: string;
  tags: string[];
}[] = [
  {
    id: "executive",
    Icon: Briefcase,
    label: "Executive",
    role: "VP / CEO",
    tags: ["ECL Summary", "Book Value", "Watchlist Headlines"],
  },
  {
    id: "risk",
    Icon: BarChart3,
    label: "Risk Analyst",
    role: "Risk & Finance",
    tags: ["Stage Distribution", "ECL Trends", "Migration Table", "Watchlist Full"],
  },
  {
    id: "legal",
    Icon: Scale,
    label: "Legal / Contracts",
    role: "Legal Manager",
    tags: ["Jurisdiction Links", "Insolvency Flags", "Watchlist Triggers"],
  },
  {
    id: "custom",
    Icon: Settings2,
    label: "Custom",
    role: "Choose modules",
    tags: [],
  },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadConfig(): StoredConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredConfig;
  } catch {
    // Silently fall through to default
  }
  return { preset: "executive", customModules: [], format: "pdf" };
}

function saveConfig(cfg: StoredConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // localStorage unavailable — ignore
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export function ExportSnapshotModal({ onClose }: Props) {
  const initial = loadConfig();

  const [preset, setPreset] = useState<Preset>(initial.preset);
  const [customModules, setCustomModules] = useState<Set<string>>(
    new Set(initial.customModules)
  );
  const [format, setFormat] = useState<Format>(initial.format ?? "pdf");
  const [generating, setGenerating] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Persist on every config change
  useEffect(() => {
    saveConfig({ preset, customModules: [...customModules], format });
  }, [preset, customModules, format]);

  function toggleModule(id: string) {
    setCustomModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function getExportModuleIds(): string[] {
    if (preset === "custom") return [...customModules];
    return PRESET_MODULE_IDS[preset];
  }

  function getPresetLabel(): string {
    if (preset === "custom") return "Custom";
    return { executive: "Executive", risk: "Risk Analyst", legal: "Legal" }[preset];
  }

  async function handleDownload() {
    const modules = getExportModuleIds();
    if (modules.length === 0) return;

    setGenerating(true);
    setDownloaded(false);

    // Yield to the browser so the spinner renders before heavy work starts
    await new Promise<void>(res => setTimeout(res, 30));

    try {
      if (format === "pdf") {
        generatePDF(modules, getPresetLabel());
      } else {
        generateXLSX(modules, getPresetLabel());
      }
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } finally {
      setGenerating(false);
    }
  }

  const moduleCount = getExportModuleIds().length;
  const groups = [...new Set(ALL_MODULES.map((m) => m.group))];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "1rem",
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow:
            "0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "1.75rem 1.75rem 1.25rem",
            borderBottom: "1px solid #F1F5F9",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                marginBottom: "0.25rem",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  background: "#EFF6FF",
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Download size={15} style={{ color: "#002147" }} />
              </div>
              <h2
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#0F172A",
                  margin: 0,
                }}
              >
                Export Snapshot
              </h2>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: 0 }}>
              Choose a preset report or build a custom export package.
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              padding: "0.25rem",
              borderRadius: "0.375rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background 120ms, color 120ms",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9";
              (e.currentTarget as HTMLButtonElement).style.color = "#475569";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "none";
              (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div
          style={{
            padding: "1.5rem 1.75rem",
            flex: 1,
            overflowY: "auto",
          }}
        >
          {/* Section label */}
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "#94A3B8",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "0.75rem",
            }}
          >
            Report Preset
          </div>

          {/* 2×2 preset card grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              marginBottom: preset === "custom" ? "1.25rem" : 0,
            }}
          >
            {PRESETS.map((p) => {
              const active = preset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "0.625rem",
                    padding: "1rem",
                    background: active ? "#EFF6FF" : "#F8FAFC",
                    border: `1.5px solid ${active ? "#002147" : "#E2E8F0"}`,
                    borderRadius: "0.75rem",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 130ms, background 130ms",
                    width: "100%",
                  }}
                >
                  {/* Icon row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        background: active ? "rgba(0,33,71,0.10)" : "#FFFFFF",
                        borderRadius: "0.5rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1px solid ${active ? "transparent" : "#E2E8F0"}`,
                        transition: "background 130ms",
                      }}
                    >
                      <p.Icon
                        size={15}
                        style={{ color: active ? "#002147" : "#64748B" }}
                      />
                    </div>
                    {active && (
                      <CheckCircle2 size={14} style={{ color: "#002147" }} />
                    )}
                  </div>

                  {/* Title */}
                  <div>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#0F172A",
                        marginBottom: "0.125rem",
                      }}
                    >
                      {p.label}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                      {p.role}
                    </div>
                  </div>

                  {/* Module tags */}
                  {p.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                      {p.tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 500,
                            color: active ? "#002147" : "#64748B",
                            background: active
                              ? "rgba(0,33,71,0.07)"
                              : "#FFFFFF",
                            border: `1px solid ${active ? "rgba(0,33,71,0.15)" : "#E2E8F0"}`,
                            borderRadius: "0.375rem",
                            padding: "0.15rem 0.4rem",
                            transition: "background 130ms, color 130ms",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Custom hint */}
                  {p.id === "custom" && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: active ? "#002147" : "#94A3B8",
                        fontStyle: "italic",
                      }}
                    >
                      {active
                        ? `${customModules.size} module${customModules.size !== 1 ? "s" : ""} selected`
                        : "Expand to select"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Custom module picker ── */}
          {preset === "custom" && (
            <div
              style={{
                border: "1px solid #E2E8F0",
                borderRadius: "0.75rem",
                overflow: "hidden",
              }}
            >
              {/* Picker header */}
              <div
                style={{
                  padding: "0.625rem 1rem",
                  background: "#F8FAFC",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  Select Modules
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    onClick={() =>
                      setCustomModules(new Set(ALL_MODULES.map((m) => m.id)))
                    }
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 500,
                      color: "#002147",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Select all
                  </button>
                  <span style={{ color: "#CBD5E1", fontSize: "0.75rem" }}>·</span>
                  <button
                    onClick={() => setCustomModules(new Set())}
                    style={{
                      fontSize: "0.6875rem",
                      color: "#94A3B8",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Module groups */}
              <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {groups.map((group) => (
                  <div key={group}>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        color: "#94A3B8",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {group}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.375rem",
                      }}
                    >
                      {ALL_MODULES.filter((m) => m.group === group).map((m) => {
                        const checked = customModules.has(m.id);
                        return (
                          <label
                            key={m.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.5rem 0.625rem",
                              borderRadius: "0.5rem",
                              border: `1px solid ${checked ? "#002147" : "#E2E8F0"}`,
                              background: checked ? "#EFF6FF" : "#FFFFFF",
                              cursor: "pointer",
                              transition: "border-color 120ms, background 120ms",
                              userSelect: "none",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleModule(m.id)}
                              style={{
                                accentColor: "#002147",
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: "0.8125rem",
                                color: checked ? "#002147" : "#475569",
                                fontWeight: checked ? 500 : 400,
                              }}
                            >
                              {m.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: "1.25rem 1.75rem",
            borderTop: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexShrink: 0,
          }}
        >
          {/* Format toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                color: "#94A3B8",
                fontWeight: 500,
              }}
            >
              Format:
            </span>
            <div
              style={{
                display: "flex",
                background: "#F1F5F9",
                borderRadius: "0.5rem",
                padding: "2px",
              }}
            >
              {(["pdf", "xlsx"] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  style={{
                    padding: "0.3rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "none",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: format === f ? "#FFFFFF" : "transparent",
                    color: format === f ? "#0F172A" : "#64748B",
                    boxShadow:
                      format === f ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
                    transition:
                      "background 120ms, color 120ms, box-shadow 120ms",
                  }}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Right: status + download button */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {downloaded ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  fontSize: "0.8125rem",
                  color: "#15803D",
                  fontWeight: 500,
                }}
              >
                <CheckCircle2 size={14} style={{ color: "#15803D" }} />
                Downloaded
              </div>
            ) : generating ? (
              <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                Building…
              </span>
            ) : moduleCount > 0 ? (
              <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                {moduleCount} section{moduleCount !== 1 ? "s" : ""}
              </span>
            ) : null}

            <button
              onClick={handleDownload}
              disabled={moduleCount === 0 || generating}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1.25rem",
                background: moduleCount === 0 || generating ? "#F1F5F9" : "#002147",
                color: moduleCount === 0 || generating ? "#CBD5E1" : "#FFFFFF",
                border: "none",
                borderRadius: "9999px",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: moduleCount === 0 || generating ? "not-allowed" : "pointer",
                transition:
                  "background 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
              }}
              onMouseEnter={(e) => {
                if (moduleCount > 0 && !generating)
                  (e.currentTarget as HTMLButtonElement).style.background = "#001a35";
              }}
              onMouseLeave={(e) => {
                if (moduleCount > 0 && !generating)
                  (e.currentTarget as HTMLButtonElement).style.background = "#002147";
              }}
              onMouseDown={(e) => {
                if (moduleCount > 0 && !generating)
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)";
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              {generating
                ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                : <Download size={14} />
              }
              {generating ? "Building…" : `Download ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
