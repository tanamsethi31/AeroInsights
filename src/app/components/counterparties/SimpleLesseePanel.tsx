// src/app/components/counterparties/SimpleLesseePanel.tsx
//
// Renders a lessee's profile from ingested T-1.2 data (behaviour scores,
// DPD, SICR flags, pay tier). When the ingested fields are present this is
// now the primary panel — no longer a degraded fallback. The "coverage not
// yet available" placeholder only shows when no real data has been ingested.
//
// The richer hardcoded LesseeProfilePanel is still used by Counterparties.tsx
// for the 6 demo airlines when ingested data is absent; once the full Phase 1
// ingestion lands (T-1.3 + T-1.4 + scenarios history per lessee), this panel
// becomes the only one and LesseeProfilePanel can be retired.

import {
  Building2, MapPin, CreditCard, FileText, Activity,
  AlertTriangle, ShieldAlert, Gavel, ArrowUpRight, ArrowDownRight, Lock,
} from "lucide-react";
import { CountryFlag } from "../ui/CountryFlag";
import { StatusPill } from "../ui/StatusPill";
import { Card } from "../ui/Card";
import { useLesseeTimeline } from "../../hooks/useLesseeTimeline";

export interface SimpleLesseeData {
  /** Lessee uuid — used by T-2.5 timeline hook. Optional for back-compat. */
  id?: string;
  name: string;
  country: string;
  rating: string;
  stage: "1" | "2" | "3";
  leases: number;
  exposure: string;
  watchlistStatus?: "green" | "amber" | "red" | null;
  // ── T-1.2 ingested columns (all optional — null means "not ingested") ─────
  region?: string | null;
  dpd_days?: number | null;
  rating_notches_down?: number | null;
  country_watchlist?: boolean | null;
  insolvency_filed?: boolean | null;
  score_punctuality?: number | null;
  score_restructuring_coop?: number | null;
  score_govt_interference?: number | null;
  score_litigation?: number | null;
  overall_behaviour_score?: number | null;
  pay_behaviour_tier?: string | null;
}

const STAGE_COLOR: Record<"1" | "2" | "3", string> = {
  "1": "#15803D", "2": "#B45309", "3": "#B91C1C",
};
const STAGE_BG: Record<"1" | "2" | "3", string> = {
  "1": "rgba(21,128,61,0.08)",
  "2": "rgba(180,83,9,0.08)",
  "3": "rgba(185,28,28,0.08)",
};
const WATCHLIST_COLOR: Record<string, string> = {
  green: "#15803D", amber: "#B45309", red: "#B91C1C",
};

function scoreColor(s: number): string {
  if (s >= 75) return "#15803D";
  if (s >= 50) return "#B45309";
  return "#B91C1C";
}

function tierColor(tier: string | null | undefined): { bg: string; fg: string } {
  const t = (tier ?? "").toLowerCase();
  if (t === "cooperative") return { bg: "rgba(21,128,61,0.10)", fg: "#15803D" };
  if (t === "adversarial") return { bg: "rgba(185,28,28,0.10)", fg: "#B91C1C" };
  return { bg: "rgba(180,83,9,0.10)", fg: "#B45309" };
}

function dpdColor(d: number): { bg: string; fg: string } {
  if (d >= 30) return { bg: "rgba(185,28,28,0.10)", fg: "#B91C1C" };
  if (d >= 5)  return { bg: "rgba(180,83,9,0.10)",  fg: "#B45309" };
  return { bg: "rgba(21,128,61,0.10)", fg: "#15803D" };
}

interface ScoreRow {
  label: string;
  value: number;
}

function ScoreBar({ label, value }: ScoreRow) {
  const color = scoreColor(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
        <span style={{ color: "#475569" }}>{label}</span>
        <span style={{ fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#F1F5F9", overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            height: "100%",
            background: color,
            transition: "width 240ms cubic-bezier(0.23,1,0.32,1)",
          }}
        />
      </div>
    </div>
  );
}

