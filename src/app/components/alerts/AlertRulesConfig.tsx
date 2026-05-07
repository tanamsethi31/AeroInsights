// src/app/components/alerts/AlertRulesConfig.tsx
import * as React from "react";
import { X } from "lucide-react";
import { getAlertRules, updateAlertRule } from "../../services/alertService";
import type { AlertRuleConfig } from "../../data/alertsData";

interface AlertRulesConfigProps {
  onClose: () => void;
}

export function AlertRulesConfig({ onClose }: AlertRulesConfigProps) {
  const [rules, setRules] = React.useState<AlertRuleConfig[]>(getAlertRules);

  function handleToggle(id: string, enabled: boolean) {
    updateAlertRule(id, { isEnabled: enabled });
    setRules(getAlertRules());
  }

  function handleThresholdChange(id: string, key: string, raw: string) {
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    updateAlertRule(id, { threshold: { ...rules.find((r) => r.id === id)?.threshold, [key]: num } });
    setRules(getAlertRules());
  }

  function numericThresholdEntry(rule: AlertRuleConfig): [string, number] | null {
    const entries = Object.entries(rule.threshold).filter(([, v]) => typeof v === "number");
    if (entries.length === 0) return null;
    return entries[0] as [string, number];
  }

  const THRESHOLD_LABELS: Record<string, string> = {
    maxEclUsd: "Max ECL (USD)",
    maxRiskScore: "Max Risk Score",
    fuelDeltaPct: "Fuel Delta %",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          width: "520px",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0F172A" }}>
              Alert Rules
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
              Configure which conditions trigger notifications
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Rule list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {rules.map((rule) => {
            const numEntry = numericThresholdEntry(rule);
            return (
              <div
                key={rule.id}
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #F1F5F9",
                  opacity: rule.isEnabled ? 1 : 0.5,
                  transition: "opacity 150ms",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  {/* Toggle */}
                  <label
                    style={{ display: "flex", alignItems: "center", cursor: "pointer", marginTop: "1px", flexShrink: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={rule.isEnabled}
                      onChange={(e) => handleToggle(rule.id, e.target.checked)}
                      style={{ display: "none" }}
                    />
                    <div
                      style={{
                        width: "36px",
                        height: "20px",
                        borderRadius: "10px",
                        background: rule.isEnabled ? "#002147" : "#CBD5E1",
                        position: "relative",
                        transition: "background 200ms",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: rule.isEnabled ? "18px" : "2px",
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "#FFFFFF",
                          transition: "left 200ms",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      />
                    </div>
                  </label>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>
                      {rule.label}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px", lineHeight: 1.4 }}>
                      {rule.description}
                    </div>

                    {/* Numeric threshold input */}
                    {numEntry && rule.isEnabled && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                        <label
                          style={{ fontSize: "0.75rem", color: "#475569", whiteSpace: "nowrap" }}
                        >
                          {THRESHOLD_LABELS[numEntry[0]] ?? numEntry[0]}:
                        </label>
                        <input
                          type="number"
                          defaultValue={numEntry[1]}
                          onBlur={(e) => handleThresholdChange(rule.id, numEntry[0], e.target.value)}
                          style={{
                            width: "120px",
                            padding: "4px 8px",
                            border: "1px solid #E2E8F0",
                            borderRadius: "6px",
                            fontSize: "0.8125rem",
                            color: "#0F172A",
                            outline: "none",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              background: "#002147",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
