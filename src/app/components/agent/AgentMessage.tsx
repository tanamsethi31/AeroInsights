// src/app/components/agent/AgentMessage.tsx
import * as React from "react";
import { useNavigate } from "react-router";
import { useAgent } from "../../contexts/AgentContext";

export interface ActionCard {
  path: string;
  params?: Record<string, number>;
}

interface AgentMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  actionCard?: ActionCard;
  toolIndicator?: string;
}

// ─── Markdown table detection ───────────────────────────────────────────────────

function isTableLine(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isSeparatorLine(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTable(lines: string[]): { headers: string[]; rows: string[][] } {
  const headers = lines[0]
    .trim()
    .slice(1, -1)
    .split("|")
    .map((h) => h.trim());
  const rows = lines
    .slice(2)
    .filter((l) => isTableLine(l))
    .map((l) => {
      const cells = l
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      while (cells.length < headers.length) cells.push("");
      return cells;
    });
  return { headers, rows };
}

// ─── Navigation link parser ─────────────────────────────────────────────────────
// Syntax: [[Label|/path]]

function parseNavLinks(
  text: string,
  navigate: (path: string) => void
): React.ReactNode[] {
  const parts = text.split(/(\[\[.+?\|.+?\]\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[\[(.+?)\|(.+?)\]\]$/);
    if (match) {
      const [, label, path] = match;
      return (
        <span
          key={i}
          onClick={() => navigate(path)}
          style={{
            color: "#002147",
            textDecoration: "underline",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Content renderer ───────────────────────────────────────────────────────────

function RenderContent({ content }: { content: string }) {
  const navigate = useNavigate();
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Markdown table
    if (isTableLine(line) && i + 1 < lines.length && isSeparatorLine(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableLine(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      const { headers, rows } = parseTable(tableLines);
      nodes.push(
        <div key={`table-${i}`} style={{ overflowX: "auto", margin: "8px 0" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                {headers.map((h, hi) => (
                  <th
                    key={hi}
                    style={{
                      padding: "6px 10px",
                      textAlign: "left",
                      borderBottom: "2px solid #E2E8F0",
                      color: "#475569",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{ padding: "6px 10px", color: "#0F172A", fontSize: "0.8125rem" }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      nodes.push(<div key={`blank-${i}`} style={{ height: "6px" }} />);
      i++;
      continue;
    }

    // Bullet
    if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
      nodes.push(
        <div
          key={`bullet-${i}`}
          style={{ display: "flex", gap: "6px", margin: "2px 0" }}
        >
          <span style={{ color: "#94A3B8", flexShrink: 0, marginTop: "1px" }}>•</span>
          <span>{parseNavLinks(line.replace(/^[-•]\s/, ""), navigate)}</span>
        </div>
      );
      i++;
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={`p-${i}`} style={{ margin: "2px 0", lineHeight: 1.55 }}>
        {parseNavLinks(line, navigate)}
      </p>
    );
    i++;
  }

  return <>{nodes}</>;
}

// ─── Action confirmation card ───────────────────────────────────────────────────

const PATH_LABELS: Record<string, string> = {
  "/scenarios/run": "Custom Builder",
  "/risk-ecl": "Risk & ECL",
  "/risk-ecl/summary": "ECL Overview",
  "/counterparties": "Counterparties",
  "/intelligence": "Aero Intelligence",
  "/portfolio": "Portfolio",
  "/deals/generator": "Lease Generator",
};

const PARAM_LABELS: Record<string, string> = {
  gdpDelta: "GDP Delta",
  rpkDelta: "RPK Delta",
  fuelDelta: "Fuel Delta",
  fxDelta: "FX Delta",
  rateDelta: "Rate Delta",
  assetValueDelta: "Asset Value Delta",
  pdS2Multi: "PD S2 Multiplier",
  pdS3Multi: "PD S3 Multiplier",
};

function ActionConfirmCard({
  card,
  onConfirm,
  onCancel,
}: {
  card: ActionCard;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const pageLabel =
    Object.entries(PATH_LABELS).find(([k]) => card.path.startsWith(k))?.[1] ??
    card.path;

  const isMultiplier = (key: string) => key === "pdS2Multi" || key === "pdS3Multi";

  function formatValue(key: string, val: number): string {
    if (isMultiplier(key)) return `×${val.toFixed(2)}`;
    return val > 0 ? `+${(val * 100).toFixed(1)}%` : `${(val * 100).toFixed(1)}%`;
  }

  return (
    <div
      style={{
        background: "rgba(0,33,71,0.04)",
        border: "1px solid rgba(0,33,71,0.15)",
        borderLeft: "3px solid #002147",
        borderRadius: "8px",
        padding: "12px 14px",
        marginTop: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "10px",
        }}
      >
        <span style={{ fontSize: "0.875rem" }}>⚡</span>
        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>
          Ready to open {pageLabel}
        </span>
      </div>

      {card.params && Object.keys(card.params).length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          {Object.entries(card.params).map(([key, val]) => (
            <div
              key={key}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "8px",
                padding: "4px 0",
                borderBottom: "1px solid rgba(0,33,71,0.07)",
                fontSize: "0.8125rem",
              }}
            >
              <span style={{ color: "#475569" }}>{PARAM_LABELS[key] ?? key}</span>
              <span style={{ fontWeight: 600, color: "#0F172A" }}>
                {formatValue(key, val)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onConfirm}
          style={{
            flex: 1,
            padding: "7px 12px",
            background: "#002147",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Open and pre-fill
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "7px 12px",
            background: "transparent",
            color: "#475569",
            border: "1px solid #E2E8F0",
            borderRadius: "6px",
            fontSize: "0.8125rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function AgentMessage({
  role,
  content,
  isStreaming,
  actionCard,
  toolIndicator,
}: AgentMessageProps) {
  const navigate = useNavigate();
  const { setPendingInputs } = useAgent();
  const [actionDismissed, setActionDismissed] = React.useState(false);

  const isUser = role === "user";

  function handleConfirm(card: ActionCard) {
    if (card.params && Object.keys(card.params).length > 0) {
      setPendingInputs(card.params);
    }
    navigate(card.path);
    setActionDismissed(true);
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: "12px",
        padding: "0 12px",
      }}
    >
      <div
        style={{
          maxWidth: isUser ? "80%" : "92%",
          background: isUser ? "#002147" : "#FFFFFF",
          color: isUser ? "#FFFFFF" : "#0F172A",
          borderRadius: isUser ? "18px 18px 4px 18px" : "0 18px 18px 18px",
          borderLeft: isUser ? undefined : "2px solid #002147",
          padding: "10px 14px",
          fontSize: "0.875rem",
          lineHeight: 1.5,
        }}
      >
        {toolIndicator && (
          <p
            style={{
              fontSize: "0.75rem",
              fontStyle: "italic",
              color: "#94A3B8",
              margin: "0 0 6px 0",
            }}
          >
            {toolIndicator}
          </p>
        )}

        <RenderContent content={content} />

        {isStreaming && (
          <span
            style={{
              display: "inline-block",
              width: "6px",
              height: "14px",
              background: "#002147",
              marginLeft: "2px",
              verticalAlign: "middle",
              animation: "blink 1s step-end infinite",
            }}
          />
        )}

        {actionCard && !actionDismissed && (
          <ActionConfirmCard
            card={actionCard}
            onConfirm={() => handleConfirm(actionCard)}
            onCancel={() => setActionDismissed(true)}
          />
        )}
      </div>
    </div>
  );
}
