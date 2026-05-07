// src/app/components/agent/AgentButton.tsx
import * as React from "react";
import { Zap } from "lucide-react";
import { useAgent } from "../../contexts/AgentContext";
import { isConfigured } from "../../services/agentService";

const PULSE_CSS = `
@keyframes agentPulse {
  0%   { box-shadow: 0 0 0 0px rgba(0, 33, 71, 0.35); }
  70%  { box-shadow: 0 0 0 10px rgba(0, 33, 71, 0); }
  100% { box-shadow: 0 0 0 0px rgba(0, 33, 71, 0); }
}
`;

let styleInjected = false;
function injectPulseStyle() {
  if (styleInjected) return;
  const el = document.createElement("style");
  el.textContent = PULSE_CSS;
  document.head.appendChild(el);
  styleInjected = true;
}

export function AgentButton() {
  const { isOpen, setIsOpen, hasNewSignal } = useAgent();
  const [hovered, setHovered] = React.useState(false);
  const configured = React.useMemo(() => isConfigured(), []);

  React.useEffect(() => {
    injectPulseStyle();
  }, []);

  if (!configured) {
    return (
      <div
        title="Intelligence agent not configured — set VITE_AZURE_OPENAI_AGENT_DEPLOYMENT"
        style={{ position: "relative", display: "inline-flex" }}
      >
        <button
          disabled
          aria-label="Intelligence agent not configured"
          style={{
            height: "34px",
            padding: "0 12px",
            borderRadius: "9999px",
            background: "#94A3B8",
            border: "none",
            cursor: "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            flexShrink: 0,
          }}
        >
          <Zap size={14} color="#FFFFFF" />
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.02em" }}>AI</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Open Aeroinsights Intelligence"
        aria-expanded={isOpen}
        style={{
          height: "34px",
          padding: "0 12px",
          borderRadius: "9999px",
          background: "#002147",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          flexShrink: 0,
          transition: "box-shadow 200ms ease-out",
          boxShadow: isOpen
            ? "inset 0 0 0 2px rgba(255,255,255,0.3)"
            : "none",
          animation: hovered && !isOpen ? "agentPulse 2s ease-out infinite" : "none",
        }}
      >
        <Zap size={14} color="#FFFFFF" />
        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.02em" }}>AI</span>
      </button>

      {/* Notification dot — shown when hasNewSignal is true and panel is closed */}
      {hasNewSignal && !isOpen && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "1px",
            right: "1px",
            width: "10px",
            height: "10px",
            background: "#B91C1C",
            borderRadius: "50%",
            border: "2px solid white",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
