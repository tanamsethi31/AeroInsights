import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { MRHealthSummary } from "../../lib/portfolioAdapters";

interface Props {
  summary: MRHealthSummary;
  staggerIndex?: number;
  onClick?: () => void;
}

function FlagDot({ colour }: { colour: string }) {
  return (
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: colour, flexShrink: 0 }} />
  );
}

export function MRHealthCard({ summary, staggerIndex = 0, onClick }: Props) {
  const { redCount, amberCount, greenCount, worstOffenders } = summary;
  const allClear = redCount === 0 && amberCount === 0;

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
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 160ms var(--ease-out-strong), border-color 160ms var(--ease-out-strong), transform 160ms var(--ease-out-strong)",
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        el.style.borderColor = "#CBD5E1";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
        el.style.borderColor = "#E2E8F0";
        el.style.transform = "translateY(0)";
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
        <h3 style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.82)", margin: 0, lineHeight: 1.3, letterSpacing: "0.01em" }}>
          MR Adequacy
        </h3>
        {onClick && (
          <ArrowUpRight size={13} style={{ color: "rgba(255,255,255,0.5)", flexShrink: 0 }} />
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "1rem 1.25rem 1.125rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {allClear ? (
          <div style={{ fontSize: "0.9375rem", fontWeight: 500, color: "#15803D" }}>All leases on track</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "1.25rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <FlagDot colour="#B91C1C" />
                <span style={{ color: "#B91C1C" }}>{redCount}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <FlagDot colour="#B45309" />
                <span style={{ color: "#B45309" }}>{amberCount}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <FlagDot colour="#15803D" />
                <span style={{ color: "#15803D" }}>{greenCount}</span>
              </div>
            </div>

            {worstOffenders.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {worstOffenders.map((o) => {
                  const colour = o.flag === "red" ? "#B91C1C" : "#B45309";
                  const shortfallM = (o.eolShortfall / 1_000_000).toFixed(1);
                  return (
                    <div key={o.leaseId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: "#0F172A", fontSize: "0.8125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {o.lessee}
                        </span>
                        <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>·</span>
                        <span style={{ fontFamily: "monospace", color: "#475569", fontSize: "0.75rem" }}>{o.msn}</span>
                      </div>
                      <span style={{ color: colour, fontWeight: 600, fontSize: "0.8125rem", flexShrink: 0 }}>
                        -${shortfallM}m
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
