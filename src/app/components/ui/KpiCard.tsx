import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

export function ScenarioKpiCard({
  label, value, color, bg, note,
}: { label: string; value: string; color: string; bg: string; note?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      style={{
        background: bg, borderRadius: "0.5rem",
        padding: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem",
      }}
    >
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.375rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {note && <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{note}</div>}
    </motion.div>
  );
}

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
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        border: "1px solid #E2E8F0",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition:
          "box-shadow 160ms var(--ease-out-strong), border-color 160ms var(--ease-out-strong), transform 160ms var(--ease-out-strong)",
        cursor: onClick ? "pointer" : "default",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        el.style.borderColor = "#CBD5E1";
        if (onClick) el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
        el.style.borderColor = "#E2E8F0";
        if (onClick) el.style.transform = "translateY(0)";
      }}
      onMouseDown={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
      }}
    >
      {/* Navy header — mirrors Card blueHeader */}
      <div
        style={{
          background: "#002147",
          padding: "0.4375rem 1.125rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "rgba(255,255,255,0.82)",
            margin: 0,
            lineHeight: 1.3,
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </h3>
        {onClick && (
          <ArrowUpRight
            size={13}
            style={{ color: "rgba(255,255,255,0.5)", flexShrink: 0 }}
          />
        )}
      </div>

      {/* Body */}
      <div
        style={{
          padding: "1rem 1.25rem 1.125rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
        }}
      >
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
    </motion.div>
  );
}
