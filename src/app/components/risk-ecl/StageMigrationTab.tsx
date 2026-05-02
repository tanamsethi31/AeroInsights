import { ArrowRight } from "lucide-react";
import { Card } from "../ui/Card";

// ─── Types ────────────────────────────────────────────────────────────────────

type RollForwardRow = {
  label: string;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  total: number | null;
  isBold?: boolean;
  isBlue?: boolean;
};

type CreditGradeRow = {
  grade: string;
  riskZone: "low" | "watch" | "danger";
  s1Ead: number;
  s2Ead: number;
  s3Ead: number;
  totalEad: number;
  portfolioPct: number;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const migrationMatrix = [
  { from: "Stage 1", toS1: 132, toS2: 6, toS3: 1, newDefaults: 0 },
  { from: "Stage 2", toS1: 3, toS2: 17, toS3: 2, newDefaults: 1 },
  { from: "Stage 3", toS1: 0, toS2: 1, toS3: 6, newDefaults: 2 },
];

const migrationEvents = [
  {
    id: "LSE-2019-001",
    lessee: "IndiGo Airlines",
    aircraft: "A320neo",
    from: "2" as const,
    to: "3" as const,
    date: "2026-01-15",
    trigger: "30+ DPD backstop",
    ecl_delta: "+$0.74M",
    detail:
      "47 days past due on Jan 2026 rental payment. India sovereign watchlist event also active (AWG CTC score −4 pts). Double-trigger classification.",
  },
  {
    id: "LSE-2020-014",
    lessee: "Aeromexico",
    aircraft: "B737-800",
    from: "2" as const,
    to: "3" as const,
    date: "2026-01-08",
    trigger: "Lessee insolvency filing",
    ecl_delta: "+$1.91M",
    detail:
      "Formal insolvency petition filed Jan 8 2026. Moody's concurrent downgrade B2 → Caa1 (3 notches, ≥2 threshold met). Chapter 11 refiling risk elevated.",
  },
  {
    id: "LSE-2020-031",
    lessee: "SriLankan Airlines",
    aircraft: "A330-300",
    from: "1" as const,
    to: "2" as const,
    date: "2026-01-22",
    trigger: "Country watchlist event",
    ecl_delta: "+$0.35M",
    detail:
      "Sri Lanka added to sovereign watchlist: IMF Extended Fund Facility compliance review flagged. 12-notch deterioration in local banking sector index Q4 2025.",
  },
  {
    id: "LSE-2021-055",
    lessee: "Azul Brazilian Airlines",
    aircraft: "A320neo",
    from: "1" as const,
    to: "2" as const,
    date: "2026-01-28",
    trigger: "30+ DPD backstop",
    ecl_delta: "+$0.22M",
    detail:
      "35 days past due on Jan 2026 instalment. BRL/USD depreciation +14% YoY compresses liquidity margin. No downgrade yet but PD threshold crossed.",
  },
  {
    id: "LSE-2019-063",
    lessee: "Air Transat",
    aircraft: "A321neo",
    from: "1" as const,
    to: "2" as const,
    date: "2026-01-19",
    trigger: "30+ DPD backstop",
    ecl_delta: "+$0.18M",
    detail:
      "31 days past due on Dec 2025 payment. Lessee in active payment holiday negotiation — IFRS 9 §B5.5.17 financial difficulty indicator met; formal SICR applied.",
  },
];

const migrationCures = [
  {
    id: "LSE-2018-005",
    lessee: "Air Baltic",
    aircraft: "A220-300",
    from: "2" as const,
    to: "1" as const,
    date: "2026-01-12",
    trigger: "12m consecutive timely payments",
    ecl_delta: "−$0.28M",
    detail:
      "12 consecutive months of on-time payments post-restructuring. PD below SICR threshold. Stage 2 lifetime ECL provisions fully released; 12-month ECL applied.",
  },
  {
    id: "LSE-2019-018",
    lessee: "Bangkok Airways",
    aircraft: "ATR 72-600",
    from: "2" as const,
    to: "1" as const,
    date: "2026-01-20",
    trigger: "Credit upgrade + DPD cleared",
    ecl_delta: "−$0.19M",
    detail:
      "S&P upgrade B− → B+. All arrears settled. Thailand watchlist removed. No active SICR conditions. Stage 2 → Stage 1 cure confirmed at Q1 assessment.",
  },
  {
    id: "LSE-2022-041",
    lessee: "Wideroe",
    aircraft: "E190-E2",
    from: "2" as const,
    to: "1" as const,
    date: "2026-01-25",
    trigger: "DPD cleared + normalised PD",
    ecl_delta: "−$0.08M",
    detail:
      "35 DPD flagged Oct 2025; full payment since. Country watchlist removed. PD reverted to Stage 1 band. SICR conditions no longer met per §B5.5.7.",
  },
];

// §35H ECL Roll-Forward — cross-checked: closing S1+S2+S3 = $47.20M ✓
const rollForwardRows: RollForwardRow[] = [
  { label: "Opening ECL balance", s1: 8.10, s2: 20.40, s3: 16.30, total: 44.80, isBold: true, isBlue: true },
  { label: "New originations (Stage 1)", s1: 1.20, s2: null, s3: null, total: 1.20 },
  { label: "SICR transfers to Stage 2", s1: -0.85, s2: 2.10, s3: null, total: 1.25 },
  { label: "SICR transfers to Stage 3", s1: null, s2: -1.40, s3: 2.80, total: 1.40 },
  { label: "Write-offs", s1: null, s2: null, s3: -2.10, total: -2.10 },
  { label: "Repayments / derecognition", s1: -0.45, s2: -0.85, s3: -0.40, total: -1.70 },
  { label: "FX and unwinding of discount", s1: 0.40, s2: 1.35, s3: 0.60, total: 2.35 },
  { label: "Closing ECL balance", s1: 8.40, s2: 21.60, s3: 17.20, total: 47.20, isBold: true, isBlue: true },
];

// §35I Credit Quality — cross-checked: S1 $771M, S2 $118M, S3 $24.2M, Total $913.2M ✓
const creditGradeRows: CreditGradeRow[] = [
  { grade: "A / A−", riskZone: "low", s1Ead: 412.0, s2Ead: 0.0, s3Ead: 0.0, totalEad: 412.0, portfolioPct: 45.1 },
  { grade: "BBB", riskZone: "low", s1Ead: 185.0, s2Ead: 12.0, s3Ead: 0.0, totalEad: 197.0, portfolioPct: 21.6 },
  { grade: "BB / BB−", riskZone: "watch", s1Ead: 142.0, s2Ead: 48.0, s3Ead: 0.0, totalEad: 190.0, portfolioPct: 20.8 },
  { grade: "B+", riskZone: "watch", s1Ead: 32.0, s2Ead: 58.0, s3Ead: 0.0, totalEad: 90.0, portfolioPct: 9.9 },
  { grade: "B / B−", riskZone: "danger", s1Ead: 0.0, s2Ead: 0.0, s3Ead: 6.6, totalEad: 6.6, portfolioPct: 0.7 },
  { grade: "CCC and below", riskZone: "danger", s1Ead: 0.0, s2Ead: 0.0, s3Ead: 17.6, totalEad: 17.6, portfolioPct: 1.9 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtM(v: number | null): string {
  if (v === null) return "—";
  return `$${Math.abs(v).toFixed(2)}M`;
}

function fmtEad(v: number): string {
  return `$${v.toFixed(1)}M`;
}

function rollColor(v: number | null): string {
  if (v === null) return "#94A3B8";
  if (v > 0) return "#15803D";
  if (v < 0) return "#B91C1C";
  return "#475569";
}

function rollPrefix(v: number | null): string {
  if (v === null || v === 0) return "";
  return v > 0 ? "+" : "−";
}

function zoneBg(zone: CreditGradeRow["riskZone"]): string {
  if (zone === "watch") return "rgba(180,83,9,0.06)";
  if (zone === "danger") return "rgba(185,28,28,0.06)";
  return "transparent";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MigrationEventRow({
  event,
  isCure,
}: {
  event: (typeof migrationEvents)[0] | (typeof migrationCures)[0];
  isCure: boolean;
}) {
  const fromColor = isCure ? "#B45309" : event.from === "2" ? "#B45309" : "#15803D";
  const toColor = isCure ? "#15803D" : event.to === "3" ? "#B91C1C" : "#B45309";
  const deltaColor = isCure ? "#15803D" : "#B91C1C";

  return (
    <tr
      style={{ borderBottom: "1px solid #E2E8F0" }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")
      }
    >
      <td
        style={{
          padding: "0.75rem 1rem",
          fontFamily: "monospace",
          fontSize: "0.75rem",
          color: "#94A3B8",
          whiteSpace: "nowrap",
        }}
      >
        {event.id}
      </td>
      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>
        {event.lessee}
      </td>
      <td
        style={{
          padding: "0.75rem 1rem",
          color: "#475569",
          fontSize: "0.8125rem",
        }}
      >
        {event.aircraft}
      </td>
      <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: fromColor,
              background:
                event.from === "2"
                  ? "rgba(180,83,9,0.1)"
                  : "rgba(21,128,61,0.1)",
              padding: "0.2rem 0.5rem",
              borderRadius: "4px",
            }}
          >
            S{event.from}
          </span>
          <ArrowRight size={12} color="#94A3B8" />
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: toColor,
              background: isCure
                ? "rgba(21,128,61,0.1)"
                : event.to === "3"
                ? "rgba(185,28,28,0.1)"
                : "rgba(180,83,9,0.1)",
              padding: "0.2rem 0.5rem",
              borderRadius: "4px",
            }}
          >
            S{event.to}
          </span>
        </div>
      </td>
      <td
        style={{
          padding: "0.75rem 1rem",
          fontSize: "0.8125rem",
          color: "#475569",
          whiteSpace: "nowrap",
        }}
      >
        {event.date}
      </td>
      <td style={{ padding: "0.75rem 1rem", maxWidth: "220px" }}>
        <div
          style={{
            fontSize: "0.75rem",
            color: "#002147",
            fontWeight: 500,
            marginBottom: "0.2rem",
          }}
        >
          {event.trigger}
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "#94A3B8",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {event.detail}
        </div>
      </td>
      <td
        style={{
          padding: "0.75rem 1rem",
          fontWeight: 600,
          color: deltaColor,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {event.ecl_delta}
      </td>
    </tr>
  );
}

// ─── Stage column header helper ───────────────────────────────────────────────

function StageHeader({ stage, label }: { stage: "s1" | "s2" | "s3"; label: string }) {
  const color = stage === "s1" ? "#15803D" : stage === "s2" ? "#B45309" : "#B91C1C";
  return (
    <th
      style={{
        padding: "0.75rem 1rem",
        textAlign: "right",
        fontSize: "0.75rem",
        fontWeight: 600,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: color,
          marginRight: "0.35rem",
          verticalAlign: "middle",
        }}
      />
      {label}
    </th>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function StageMigrationTab() {
  const portfolioTotal = creditGradeRows.reduce((s, r) => s + r.totalEad, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── 1. Migration Matrix ─────────────────────────────────────────── */}
      <Card
        title="Stage Migration Matrix"
        subtitle="Q4 2025 → Q1 2026 period-on-period — count of leases per transition"
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
              width: "100%",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  From ↓ / To →
                </th>
                {[
                  { label: "Stage 1", color: "#15803D", bg: "rgba(21,128,61,0.05)" },
                  { label: "Stage 2", color: "#B45309", bg: "rgba(180,83,9,0.05)" },
                  { label: "Stage 3", color: "#B91C1C", bg: "rgba(185,28,28,0.05)" },
                  { label: "New Default", color: "#B91C1C", bg: "rgba(185,28,28,0.05)" },
                ].map((col) => (
                  <th
                    key={col.label}
                    style={{
                      padding: "0.75rem 1.5rem",
                      textAlign: "center",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: col.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      background: col.bg,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {migrationMatrix.map((row) => (
                <tr key={row.from} style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "1rem", fontWeight: 600, color: "#0F172A" }}>
                    {row.from}
                  </td>
                  {[
                    { val: row.toS1, color: "#15803D" },
                    { val: row.toS2, color: row.toS2 > 0 ? "#B45309" : "#94A3B8" },
                    { val: row.toS3, color: row.toS3 > 0 ? "#B91C1C" : "#94A3B8" },
                    { val: row.newDefaults, color: row.newDefaults > 0 ? "#B91C1C" : "#94A3B8" },
                  ].map((cell, ci) => (
                    <td key={ci} style={{ padding: "1rem", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: "1.25rem",
                          fontWeight: 600,
                          color: cell.color,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {cell.val}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary tiles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "0.75rem",
            }}
          >
            {[
              {
                count: "+6",
                label: "S1 → S2 migrations",
                detail: "SriLankan, Air Transat (+4 others)",
                color: "#B45309",
                bg: "rgba(180,83,9,0.08)",
              },
              {
                count: "+2",
                label: "S2 → S3 migrations",
                detail: "IndiGo Airlines, Aeromexico",
                color: "#B91C1C",
                bg: "rgba(185,28,28,0.08)",
              },
              {
                count: "+3",
                label: "S2 → S1 cures",
                detail: "Air Baltic, Bangkok Airways, Wideroe",
                color: "#15803D",
                bg: "rgba(21,128,61,0.08)",
              },
            ].map((t) => (
              <div
                key={t.label}
                style={{
                  padding: "0.75rem",
                  background: t.bg,
                  borderRadius: "0.75rem",
                  borderLeft: `3px solid ${t.color}`,
                }}
              >
                <div
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    color: t.color,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {t.count}
                </div>
                <div style={{ fontSize: "0.75rem", color: t.color }}>{t.label}</div>
                <div
                  style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.25rem" }}
                >
                  {t.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── 2. §35H ECL Roll-Forward Reconciliation ─────────────────────── */}
      <Card
        title="IFRS 7 §35H — ECL Allowance Roll-Forward Reconciliation"
        subtitle="Q4 2025 opening → Q1 2026 closing · All figures in $M"
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.8125rem",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <thead>
              <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                <th
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Movement
                </th>
                <StageHeader stage="s1" label="Stage 1" />
                <StageHeader stage="s2" label="Stage 2" />
                <StageHeader stage="s3" label="Stage 3" />
                <th
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "right",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rollForwardRows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: "1px solid #E2E8F0",
                    background: row.isBlue ? "#EFF6FF" : "transparent",
                  }}
                >
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      fontWeight: row.isBold ? 700 : 400,
                      color: "#0F172A",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {row.label}
                  </td>
                  {([row.s1, row.s2, row.s3, row.total] as (number | null)[]).map((v, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: "0.75rem 1rem",
                        textAlign: "right",
                        fontWeight: row.isBold ? 700 : 400,
                        color: row.isBold ? "#0F172A" : rollColor(v),
                        fontSize: "0.8125rem",
                      }}
                    >
                      {v === null
                        ? "—"
                        : `${rollPrefix(v)}${fmtM(v)}`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── 3. §35I Credit Quality Distribution ─────────────────────────── */}
      <Card
        title="IFRS 7 §35I — Credit Quality Distribution by Rating Grade"
        subtitle="Gross carrying amount (EAD) by rating grade × IFRS 9 stage · Q1 2026 · All figures in $M"
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.8125rem",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <thead>
              <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                <th
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Grade
                </th>
                <StageHeader stage="s1" label="S1 EAD" />
                <StageHeader stage="s2" label="S2 EAD" />
                <StageHeader stage="s3" label="S3 EAD" />
                <th
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "right",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Total EAD
                </th>
                <th
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "right",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  % Portfolio
                </th>
              </tr>
            </thead>
            <tbody>
              {creditGradeRows.map((row) => (
                <tr
                  key={row.grade}
                  style={{
                    borderBottom: "1px solid #E2E8F0",
                    background: zoneBg(row.riskZone),
                  }}
                >
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      fontWeight: 600,
                      color: "#0F172A",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {row.grade}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", textAlign: "right", color: "#475569" }}>
                    {row.s1Ead > 0 ? fmtEad(row.s1Ead) : "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", textAlign: "right", color: "#475569" }}>
                    {row.s2Ead > 0 ? fmtEad(row.s2Ead) : "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", textAlign: "right", color: "#475569" }}>
                    {row.s3Ead > 0 ? fmtEad(row.s3Ead) : "—"}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "#0F172A",
                    }}
                  >
                    {fmtEad(row.totalEad)}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "0.5rem",
                      }}
                    >
                      <div
                        style={{
                          width: "48px",
                          height: "6px",
                          background: "#E2E8F0",
                          borderRadius: "3px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${(row.portfolioPct / 50) * 100}%`,
                            height: "100%",
                            background:
                              row.riskZone === "danger"
                                ? "#B91C1C"
                                : row.riskZone === "watch"
                                ? "#B45309"
                                : "#002147",
                            borderRadius: "3px",
                          }}
                        />
                      </div>
                      <span style={{ color: "#475569", fontSize: "0.8125rem" }}>
                        {row.portfolioPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    fontWeight: 700,
                    color: "#0F172A",
                    fontSize: "0.8125rem",
                  }}
                >
                  Total
                </td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#0F172A",
                  }}
                >
                  {fmtEad(creditGradeRows.reduce((s, r) => s + r.s1Ead, 0))}
                </td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#0F172A",
                  }}
                >
                  {fmtEad(creditGradeRows.reduce((s, r) => s + r.s2Ead, 0))}
                </td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#0F172A",
                  }}
                >
                  {fmtEad(creditGradeRows.reduce((s, r) => s + r.s3Ead, 0))}
                </td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#0F172A",
                  }}
                >
                  {fmtEad(portfolioTotal)}
                </td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#0F172A",
                  }}
                >
                  100.0%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── 4. Stage Deterioration Events ────────────────────────────────── */}
      <Card
        title="Stage Deterioration Events — Q1 2026"
        subtitle="Individual lease migrations with SICR trigger reasons"
        noPadding
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.8125rem",
            }}
          >
            <thead>
              <tr
                style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}
              >
                {[
                  "Lease ID",
                  "Lessee",
                  "Aircraft",
                  "Migration",
                  "Date",
                  "SICR Trigger & Detail",
                  "ECL Δ",
                ].map((h) => (
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
                ))}
              </tr>
            </thead>
            <tbody>
              {migrationEvents.map((e) => (
                <MigrationEventRow key={e.id} event={e} isCure={false} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── 5. Stage Cure Events ──────────────────────────────────────────── */}
      <Card
        title="Stage Cure Events — Q1 2026"
        subtitle="Leases returning to Stage 1 following SICR condition removal"
        noPadding
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.8125rem",
            }}
          >
            <thead>
              <tr
                style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}
              >
                {[
                  "Lease ID",
                  "Lessee",
                  "Aircraft",
                  "Migration",
                  "Date",
                  "Cure Condition Met",
                  "ECL Δ",
                ].map((h) => (
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
                ))}
              </tr>
            </thead>
            <tbody>
              {migrationCures.map((e) => (
                <MigrationEventRow key={e.id} event={e} isCure />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
