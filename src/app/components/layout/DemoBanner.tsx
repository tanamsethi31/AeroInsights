import { useState } from "react";
import { useTransitionNavigate as useNavigate } from "../../hooks/useTransitionNavigate";
import { Database, X } from "lucide-react";
import { useData } from "../../contexts/DataContext";

export function DemoBanner() {
  const { hasUpload } = useData();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (hasUpload || dismissed) return null;

  return (
    <div
      style={{
        background: "#002147",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexShrink: 0,
      }}
    >
      <Database size={14} style={{ color: "rgba(255,255,255,0.7)", flexShrink: 0 }} />
      <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.85)", flex: 1 }}>
        You're viewing <strong style={{ color: "#FFFFFF" }}>demo data</strong> — upload your portfolio to see real insights.
      </span>
      <button
        onClick={() => navigate("/onboarding")}
        style={{
          padding: "4px 14px",
          background: "#FFFFFF",
          color: "#002147",
          border: "none",
          borderRadius: "6px",
          fontWeight: 600,
          fontSize: "0.75rem",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Upload now
      </button>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
