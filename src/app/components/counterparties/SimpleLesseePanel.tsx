// src/app/components/counterparties/SimpleLesseePanel.tsx
// Fallback detail panel for lessees that don't have a full intelligence profile.
import { Building2, MapPin, CreditCard, FileText } from "lucide-react";
import { CountryFlag } from "../ui/CountryFlag";
import { StatusPill } from "../ui/StatusPill";
import { Card } from "../ui/Card";

export interface SimpleLesseeData {
  name: string;
  country: string;
  rating: string;
  stage: "1" | "2" | "3";
  leases: number;
  exposure: string;
  watchlistStatus?: "green" | "amber" | "red" | null;
}

const STAGE_COLOR: Record<"1" | "2" | "3", string> = {
  "1": "#15803D",
  "2": "#B45309",
  "3": "#B91C1C",
};
const STAGE_BG: Record<"1" | "2" | "3", string> = {
  "1": "rgba(21,128,61,0.08)",
  "2": "rgba(180,83,9,0.08)",
  "3": "rgba(185,28,28,0.08)",
};
const WATCHLIST_COLOR: Record<string, string> = {
  green: "#15803D", amber: "#B45309", red: "#B91C1C",
};

export function SimpleLesseePanel({ lessee }: { lessee: SimpleLesseeData }) {
  const stageColor = STAGE_COLOR[lessee.stage];
  const stageBg    = STAGE_BG[lessee.stage];

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
              </div>
              <StatusPill
                stage={lessee.stage}
                label={`Stage ${lessee.stage}`}
              />
              {lessee.watchlistStatus && lessee.watchlistStatus !== "green" && (
                <span style={{
                  padding: "2px 8px", borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 700,
                  background: lessee.watchlistStatus === "red" ? "rgba(185,28,28,0.08)" : "rgba(180,83,9,0.08)",
                  color: WATCHLIST_COLOR[lessee.watchlistStatus],
                }}>
                  {lessee.watchlistStatus === "red" ? "● Watchlist" : "● Monitor"}
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

      {/* Coverage notice */}
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
              Full Intelligence Profile Not Yet Available
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#64748B", lineHeight: 1.6 }}>
              Detailed lessee profiling — behavioural scores, restructuring history, DPD timeline, and scenario modelling — is available for our coverage universe of 80+ airlines. This lessee was uploaded from your portfolio and a full profile has not yet been generated.
            </div>
            <div style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "#3B82F6", fontWeight: 500 }}>
              Contact support to request coverage for {lessee.name}.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