export function SimpleLesseePanel({ lessee }: { lessee: SimpleLesseeData }) {
  const stageColor = STAGE_COLOR[lessee.stage];
  const stageBg    = STAGE_BG[lessee.stage];

  const hasScores =
    lessee.score_punctuality != null ||
    lessee.score_restructuring_coop != null ||
    lessee.score_govt_interference != null ||
    lessee.score_litigation != null ||
    lessee.overall_behaviour_score != null;

  const hasSicrSignals =
    lessee.dpd_days != null ||
    lessee.rating_notches_down != null ||
    lessee.country_watchlist != null ||
    lessee.insolvency_filed != null;

  const hasIngestedData = hasScores || hasSicrSignals || lessee.pay_behaviour_tier != null;

  const scoreRows: ScoreRow[] = [
    { label: "Punctuality",                value: lessee.score_punctuality        ?? 0 },
    { label: "Restructuring cooperation",  value: lessee.score_restructuring_coop ?? 0 },
    { label: "Government interference",    value: lessee.score_govt_interference  ?? 0 },
    { label: "Litigation propensity",      value: lessee.score_litigation         ?? 0 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "0.75rem",
        padding: "1.5rem",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "1.25rem" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: stageBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.125rem", fontWeight: 700, color: stageColor, flexShrink: 0,
          }}>
            {lessee.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "1.125rem", color: "#0F172A", marginBottom: "0.25rem" }}>
              {lessee.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8125rem", color: "#64748B" }}>
                <CountryFlag country={lessee.country} size={14} />
                {lessee.country}
                {lessee.region && (
                  <span style={{ color: "#94A3B8" }}> · {lessee.region}</span>
                )}
              </div>
              <StatusPill stage={lessee.stage} label={`Stage ${lessee.stage}`} />
              {lessee.watchlistStatus && lessee.watchlistStatus !== "green" && (
                <span style={{
                  padding: "2px 8px", borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 700,
                  background: lessee.watchlistStatus === "red" ? "rgba(185,28,28,0.08)" : "rgba(180,83,9,0.08)",
                  color: WATCHLIST_COLOR[lessee.watchlistStatus],
                }}>
                  {lessee.watchlistStatus === "red" ? "● Watchlist" : "● Monitor"}
                </span>
              )}
              {lessee.pay_behaviour_tier && (
                <span style={{
                  padding: "2px 8px", borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 700,
                  background: tierColor(lessee.pay_behaviour_tier).bg,
                  color: tierColor(lessee.pay_behaviour_tier).fg,
                }}>
                  {lessee.pay_behaviour_tier}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
          {[
            { Icon: FileText,   label: "Active Leases",   value: String(lessee.leases) },
            { Icon: CreditCard, label: "Exposure",        value: lessee.exposure },
            { Icon: Building2,  label: "Credit Rating",   value: lessee.rating || "—" },
            { Icon: MapPin,     label: "Domicile",        value: lessee.country },
          ].map(({ Icon, label, value }) => (
            <div key={label} style={{
              background: "#F8FAFC", borderRadius: "0.625rem",
              padding: "0.875rem 1rem", border: "1px solid #F1F5F9",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "0.375rem" }}>
                <Icon size={13} style={{ color: "#94A3B8" }} />
                <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {label}
                </span>
              </div>
              <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SICR signals — only when at least one is ingested */}
      {hasSicrSignals && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
            <ShieldAlert size={16} style={{ color: "#002147" }} />
            <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A" }}>
              SICR Signals
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
            {lessee.dpd_days != null && (
              <SignalChip
                label="Days past due"
                value={`${lessee.dpd_days}d`}
                colors={dpdColor(lessee.dpd_days)}
              />
            )}
            {lessee.rating_notches_down != null && (
              <SignalChip
                label="Rating ↓"
                value={`${lessee.rating_notches_down} notches`}
                colors={
                  lessee.rating_notches_down >= 2
                    ? { bg: "rgba(185,28,28,0.10)", fg: "#B91C1C" }
                    : { bg: "rgba(21,128,61,0.10)", fg: "#15803D" }
                }
              />
            )}
            {lessee.country_watchlist != null && (
              <SignalChip
                label="Country watchlist"
                value={lessee.country_watchlist ? "Yes" : "No"}
                colors={lessee.country_watchlist
                  ? { bg: "rgba(180,83,9,0.10)", fg: "#B45309" }
                  : { bg: "rgba(21,128,61,0.10)", fg: "#15803D" }}
              />
            )}
            {lessee.insolvency_filed != null && (
              <SignalChip
                label="Insolvency filed"
                value={lessee.insolvency_filed ? "Yes" : "No"}
                colors={lessee.insolvency_filed
                  ? { bg: "rgba(185,28,28,0.10)", fg: "#B91C1C" }
                  : { bg: "rgba(21,128,61,0.10)", fg: "#15803D" }}
              />
            )}
          </div>
        </Card>
      )}

      {/* Behaviour scores — only when at least one score is ingested */}
      {hasScores && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Activity size={16} style={{ color: "#002147" }} />
              <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A" }}>
                Behaviour Scores
              </span>
            </div>
            {lessee.overall_behaviour_score != null && (
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>Overall</span>
                <span
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: scoreColor(lessee.overall_behaviour_score),
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {lessee.overall_behaviour_score}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem 1.5rem" }}>
            {scoreRows.map((r) => (
              <ScoreBar key={r.label} {...r} />
            ))}
          </div>
        </Card>
      )}

      {/* "Not yet ingested" placeholder — only when no T-1.2 data is present */}
      {!hasIngestedData && (
        <Card>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", padding: "0.25rem 0" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "#EFF6FF", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0,
            }}>
              <Building2 size={16} style={{ color: "#3B82F6" }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: "0.25rem", fontSize: "0.9375rem" }}>
                Behaviour profile not yet ingested
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#64748B", lineHeight: 1.6 }}>
                Re-import {lessee.name} with the canonical AeroInsights workbook
                (specifically the &quot;Lessee Profiles&quot; sheet) to populate behaviour
                scores, DPD, rating drift, and SICR flags here.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Footer with intelligence-source attribution if we have any data */}
      {hasIngestedData && (
        <div
          style={{
            fontSize: "0.7rem",
            color: "#94A3B8",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            paddingLeft: "0.25rem",
          }}
        >
          <Gavel size={11} />
          Sourced from your last portfolio import. Behaviour scores 0–100, calibrated to
          IFRS-9 SICR thresholds.
        </div>
      )}

      {/* T-2.5 — Real-data timeline derived from stage_migrations + audit_log */}
      {lessee.id && <SimpleLesseeTimeline lesseeUuid={lessee.id} />}
    </div>
  );
}

// ─── Timeline (T-2.5) ──────────────────────────────────────────────────────
//
// Renders a compact event log for the lessee. Pulls stage migrations for
// the lessee's leases and recent period locks via `useLesseeTimeline`.
// Hidden entirely when the hook returns no events (e.g. lessee has never
// crossed a stage boundary and no periods are locked).

function SimpleLesseeTimeline({ lesseeUuid }: { lesseeUuid: string }) {
  const { events, loading } = useLesseeTimeline(lesseeUuid);
  if (loading || events.length === 0) return null;
  return (
    <Card title="Timeline" subtitle="Audit-derived events for this lessee" noPadding>
      <div style={{ padding: "0.25rem 0.5rem" }}>
        {events.slice(0, 12).map((e) => {
          const Icon = e.type === "stage-change"
            ? (e.description.includes("↑") ? ArrowUpRight : ArrowDownRight)
            : Lock;
          const iconColor = e.type === "stage-change"
            ? (e.description.includes("↑") ? "#B91C1C" : "#15803D")
            : "#3730A3";
          return (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: "0.75rem",
                alignItems: "center",
                padding: "0.5rem 0.75rem",
                borderBottom: "1px solid #F1F5F9",
                fontSize: "0.8125rem",
              }}
            >
              <Icon size={13} style={{ color: iconColor }} />
              <div>
                <div style={{ color: "#0F172A", fontWeight: 500 }}>{e.description}</div>
                <div style={{ color: "#64748B", fontSize: "0.75rem", marginTop: "0.125rem" }}>
                  {e.impact}
                </div>
              </div>
              <span style={{ color: "#94A3B8", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                {e.date}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SignalChip({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: { bg: string; fg: string };
}) {
  return (
    <div
      style={{
        background: colors.bg,
        borderRadius: "0.5rem",
        padding: "0.625rem 0.75rem",
      }}
    >
      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.25rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: colors.fg, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", gap: "0.3rem" }}>
        {label.toLowerCase().includes("insolvency") && value === "Yes" && (
          <AlertTriangle size={13} />
        )}
        {value}
      </div>
    </div>
  );
}
