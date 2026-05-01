import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  subtitle?: string;
  /** For stagger-enter: CSS animation-delay in ms */
  staggerIndex?: number;
}

export function KpiCard({
  label,
  value,
  delta,
  deltaType = "neutral",
  subtitle,
  staggerIndex = 0,
}: KpiCardProps) {
  const deltaColor =
    deltaType === "positive"
      ? "#15803D"
      : deltaType === "negative"
      ? "#B91C1C"
      : "#94A3B8";

  const DeltaIcon =
    deltaType === "positive"
      ? TrendingUp
      : deltaType === "negative"
      ? TrendingDown
      : Minus;

  return (
    <div
      className="stagger-item"
      style={
        {
          background: "#FFFFFF",
          borderRadius: "var(--radius-lg)",
          padding: "1.25rem 1.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          border: "1px solid #E2E8F0",
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
          /* Specific properties only — no transition:all */
          transition:
            "box-shadow 160ms var(--ease-out-strong), border-color 160ms var(--ease-out-strong)",
          cursor: "default",
          "--stagger-delay": `${staggerIndex * 55}ms`,
        } as React.CSSProperties
      }
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        el.style.borderColor = "#CBD5E1";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
        el.style.borderColor = "#E2E8F0";
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          color: "#94A3B8",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.75rem",
          fontWeight: 600,
          color: "#0F172A",
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: "0.8125rem", color: "#475569" }}>{subtitle}</div>
      )}
      {delta && (
        <div
          className="flex items-center gap-1"
          style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            color: deltaColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <DeltaIcon size={12} />
          {delta}
        </div>
      )}
    </div>
  );
}
