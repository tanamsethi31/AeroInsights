import { useState } from "react";
import { AlertTriangle, ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { CountryFlag } from "../ui/CountryFlag";
import { Card } from "../ui/Card";
import { StatusPill } from "../ui/StatusPill";
import type { Jurisdiction, Precedent } from "./jurisdictionData";
import {
  JURISDICTION_SANCTIONS,
  sanctionsSeverityColor,
  sanctionsSeverityBg,
  sanctionsSeverityLabel,
} from "../../data/sanctionsData";

const PRECEDENT_PREVIEW = 5;

function ScoreBlock({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? "#15803D" : value >= 50 ? "#B45309" : "#B91C1C";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <span style={{ fontSize: "1.75rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value}<span style={{ fontSize: "1rem", fontWeight: 500, color: "#94A3B8" }}>/100</span>
      </span>
    </div>
  );
}

function UncertaintyBadge({ band }: { band: Jurisdiction["uncertaintyBand"] }) {
  const map = {
    low: { label: "Low Uncertainty", color: "#15803D", bg: "#F0FDF4", border: "rgba(21,128,61,0.25)" },
    medium: { label: "Medium Uncertainty", color: "#B45309", bg: "#FFFBEB", border: "rgba(180,83,9,0.25)" },
    high: { label: "High Uncertainty", color: "#C2410C", bg: "#FFF7ED", border: "rgba(194,65,12,0.25)" },
    extreme: { label: "Extreme Uncertainty", color: "#B91C1C", bg: "#FEF2F2", border: "rgba(185,28,28,0.3)" },
  };
  const s = map[band];
  return (
    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: "0.25rem 0.625rem", borderRadius: "9999px" }}>
      {s.label}
    </span>
  );
}

function RepossessionBar({
  p50,
  p90,
  stress,
}: {
  p50: number;
  p90: number;
  stress: boolean;
}) {
  const dp50 = stress ? Math.round(p50 * 1.4) : p50;
  const dp90 = stress ? Math.round(p90 * 1.6) : p90;
  const barColor = stress ? "#DC2626" : "#002147";
  const trackColor = stress ? "rgba(220,38,38,0.12)" : "#E2E8F0";
  const fillPct = Math.min(100, (dp50 / dp90) * 100);

  if (p50 >= 999) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 0.875rem", background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.25)", borderRadius: "0.5rem" }}>
        <AlertTriangle size={14} color="#B91C1C" />
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#B91C1C" }}>
          Unrecoverable — sanctions / fleet detention active
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {/* Track */}
      <div style={{ position: "relative", height: "12px", background: trackColor, borderRadius: "9999px", overflow: "visible" }}>
        {/* P50 fill */}
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${fillPct}%`, background: barColor, borderRadius: "9999px", transition: "width 300ms ease, background 300ms ease" }} />
        {/* P50 label */}
        <div style={{ position: "absolute", left: `${fillPct}%`, top: "-22px", transform: "translateX(-50%)", fontSize: "0.6875rem", fontWeight: 700, color: barColor, whiteSpace: "nowrap" }}>
          P50: {dp50}m
        </div>
        {/* P90 label */}
        <div style={{ position: "absolute", right: 0, top: "-22px", fontSize: "0.6875rem", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
          P90: {dp90}m
        </div>
      </div>
      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
        Months to successful repossession{stress ? " (stress scenario applied)" : ""}
      </div>
    </div>
  );
}

function PrecedentOutcomePill({ outcome }: { outcome: Precedent["outcome"] }) {
  const stage =
    outcome === "Returned" ? "green" as const
    : outcome === "Detained" ? "red" as const
    : "amber" as const;
  return <StatusPill stage={stage} label={outcome} />;
}

interface Props {
  jurisdiction: Jurisdiction;
  precedents: Precedent[];
}

export function JurisdictionDetail({ jurisdiction: j, precedents }: Props) {
  const [stress, setStress] = useState(false);
  const [showAllPrecedents, setShowAllPrecedents] = useState(false);

  const filteredPrecedents = precedents.filter((p) => p.country === j.code);
  const visiblePrecedents = showAllPrecedents
    ? filteredPrecedents
    : filteredPrecedents.slice(0, PRECEDENT_PREVIEW);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
          <CountryFlag code={j.code} size={36} />
          <div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>{j.country}</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748B", background: "#F1F5F9", padding: "0.125rem 0.5rem", borderRadius: "0.375rem" }}>
                {j.region}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>Updated {j.lastUpdated}</span>
            </div>
          </div>
        </div>
        <UncertaintyBadge band={j.uncertaintyBand} />
      </div>

      {/* AWG Alert */}
      {j.awgAlert && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", padding: "0.75rem 1rem", background: "#FFFBEB", border: "1px solid #F59E0B", borderRadius: "0.5rem" }}>
          <AlertTriangle size={15} color="#B45309" style={{ flexShrink: 0, marginTop: "1px" }} />
          <span style={{ fontSize: "0.8125rem", color: "#92400E", lineHeight: 1.5 }}>
            <strong>AWG Update:</strong> {j.awgAlert}
          </span>
        </div>
      )}

      {/* Scores */}
      <Card title="Risk Scores">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
          <ScoreBlock label="CTC Score" value={j.ctcScore} />
          <ScoreBlock label="Enforceability" value={j.enforceability} />
          <ScoreBlock label="Rule of Law" value={j.ruleOfLaw} />
        </div>

        {/* Badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #F1F5F9" }}>
          {j.sanctions !== "None" ? (
            <StatusPill stage="red" label={`Sanctioned: ${j.sanctions}`} />
          ) : j.ctcParty ? (
            <StatusPill stage="green" label="CTC Party" />
          ) : (
            <StatusPill stage="amber" label="Non-CTC" />
          )}
          {j.altA && (
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0369A1", background: "rgba(3,105,161,0.08)", padding: "0.25rem 0.625rem", borderRadius: "9999px", border: "1px solid rgba(3,105,161,0.2)" }}>
              Alt A
            </span>
          )}
          {j.idera && (
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#15803D", background: "rgba(21,128,61,0.08)", padding: "0.25rem 0.625rem", borderRadius: "9999px", border: "1px solid rgba(21,128,61,0.2)" }}>
              IDERA
            </span>
          )}
        </div>
      </Card>

      {/* Repossession timeline */}
      <Card title="Repossession Timeline Model">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Stress toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.8125rem", color: "#475569", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={stress}
                onChange={(e) => setStress(e.target.checked)}
                style={{ accentColor: "#DC2626", width: "14px", height: "14px", cursor: "pointer" }}
              />
              Apply stress scenario <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>(P50 ×1.4 · P90 ×1.6)</span>
            </label>
          </div>

          {/* Bar */}
          <div style={{ paddingTop: "1.5rem" }}>
            <RepossessionBar p50={j.repossP50} p90={j.repossP90} stress={stress} />
          </div>

          {/* Cost + success row */}
          {j.repossP50 < 999 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", paddingTop: "0.5rem", borderTop: "1px solid #F1F5F9" }}>
              <div>
                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>P50 Cost</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>
                  {stress
                    ? `~${(parseFloat(j.repossP50Cost) * 1.4).toFixed(1)}%`
                    : j.repossP50Cost}
                  <span style={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: 400 }}> of AV</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>P90 Cost</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>
                  {stress
                    ? `~${(parseFloat(j.repossP90Cost) * 1.6).toFixed(1)}%`
                    : j.repossP90Cost}
                  <span style={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: 400 }}> of AV</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Success Prob.</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: parseInt(j.successProb) >= 80 ? "#15803D" : parseInt(j.successProb) >= 60 ? "#B45309" : "#B91C1C" }}>
                  {j.successProb}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Analyst Narrative */}
      <Card title="Analyst Note">
        <p style={{ fontSize: "0.875rem", color: "#334155", lineHeight: 1.65, margin: 0 }}>
          {j.narrative}
        </p>
      </Card>

      {/* Sanctions */}
      {(() => {
        const sp = JURISDICTION_SANCTIONS[j.code];
        if (!sp) return null;
        const color  = sanctionsSeverityColor(sp.severity);
        const bg     = sanctionsSeverityBg(sp.severity);
        const label  = sanctionsSeverityLabel(sp.severity);
        const Icon   = sp.severity === "none" ? ShieldCheck : sp.severity === "secondary" ? Shield : ShieldAlert;
        return (
          <Card title="Sanctions Profile">
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
              {/* Icon */}
              <div style={{ width: "44px", height: "44px", borderRadius: "0.75rem", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={22} style={{ color }} />
              </div>

              <div style={{ flex: 1 }}>
                {/* Status header */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.9375rem", fontWeight: 700, color }}>{label}</span>
                  {sp.severity !== "none" && sp.lists.length > 0 && (
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      {sp.lists.map((l) => (
                        <span key={l} style={{
                          fontSize: "0.6875rem", fontWeight: 700, padding: "0.1rem 0.45rem",
                          borderRadius: "9999px", background: `${color}18`, color, border: `1px solid ${color}30`,
                        }}>
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {sp.notes ? (
                  <p style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>{sp.notes}</p>
                ) : (
                  <p style={{ fontSize: "0.8125rem", color: "#94A3B8", margin: 0 }}>No sanctions designations recorded. Standard screening applies.</p>
                )}

                {/* Last updated */}
                {sp.lastUpdated && (
                  <div style={{ marginTop: "0.625rem", fontSize: "0.75rem", color: "#94A3B8" }}>
                    Profile updated: {sp.lastUpdated} · Feeds: OFAC SDN · EU Consolidated · UKOFSI · UN SCSL
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Precedents */}
      <Card title={`Repossession Precedents (${filteredPrecedents.length})`} noPadding>
        {filteredPrecedents.length === 0 ? (
          <div style={{ padding: "1.5rem 1rem", color: "#94A3B8", fontSize: "0.8125rem", textAlign: "center" }}>
            No public precedents recorded for this jurisdiction
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["Year", "Lessor", "Airline", "Aircraft", "Timeline", "Outcome"].map((h) => (
                    <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblePrecedents.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                    <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{p.year}</td>
                    <td style={{ padding: "0.625rem 1rem", fontWeight: 600, color: "#0F172A" }}>{p.lessor}</td>
                    <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{p.airline}</td>
                    <td style={{ padding: "0.625rem 1rem", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{p.aircraft}</td>
                    <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{p.timeline}</td>
                    <td style={{ padding: "0.625rem 1rem" }}>
                      <PrecedentOutcomePill outcome={p.outcome} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPrecedents.length > PRECEDENT_PREVIEW && (
              <button
                onClick={() => setShowAllPrecedents((p) => !p)}
                style={{ width: "100%", padding: "0.625rem", fontSize: "0.8125rem", color: "#475569", background: "#F8FAFC", border: "none", borderTop: "1px solid #E2E8F0", cursor: "pointer" }}
              >
                {showAllPrecedents
                  ? "Show fewer"
                  : `Show all ${filteredPrecedents.length} precedents`}
              </button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
