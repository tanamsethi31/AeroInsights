// src/app/components/portfolio/KeyDatesTab.tsx
import { useState } from "react";
import { AlertTriangle, Clock, Calendar, CheckCircle2 } from "lucide-react";
import { Card } from "../ui/Card";
import type { KeyDateRow, KeyDateKPIs, Urgency } from "../../lib/keyDatesAdapters";

interface Props {
  rows: KeyDateRow[];
  kpis: KeyDateKPIs;
}

type Filter = "All" | "expired" | "critical" | "watch" | "upcoming";

const URGENCY_COLOR: Record<Urgency, string> = {
  expired:  "#B91C1C",
  critical: "#DC2626",
  watch:    "#B45309",
  upcoming: "#0369A1",
  long:     "#15803D",
};

const URGENCY_BG: Record<Urgency, string> = {
  expired:  "#FEF2F2",
  critical: "#FEF2F2",
  watch:    "#FFFBEB",
  upcoming: "#EFF6FF",
  long:     "#F0FDF4",
};

const URGENCY_LABEL: Record<Urgency, string> = {
  expired:  "Expired",
  critical: "Critical",
  watch:    "Watch",
  upcoming: "Upcoming",
  long:     "Long",
};

function UrgencyPill({ urgency }: { urgency: Urgency }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "9999px",
      background: URGENCY_BG[urgency],
      color: URGENCY_COLOR[urgency],
      fontWeight: 600,
      fontSize: "0.6875rem",
      letterSpacing: "0.02em",
    }}>
      {URGENCY_LABEL[urgency]}
    </span>
  );
}

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function formatDays(days: number): string {
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `${days}d`;
}

export function KeyDatesTab({ rows, kpis }: Props) {
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = filter === "All" ? rows : rows.filter(r => r.urgency === filter);

  const KPI_ITEMS: Array<{ label: string; count: number; icon: typeof AlertTriangle; color: string }> = [
    { label: "Expired",        count: kpis.expired,  icon: AlertTriangle, color: "#B91C1C" },
    { label: "Critical <90d",  count: kpis.critical, icon: AlertTriangle, color: "#DC2626" },
    { label: "Watch 90–180d",  count: kpis.watch,    icon: Clock,         color: "#B45309" },
    { label: "Upcoming <1yr",  count: kpis.upcoming, icon: Calendar,      color: "#0369A1" },
    { label: ">1 Year",        count: kpis.long,     icon: CheckCircle2,  color: "#15803D" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0.75rem" }}>
        {KPI_ITEMS.map(({ label, count, icon: Icon, color }) => (
          <Card key={label} noPadding>
            <div style={{ padding: "0.875rem 1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <Icon size={14} style={{ color }} />
                <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>{label}</span>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
                {count}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "0.8125rem", color: "#64748B", fontWeight: 500, marginRight: 4 }}>Filter:</span>
        {(["All", "critical", "watch", "upcoming", "expired"] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "4px 12px",
              borderRadius: "9999px",
              border: "1.5px solid",
              borderColor: filter === f ? "#002147" : "#E2E8F0",
              background: filter === f ? "#002147" : "#FFFFFF",
              color: filter === f ? "#FFFFFF" : "#475569",
              fontWeight: 600,
              fontSize: "0.75rem",
              cursor: "pointer",
              transition: "all 150ms ease-out",
            }}
          >
            {f === "All" ? "All" : URGENCY_LABEL[f as Urgency]}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: "0.8125rem", color: "#94A3B8" }}>
          {filtered.length} lease{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <Card noPadding>
        <div style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["Lessee", "Aircraft", "MSN", "Stage", "Expiry Date", "Days Remaining", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: "0.75rem", color: "#64748B", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
                    No leases in this category
                  </td>
                </tr>
              ) : filtered.map((row, i) => (
                <tr key={row.leaseId} style={{
                  borderBottom: "1px solid #F1F5F9",
                  background: i % 2 === 0 ? "#FFFFFF" : "#FAFBFC",
                }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0F172A" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: URGENCY_COLOR[row.urgency], flexShrink: 0 }} />
                      {row.lessee}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#475569" }}>{row.aircraft}</td>
                  <td style={{ padding: "12px 16px", color: "#475569", fontVariantNumeric: "tabular-nums", fontFamily: "monospace", fontSize: "0.8125rem" }}>{row.msn}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4,
                      background: row.stage === "3" ? "#FEF2F2" : row.stage === "2" ? "#FFFBEB" : "#F0FDF4",
                      color: row.stage === "3" ? "#B91C1C" : row.stage === "2" ? "#B45309" : "#15803D",
                      fontWeight: 600, fontSize: "0.75rem",
                    }}>
                      Stage {row.stage}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                    {formatExpiry(row.expiryDate)}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: URGENCY_COLOR[row.urgency], fontVariantNumeric: "tabular-nums" }}>
                    {formatDays(row.daysRemaining)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <UrgencyPill urgency={row.urgency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
