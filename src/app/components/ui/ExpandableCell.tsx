import { useState } from "react";

/**
 * Renders text in a table cell with an inline toggle.
 *
 * Modes:
 *   fullyCollapsed (default) — nothing shown at all; user clicks "show" to reveal.
 *   truncate                 — shows first `max` chars then "more" / "less".
 *
 * Usage:
 *   <ExpandableCell text={row.description} />               ← fully collapsed
 *   <ExpandableCell text={row.reason} truncate max={55} />  ← truncation mode
 */
export function ExpandableCell({
  text,
  max = 60,
  truncate = false,
}: {
  text: string;
  max?: number;
  truncate?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const btnStyle: React.CSSProperties = {
    color: "#002147",
    fontSize: "0.75rem",
    fontWeight: 500,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
    whiteSpace: "nowrap",
  };

  /* ── Fully-collapsed mode (default) ─────────────────────── */
  if (!truncate) {
    return (
      <span>
        {expanded && (
          <span style={{ marginRight: 6, color: "#475569", fontSize: "0.8125rem" }}>
            {text}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          style={btnStyle}
        >
          {expanded ? "hide" : "show"}
        </button>
      </span>
    );
  }

  /* ── Truncation mode ─────────────────────────────────────── */
  if (text.length <= max) return <span>{text}</span>;

  return (
    <span>
      {expanded ? text : text.slice(0, max).trimEnd() + "…"}
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        style={{ ...btnStyle, marginLeft: 5 }}
      >
        {expanded ? "less" : "more"}
      </button>
    </span>
  );
}
