import { useState } from "react";
import { useNavigate } from "react-router";
import { getWatchlistSummary } from "../components/counterparties/watchlistEngine";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { KpiCard } from "../components/ui/KpiCard";
import { StatusPill } from "../components/ui/StatusPill";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { ArrowRight, Play, Download, RefreshCw, AlertCircle } from "lucide-react";

const eclTrendData = [
  { month: "Oct", ecl: 38.1 },
  { month: "Nov", ecl: 40.5 },
  { month: "Dec", ecl: 42.2 },
  { month: "Jan", ecl: 41.8 },
  { month: "Feb", ecl: 44.7 },
  { month: "Mar", ecl: 47.2 },
];

const stageDistData = [
  { stage: "Stage 1", count: 142, ecl: 8.4 },
  { stage: "Stage 2", count: 23, ecl: 21.6 },
  { stage: "Stage 3", count: 8, ecl: 17.2 },
];


const recentScenarios = [
  {
    id: "RUN-2024-0847",
    name: "Baseline — Q1 2026",
    runDate: "29 Apr 2026, 09:14",
    portfolioECL: "$47.2M",
    keyFinding: "2 stage migrations detected vs prior period",
    status: "complete",
    mode: "Deterministic",
  },
  {
    id: "RUN-2024-0846",
    name: "Fuel Spike (+40%)",
    runDate: "28 Apr 2026, 16:32",
    portfolioECL: "$68.4M",
    keyFinding: "ECL increases 45% under sustained fuel shock",
    status: "complete",
    mode: "Monte Carlo 10k",
  },
  {
    id: "RUN-2024-0845",
    name: "COVID-Severe Replay",
    runDate: "27 Apr 2026, 11:20",
    portfolioECL: "$124.7M",
    keyFinding: "P95 tail risk $189M; 12 Stage 3 migrations",
    status: "complete",
    mode: "Monte Carlo 10k",
  },
  {
    id: "RUN-2024-0844",
    name: "Sovereign Stress — EM",
    runDate: "25 Apr 2026, 14:05",
    portfolioECL: "$89.1M",
    keyFinding: "India, Brazil, Indonesia exposure elevated",
    status: "complete",
    mode: "Deterministic",
  },
  {
    id: "RUN-2024-0843",
    name: "Baseline — Q4 2025",
    runDate: "14 Jan 2026, 09:00",
    portfolioECL: "$44.8M",
    keyFinding: "Portfolio ECL below 1.75% threshold; Stage 2 down 3",
    status: "complete",
    mode: "Deterministic",
  },
];


