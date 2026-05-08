import { useState } from "react";

/**
 * Renders text in a table cell with inline truncation + More/Less toggle.
 *
 * Usage:
 *   <ExpandableCell text={row.description} />
 *   <ExpandableCell text={row.reason} max={55} />
 *
 * When text is shorter than `max` it renders as-is with no button.
 */
export function ExpandableCell({ text, max = 60 }: { text: string; max?: number }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;
  if (text.length <= max) return <span>{text}</span>;

  return (
    <span>
      {expanded ? text : text.slice(0, max).trimEnd() + "…"}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        style={{
          marginLeft: 5,
          color: "#002147",
          fontSize: "0.75rem",
          fontWeight: 500,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          textDecoration: "underline",
          whiteSpace: "nowrap",
        }}
      >
        {expanded ? "less" : "more"}
      </button>
    </span>
  );
}
