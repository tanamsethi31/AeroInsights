import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { Check, X, Circle, Plane } from "lucide-react";
import { CountryFlag } from "../components/ui/CountryFlag";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { Card } from "../components/ui/Card";
import { LesseeProfilePanel, type LesseeId } from "../components/counterparties/LesseeProfilePanel";
import { WATCHLIST_DATA } from "../components/counterparties/watchlistEngine";
import {
  LESSEE_SANCTIONS,
  FLEET_TRACKER,
  lesseeSanctionsColor,
  lesseeSanctionsBg,
  lesseeSanctionsLabel,
  alertColor,
  type AircraftSanctionsAlert,
} from "../data/sanctionsData";

// ─── SignalFeedPanel ──────────────────────────────────────────────────────────

type FeedEntry = {
  lesseeId:    string;
  lesseeName:  string;
  toStatus:    "amber" | "red";
  triggeredBy: string;
  timestamp:   string;
  score:       number;
};

function ragColor(s: "amber" | "red") {
  return s === "red" ? "#B91C1C" : "#B45309";
}
function ragBg(s: "amber" | "red") {
  return s === "red" ? "rgba(185,28,28,0.08)" : "rgba(180,83,9,0.08)";
}

function SignalFeedPanel({ onSelectLessee }: { onSelectLessee: (id: string) => void }) {
  const feed: FeedEntry[] = useMemo(() => {
    return Object.values(WATCHLIST_DATA)
      .flatMap(entry =>
        entry.auditLog
          .filter(a => a.fromStatus !== null && a.toStatus !== "green")
          .map(a => ({
            lesseeId:   entry.lesseeId,
            lesseeName: entry.lesseeName,
            toStatus:   a.toStatus as "amber" | "red",
            triggeredBy: a.triggeredBy,
            timestamp:  a.timestamp,
            score:      a.score,
          }))
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8);
  }, []);

  if (feed.length === 0) return null;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1.25rem",
          borderBottom: "1px solid #E2E8F0",
          background: "#F8FAFC",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: "#B91C1C",
              boxShadow: "0 0 0 3px rgba(185,28,28,0.18)",
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>
            Live Signal Feed
          </span>
          <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
            — latest watchlist alert events across all counterparties
          </span>
        </div>
        <span
          style={{
            fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8",
            background: "#F1F5F9", borderRadius: "0.375rem", padding: "0.2rem 0.5rem",
          }}
        >
          {feed.length} events
        </span>
      </div>

      {/* Feed row */}
      <div
        style={{
          display: "flex",
          gap: "0.625rem",
          padding: "0.875rem 1.25rem",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {feed.map((entry, i) => {
          const c  = ragColor(entry.toStatus);
          const bg = ragBg(entry.toStatus);
          return (
            <button
              key={i}
              onClick={() => onSelectLessee(entry.lesseeId)}
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                background: bg,
                border: `1px solid ${c}28`,
                borderRadius: "0.625rem",
                padding: "0.625rem 0.875rem",
                cursor: "pointer",
                textAlign: "left",
                minWidth: "200px",
                maxWidth: "220px",
                transition: "box-shadow 150ms ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 0 2px ${c}44`)}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: "0.6875rem", fontWeight: 700,
                    color: c, textTransform: "uppercase", letterSpacing: "0.03em",
                  }}
                >
                  {entry.toStatus}
                </span>
                <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>
                  {entry.timestamp.slice(0, 10)}
                </span>
              </div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>
                {entry.lesseeName}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#475569", lineHeight: 1.3 }}>
                {entry.triggeredBy}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>
                Risk score: <strong style={{ color: c }}>{entry.score.toFixed(1)}</strong>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const lessees = [
  {
    id: "INDIGO",
    name: "IndiGo Airlines",
    country: "India",
    rating: "BB-",
    stage: "3" as const,
    behaviorScore: 44,
    scores: { punctuality: 28, restructuringCoop: 52, govtInterference: 41, litigationPropensity: 55 },
    exposure: "$184M",
    leases: 6,
    lastPayment: "2026-03-14",
    daysOverdue: 45,
    notes: "Payment 45 days overdue. §1110 cure risk elevated. Seeking deferral.",
  },
  {
    id: "AEROMEX",
    name: "Aeromexico",
    country: "Mexico",
    rating: "CCC",
    stage: "3" as const,
    behaviorScore: 29,
    scores: { punctuality: 18, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
    exposure: "$122M",
    leases: 4,
    lastPayment: "2026-01-31",
    daysOverdue: 88,
    notes: "Chapter 11 filing. §1110 cure window active. AerCap and Air Lease precedent reviewed.",
  },
  {
    id: "SRILNKN",
    name: "SriLankan Airlines",
    country: "Sri Lanka",
    rating: "B+",
    stage: "2" as const,
    behaviorScore: 62,
    scores: { punctuality: 55, restructuringCoop: 70, govtInterference: 48, litigationPropensity: 75 },
    exposure: "$118M",
    leases: 4,
    lastPayment: "2026-04-10",
    daysOverdue: 12,
    notes: "Downgraded by S&P. Government-owned carrier. High litigation propensity.",
  },
  {
    id: "AZUL",
    name: "Azul Brazilian Airlines",
    country: "Brazil",
    rating: "B+",
    stage: "2" as const,
    behaviorScore: 71,
    scores: { punctuality: 68, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
    exposure: "$142M",
    leases: 5,
    lastPayment: "2026-04-20",
    daysOverdue: 6,
    notes: "Schedule reductions. Liquidity tightening. Constructive engagement so far.",
  },
  {
    id: "TRANSATCA",
    name: "Air Transat",
    country: "Canada",
    rating: "B",
    stage: "2" as const,
    behaviorScore: 68,
    scores: { punctuality: 62, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
    exposure: "$96M",
    leases: 3,
    lastPayment: "2026-04-22",
    daysOverdue: 8,
    notes: "Restructuring discussions initiated. Canadian jurisdiction favorable for lessor.",
  },
  {
    id: "EMIRATES",
    name: "Emirates",
    country: "UAE",
    rating: "A-",
    stage: "1" as const,
    behaviorScore: 94,
    scores: { punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
    exposure: "$412M",
    leases: 8,
    lastPayment: "2026-04-28",
    daysOverdue: 0,
    notes: "Exemplary payment history. Strong sovereign backing. Low risk.",
  },
];


export default function Counterparties() {
  const location = useLocation();
  const [selectedLessee, setSelectedLessee] = useState(lessees[0]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("lessee");
    if (id) {
      const found = lessees.find(l => l.id === id);
      if (found) setSelectedLessee(found);
    }
  }, [location.search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Counterparties"
        subtitle="Lessee profiles, behavior scores & restructuring simulator"
      />

      {/* Portfolio-wide live signal feed */}
      <SignalFeedPanel
        onSelectLessee={(id) => {
          const found = lessees.find(l => l.id === id);
          if (found) setSelectedLessee(found);
        }}
      />

      {/* Sanctions screening summary strip */}
      {(() => {
        const alerts  = Object.values(LESSEE_SANCTIONS).filter(s => s.status === "alert").length;
        const monitor = Object.values(LESSEE_SANCTIONS).filter(s => s.status === "monitoring").length;
        const clear   = Object.values(LESSEE_SANCTIONS).filter(s => s.status === "clear").length;
        const fleetAlerts = FLEET_TRACKER.filter(f => f.alert !== "clear").length;
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
            {[
              { label: "Sanctions Alerts", value: alerts, color: alerts > 0 ? "#B91C1C" : "#15803D", bg: alerts > 0 ? "rgba(185,28,28,0.06)" : "rgba(21,128,61,0.06)", border: alerts > 0 ? "rgba(185,28,28,0.2)" : "rgba(21,128,61,0.2)", Icon: alerts > 0 ? X : Check },
              { label: "Under Monitoring", value: monitor, color: monitor > 0 ? "#B45309" : "#94A3B8", bg: monitor > 0 ? "rgba(180,83,9,0.06)" : "#F8FAFC", border: monitor > 0 ? "rgba(180,83,9,0.2)" : "#E2E8F0", Icon: Circle },
              { label: "Sanctions Clear", value: clear, color: "#15803D", bg: "rgba(21,128,61,0.06)", border: "rgba(21,128,61,0.2)", Icon: Check },
              { label: "Fleet Exposure Flags", value: fleetAlerts, color: fleetAlerts > 0 ? "#B45309" : "#15803D", bg: fleetAlerts > 0 ? "rgba(180,83,9,0.06)" : "rgba(21,128,61,0.06)", border: fleetAlerts > 0 ? "rgba(180,83,9,0.2)" : "rgba(21,128,61,0.2)", Icon: Plane },
            ].map(({ label, value, color, bg, border, Icon }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: "0.75rem", padding: "0.875rem 1.125rem" }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>{label}</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <Icon size={16} style={{ color }} />{value}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.2rem" }}>screened {new Date().toLocaleDateString("en-GB")}</div>
              </div>
            ))}
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Lessee List */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>Lessees</div>
            <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{lessees.length} counterparties</div>
          </div>
          <div>
            {lessees.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedLessee(l)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  width: "100%",
                  padding: "0.875rem 1.25rem",
                  borderBottom: "1px solid #E2E8F0",
                  background: selectedLessee.id === l.id ? "#F4F5F7" : "#FFFFFF",
                  border: "none",
                  borderLeft: selectedLessee.id === l.id ? "3px solid #002147" : "3px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 150ms ease",
                }}
              >
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: l.stage === "3" ? "rgba(185,28,28,0.1)" : l.stage === "2" ? "rgba(180,83,9,0.1)" : "rgba(21,128,61,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: l.stage === "3" ? "#B91C1C" : l.stage === "2" ? "#B45309" : "#15803D",
                  flexShrink: 0,
                }}>
                  {l.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94A3B8", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <CountryFlag country={l.country} size={12} />
                    {l.country} · {l.rating}
                  </div>
                  {/* Sanctions badge */}
                  {(() => {
                    const sc = LESSEE_SANCTIONS[l.id];
                    if (!sc) return null;
                    return (
                      <div style={{
                        marginTop: "0.25rem",
                        display: "inline-flex", alignItems: "center", gap: "0.25rem",
                        fontSize: "0.6125rem", fontWeight: 700,
                        color: lesseeSanctionsColor(sc.status),
                        background: lesseeSanctionsBg(sc.status),
                        borderRadius: "9999px",
                        padding: "0.1rem 0.45rem",
                      }}>
                        {sc.status === "clear"
                          ? <Check size={13} style={{ display: "inline", verticalAlign: "middle", color: "#15803D" }} />
                          : sc.status === "monitoring"
                            ? <Circle size={13} style={{ display: "inline", verticalAlign: "middle", color: "#B45309" }} />
                            : <X size={13} style={{ display: "inline", verticalAlign: "middle", color: "#B91C1C" }} />}{" "}
                        {lesseeSanctionsLabel(sc.status)}
                      </div>
                    );
                  })()}
                </div>
                <StatusPill stage={l.stage} label={l.stage === "3" ? "S3" : l.stage === "2" ? "S2" : "S1"} />
              </button>
            ))}
          </div>
        </div>

        {/* Lessee Detail */}
        <LesseeProfilePanel lesseeId={selectedLessee.id as LesseeId} />
      </div>

      {/* Fleet Sanctions Tracker */}
      <Card
        title="Fleet Sanctions Tracker"
        subtitle="Per-aircraft operating country and route exposure — screened against OFAC / EU / UK / UN lists daily"
        noPadding
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                {["Reg", "Type", "MSN", "Lessee", "Operating Country", "Sanctions Status", "Route Exposure", "Alert", "Last Checked"].map((h) => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FLEET_TRACKER.map((aircraft, i) => {
                const alertClr = alertColor(aircraft.alert);
                const alertBg: Record<AircraftSanctionsAlert, string> = {
                  red: "rgba(185,28,28,0.06)",
                  secondary: "rgba(180,83,9,0.06)",
                  clear: "transparent",
                };
                const alertLabel: Record<AircraftSanctionsAlert, string> = {
                  red: "Red Alert",
                  secondary: "Secondary Risk",
                  clear: "Clear",
                };
                const rowBg = aircraft.alert !== "clear"
                  ? alertBg[aircraft.alert]
                  : i % 2 === 0 ? "#FFFFFF" : "#F4F5F7";
                return (
                  <tr key={aircraft.reg} style={{ borderBottom: "1px solid #E2E8F0", background: rowBg }}>
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontWeight: 600, color: "#0F172A" }}>{aircraft.reg}</td>
                    <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{aircraft.type}</td>
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#475569" }}>{aircraft.msn}</td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{aircraft.lessee}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ fontWeight: 500, color: "#0F172A" }}>{aircraft.operatingCountry}</div>
                      <div style={{ fontSize: "0.6875rem", fontFamily: "monospace", color: "#94A3B8" }}>{aircraft.operatingCountryCode}</div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <StatusPill
                        stage={aircraft.operatingCountrySanctions === "none" ? "green" : "red"}
                        label={aircraft.operatingCountrySanctions === "none" ? "Clean" : "Sanctioned"}
                      />
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      {aircraft.routeExposure.length === 0 ? (
                        <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>None</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                          {aircraft.routeExposure.map((r) => (
                            <span key={r.countryCode} style={{
                              fontSize: "0.6875rem", fontWeight: 600,
                              color: "#B91C1C",
                              background: "rgba(185,28,28,0.08)",
                              border: "1px solid rgba(185,28,28,0.2)",
                              borderRadius: "9999px",
                              padding: "0.15rem 0.45rem",
                            }}>
                              {r.countryCode} — {r.exposure}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span style={{
                          width: "7px", height: "7px", borderRadius: "50%",
                          background: alertClr,
                          flexShrink: 0,
                          ...(aircraft.alert !== "clear" ? { boxShadow: `0 0 0 2px ${alertClr}30` } : {}),
                        }} />
                        <span style={{ fontWeight: 600, color: alertClr, fontSize: "0.8125rem" }}>
                          {alertLabel[aircraft.alert]}
                        </span>
                      </div>
                      {aircraft.alertDetail && (
                        <div style={{ fontSize: "0.6875rem", color: "#B45309", marginTop: "0.2rem", maxWidth: "200px", lineHeight: 1.35 }}>
                          {aircraft.alertDetail}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#94A3B8", whiteSpace: "nowrap" }}>
                      {aircraft.lastChecked}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "0.625rem 1rem", borderTop: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#94A3B8", background: "#F8FAFC" }}>
          Screening cadence: OFAC SDN daily · EU Consolidated daily · UKOFSI weekly · UNSC quarterly · Route data sourced from operator-submitted flight schedules · Last full sweep: 2026-05-07 06:02 UTC
        </div>
      </Card>
    </div>
  );
}