export default function Dashboard() {
  const navigate = useNavigate();
  const watchlistEntries = getWatchlistSummary();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const unreadCount = watchlistEntries.filter(e => e.status !== "green" && !readIds.has(e.lesseeId)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Portfolio Dashboard"
        subtitle="As of 29 Apr 2026 — Baseline scenario (60/25/15 weights)"
      >
        <button
          onClick={() => navigate("/scenarios")}
          className="flex items-center gap-2"
          style={{
            background: "#002147",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "9999px",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
            /* Specific properties — no transition:all */
            transition:
              "background-color 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#001a35")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#002147")
          }
          onMouseDown={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
          }
          onMouseUp={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
          }
        >
          <Play size={14} />
          Run New Scenario
        </button>
      </PageHeader>

      {/* KPI Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <KpiCard
          label="Portfolio Book Value"
          value="$2.84B"
          delta="+$42M vs prior period"
          deltaType="positive"
          subtitle="173 leases · 48 lessees"
          staggerIndex={0}
        />
        <KpiCard
          label="Expected Credit Loss (ECL)"
          value="$47.2M"
          delta="+$2.4M (5.4%) vs Q4 2025"
          deltaType="negative"
          subtitle="1.66% of book value"
          staggerIndex={1}
        />
        <KpiCard
          label="Watchlist Status"
          value="31"
          subtitle="8 Red · 23 Amber · 142 Green"
          delta="↑2 from last week"
          deltaType="negative"
          staggerIndex={2}
        />
        <KpiCard
          label="Active Scenarios"
          value="12"
          delta="3 run today"
          deltaType="positive"
          subtitle="Last run: 09:14 today"
          staggerIndex={3}
        />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        <Card title="ECL Trend — Last 6 Months" subtitle="Baseline scenario, portfolio-level">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={eclTrendData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="eclGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#002147" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#002147" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid key="ecl-grid" strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                key="ecl-xaxis"
                dataKey="month"
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                key="ecl-yaxis"
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}M`}
              />
              <Tooltip
                key="ecl-tooltip"
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0.75rem",
                  fontSize: "0.8125rem",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
                }}
                formatter={(v: number) => [`$${v}M`, "ECL"]}
              />
              <Area
                key="ecl-area"
                type="monotone"
                dataKey="ecl"
                stroke="#002147"
                strokeWidth={2}
                fill="url(#eclGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Stage Distribution" subtitle="By lease count and ECL">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stageDistData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid key="stage-grid" strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                key="stage-xaxis"
                dataKey="stage"
                tick={{ fontSize: 11, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis key="stage-yaxis" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
              <Tooltip
                key="stage-tooltip"
                contentStyle={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "0.75rem",
                  fontSize: "0.8125rem",
                }}
              />
              <Legend key="stage-legend" wrapperStyle={{ fontSize: "0.75rem" }} />
              <Bar key="bar-count" dataKey="count" name="Leases" fill="#002147" radius={[3, 3, 0, 0]} />
              <Bar key="bar-ecl" dataKey="ecl" name="ECL $M" fill="#475569" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Watchlist Headlines */}
      <Card
        title="Watchlist Headlines"
        subtitle="Lessees requiring immediate attention"
        headerRight={
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {unreadCount > 0 && (
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "#B91C1C", color: "#FFFFFF", borderRadius: "9999px", padding: "0.1rem 0.5rem", minWidth: "18px", textAlign: "center" }}>
                {unreadCount} new
              </span>
            )}
            {unreadCount > 0 && (
              <button
                onClick={() => setReadIds(new Set(watchlistEntries.filter(e => e.status !== "green").map(e => e.lesseeId)))}
                style={{ fontSize: "0.75rem", color: "#94A3B8", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => navigate("/counterparties")}
              className="flex items-center gap-1"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "#002147",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "opacity 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
              }}
              onMouseDown={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
              }
              onMouseUp={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
              }
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
        }
        noPadding
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
              {["Lessee", "Country", "Status", "Trigger", "Details", "Last Changed", ""].map(label => (
                <th
                  key={label || "_action"}
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#0F172A",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {watchlistEntries.map((item, i) => {
              const isUnread = item.status !== "green" && !readIds.has(item.lesseeId);
              const triggerColor = item.status === "red" ? "#B91C1C" : item.status === "amber" ? "#B45309" : "#15803D";
              const triggerBg = item.status === "red" ? "rgba(185,28,28,0.08)" : item.status === "amber" ? "rgba(180,83,9,0.08)" : "rgba(21,128,61,0.08)";
              return (
                <tr
                  key={item.lesseeId}
                  style={{
                    borderBottom: "1px solid #E2E8F0",
                    background: isUnread ? "#FFFBEB" : i % 2 === 0 ? "#FFFFFF" : "#F4F5F7",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")}
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background =
                      isUnread ? "#FFFBEB" : i % 2 === 0 ? "#FFFFFF" : "#F4F5F7")
                  }
                >
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>
                    {item.lesseeName}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{item.country}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <StatusPill
                      stage={item.status}
                      label={item.status === "red" ? "Red" : item.status === "amber" ? "Amber" : "Green"}
                    />
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.75rem",
                        color: triggerColor,
                        background: triggerBg,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "0.5rem",
                      }}
                    >
                      <AlertCircle size={11} />
                      {item.trigger}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      color: "#475569",
                      maxWidth: "280px",
                    }}
                  >
                    {item.reason}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "#94A3B8", whiteSpace: "nowrap" }}>
                    {item.lastChanged}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <button
                      onClick={() => {
                        setReadIds(prev => new Set([...prev, item.lesseeId]));
                        navigate(`/counterparties?lessee=${item.lesseeId}`);
                      }}
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "#002147",
                        background: "transparent",
                        border: "1px solid #E2E8F0",
                        borderRadius: "9999px",
                        padding: "0.375rem 0.75rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition:
                          "border-color 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
                      }}
                      onMouseDown={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
                      }
                      onMouseUp={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Last 5 Scenario Runs */}
      <Card
        title="Recent Scenario Runs"
        subtitle="Last 5 reproducible runs — click to load exact inputs"
        headerRight={
          <button
            onClick={() => navigate("/scenarios")}
            className="flex items-center gap-1"
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#002147",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "opacity 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
            }}
            onMouseDown={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
            }
            onMouseUp={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
            }
          >
            View All Runs <ArrowRight size={14} />
          </button>
        }
        noPadding
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
              {["Run ID", "Scenario", "Mode", "Run Date", "Portfolio ECL", "Key Finding", ""].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "0.75rem 1rem",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#0F172A",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {recentScenarios.map((run, i) => (
              <tr
                key={run.id}
                style={{
                  borderBottom: "1px solid #E2E8F0",
                  background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background =
                    i % 2 === 0 ? "#FFFFFF" : "#F4F5F7")
                }
              >
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    color: "#475569",
                  }}
                >
                  {run.id}
                </td>
                <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>
                  {run.name}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      background: "#F4F5F7",
                      color: "#475569",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "0.25rem",
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    {run.mode}
                  </span>
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{run.runDate}</td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {run.portfolioECL}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{run.keyFinding}</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate("/scenarios")}
                      className="flex items-center gap-1"
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: "#002147",
                        background: "transparent",
                        border: "1px solid #E2E8F0",
                        borderRadius: "9999px",
                        padding: "0.25rem 0.5rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition:
                          "border-color 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
                      }}
                      onMouseDown={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
                      }
                      onMouseUp={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                    >
                      <RefreshCw size={11} /> Re-run
                    </button>
                    <button
                      className="flex items-center gap-1"
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: "#475569",
                        background: "transparent",
                        border: "1px solid #E2E8F0",
                        borderRadius: "9999px",
                        padding: "0.25rem 0.5rem",
                        cursor: "pointer",
                        transition:
                          "border-color 150ms var(--ease-out-strong), transform 150ms var(--ease-out-strong)",
                      }}
                      onMouseDown={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)")
                      }
                      onMouseUp={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
                      }
                    >
                      <Download size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}