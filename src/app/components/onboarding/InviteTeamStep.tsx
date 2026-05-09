// src/app/components/onboarding/InviteTeamStep.tsx
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

interface InviteTeamStepProps {
  onContinue: () => void;
  onSkip: () => void;
}

export function InviteTeamStep({ onContinue, onSkip }: InviteTeamStepProps) {
  const [emails, setEmails] = React.useState<string[]>([""]);

  function addEmail() { setEmails(prev => [...prev, ""]); }
  function updateEmail(i: number, v: string) { setEmails(prev => prev.map((e, idx) => idx === i ? v : e)); }
  function removeEmail(i: number) { setEmails(prev => prev.filter((_, idx) => idx !== i)); }

  const validCount = emails.filter(e => e.trim().includes("@")).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "#475569" }}>
        Add team members who should have access. They'll receive an invite link via email. You can also do this later from Settings.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {emails.map((email, i) => (
          <div key={i} style={{ display: "flex", gap: "8px" }}>
            <input
              type="email"
              value={email}
              placeholder="colleague@lessor.com"
              onChange={e => updateEmail(i, e.target.value)}
              style={{
                flex: 1, padding: "10px 14px", border: "1px solid #E2E8F0",
                borderRadius: "8px", fontSize: "0.875rem", color: "#0F172A",
                outline: "none", fontFamily: "'Inter', sans-serif",
              }}
            />
            {emails.length > 1 && (
              <button
                onClick={() => removeEmail(i)}
                style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "8px", cursor: "pointer", color: "#94A3B8", padding: "0 12px", display: "flex", alignItems: "center" }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addEmail}
          style={{
            display: "flex", alignItems: "center", gap: "6px", background: "none",
            border: "1px dashed #CBD5E1", borderRadius: "8px", padding: "9px 14px",
            cursor: "pointer", color: "#64748B", fontSize: "0.875rem", width: "100%",
          }}
        >
          <Plus size={14} /> Add another
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
        <button
          onClick={onSkip}
          style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "0.875rem", cursor: "pointer", padding: "4px 0" }}
        >
          Skip for now
        </button>
        <button
          onClick={onContinue}
          disabled={validCount === 0}
          style={{
            padding: "10px 24px",
            background: validCount === 0 ? "#CBD5E1" : "#002147",
            color: "#FFFFFF", border: "none", borderRadius: "8px",
            fontWeight: 600, fontSize: "0.875rem",
            cursor: validCount === 0 ? "not-allowed" : "pointer",
          }}
        >
          Send Invites & Continue →
        </button>
      </div>
    </div>
  );
}
