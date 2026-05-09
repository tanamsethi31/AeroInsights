import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  subtitle?: string;
  staggerIndex?: number;
  onClick?: () => void;
}

export function KpiCard({
  label,
  value,
  delta,
  deltaType = "neutral",
  subtitle,
  staggerIndex = 0,
  onClick,
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: staggerIndex * 0.05, ease: [0.23, 1, 0.32, 1] }}
      onClick={onClick}
      style={{
        background: "#FFFFFF",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem 1.5rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        border: "1px solid #E2E8F0",
        borderTop: "3px solid #002147",
        display: "flex",
        flexDirection: "column",
        gap: "0.375rem",
        transition:
          "box-shadow 160ms var(--ease-out-strong), border-color 160ms var(--ease-out-strong), transform 160ms var(--ease-out-strong)",
        cursor: onClick ? "pointer" : "default",
        position: onClick ? "relative" : undefined,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        el.style.borderColor = "#CBD5E1";
        el.style.borderTopColor = "#002147";
        if (onClick) el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
        el.style.borderColor = "#E2E8F0";
        el.style.borderTopColor = "#002147";
        if (onClick) el.style.transform = "translateY(0)";
      }}
      onMouseDown={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
      }}
    >
      {onClick && (
        <div style={{
          position: "absolute", top: "0.875rem", right: "1rem",
          color: "#CBD5E1", transition: "color 160ms ease",
        }}>
          <ArrowUpRight size={14} />
        </div>
      )}
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
    </motion.div>
  );
}
