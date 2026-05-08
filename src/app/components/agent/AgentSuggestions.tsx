// src/app/components/agent/AgentSuggestions.tsx
import * as React from "react";

interface AgentSuggestionsProps {
  pathname: string;
  onSelect: (text: string) => void;
}

const ROUTE_CHIPS: Record<string, string[]> = {
  "/": [
    "What needs attention today?",
    "Summarise my ECL position",
    "Any new signals affecting my book?",
    "Which lessees are most exposed to fuel?",
  ],
  "/counterparties": [
    "Which lessees are Red this week?",
    "Compare my Stage 3 lessees",
    "What are my options for IndiGo?",
    "Show worst fuel-cost exposures",
  ],
  "/scenarios/run": [
    "What market inputs should I use today?",
    "Pre-populate from current market data",
    "Explain the drivers of my last run",
    "Which lessees drive the most ECL variance?",
  ],
  "/intelligence": [
    "Which signal has the biggest ECL impact?",
    "Summarise this week's deal feed",
    "What does the India GDP revision mean for me?",
    "Any jurisdiction risks I should act on?",
  ],
  "/risk-ecl": [
    "Why did three leases migrate to Stage 2?",
    "What is driving my ECL increase?",
    "Which lessee has the highest LGD?",
    "Generate an auditor summary of this quarter",
  ],
};

const DEFAULT_CHIPS = [
  "What needs attention today?",
  "Summarise my ECL position",
  "Any new signals affecting my book?",
  "Open Aero Intelligence",
];

function getChips(pathname: string): string[] {
  if (ROUTE_CHIPS[pathname]) return ROUTE_CHIPS[pathname];
  for (const [key, chips] of Object.entries(ROUTE_CHIPS)) {
    if (key !== "/" && pathname.startsWith(key)) return chips;
  }
  return DEFAULT_CHIPS;
}

export function AgentSuggestions({ pathname, onSelect }: AgentSuggestionsProps) {
  const chips = getChips(pathname);

  return (
    <div
      style={{
        padding: "12px 12px 0",
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#002147";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,33,71,0.10)";
            (e.currentTarget as HTMLButtonElement).style.color = "#002147";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,33,71,0.22)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,33,71,0.05)";
            (e.currentTarget as HTMLButtonElement).style.color = "#002147";
          }}
          style={{
            padding: "6px 12px",
            background: "rgba(0,33,71,0.05)",
            border: "1px solid rgba(0,33,71,0.22)",
            borderRadius: "20px",
            fontSize: "0.8125rem",
            color: "#002147",
            cursor: "pointer",
            lineHeight: 1.4,
            transition: "border-color 150ms ease, background 150ms ease",
          }}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
