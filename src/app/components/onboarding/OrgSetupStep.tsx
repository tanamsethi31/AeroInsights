// src/app/components/onboarding/OrgSetupStep.tsx
import * as React from "react";
import { supabase } from "../../lib/supabase";

const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "SGD", "AED", "CNY", "CAD", "AUD"];
const FLEET_SIZES = ["1–20 aircraft", "20–100 aircraft", "100+ aircraft"];

interface OrgSetupStepProps {
  userId: string;
  onComplete: (orgId: string, role: "admin" | "analyst") => void;
}

export function OrgSetupStep({ userId, onComplete }: OrgSetupStepProps) {
  const [role, setRole] = React.useState<"admin" | "analyst">("admin");
  const [name, setName] = React.useState("");
  const [fleetSize, setFleetSize] = React.useState(FLEET_SIZES[0]);
  const [currency, setCurrency] = React.useState("EUR");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Organisation name is required"); return; }
    setIsLoading(true);
    setError(null);

    try {
      // Atomic org + first-member create via SECURITY DEFINER RPC.
      // Direct inserts are blocked by RLS during onboarding because the
      // caller has no jwt.org_id claim yet — the function bypasses RLS
      // and creates a private workspace tied to this user.
      const { data: newOrgId, error: rpcErr } = await supabase.rpc(
        "create_organisation_with_member",
        {
          p_name:          name.trim(),
          p_base_currency: currency,
          p_user_id:       userId,
          p_role:          role,
        },
      );
      if (rpcErr || !newOrgId) {
        throw new Error(rpcErr?.message ?? "Failed to create organisation");
      }

      onComplete(newOrgId as string, role);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <label style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", color: "#0F172A", marginBottom: "6px" }}>
          Your role
        </label>
        <div style={{ display: "flex", gap: "10px" }}>
          {(["admin", "analyst"] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              style={{
                flex: 1, padding: "12px 10px", textAlign: "left",
                border: `1.5px solid ${role === r ? "#002147" : "#E2E8F0"}`,
                borderRadius: "8px",
                background: role === r ? "rgba(0,33,71,0.04)" : "#FFFFFF",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>
                {r === "admin" ? "Setting up for my firm" : "Joining an existing team"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                {r === "admin"
                  ? "Create org, invite team, manage settings"
                  : "Analyse portfolios, run scenarios, review reports"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", color: "#0F172A", marginBottom: "6px" }}>
          Organisation name <span style={{ color: "#B91C1C" }}>*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Skybridge Capital Leasing"
          style={{
            width: "100%", padding: "10px 14px", border: "1px solid #E2E8F0",
            borderRadius: "8px", fontSize: "0.9375rem", color: "#0F172A",
            outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box",
          }}
        />
      </div>

      <div>
        <label style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", color: "#0F172A", marginBottom: "6px" }}>
          Fleet size
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          {FLEET_SIZES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFleetSize(s)}
              style={{
                flex: 1, padding: "10px 8px",
                border: `1.5px solid ${fleetSize === s ? "#002147" : "#E2E8F0"}`,
                borderRadius: "8px",
                background: fleetSize === s ? "rgba(0,33,71,0.04)" : "#FFFFFF",
                fontWeight: fleetSize === s ? 600 : 400,
                fontSize: "0.8125rem", color: "#0F172A", cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", color: "#0F172A", marginBottom: "6px" }}>
          Base currency
        </label>
        <select
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", border: "1px solid #E2E8F0",
            borderRadius: "8px", fontSize: "0.9375rem", color: "#0F172A",
            background: "#FFFFFF", cursor: "pointer",
          }}
        >
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "10px 14px", fontSize: "0.8125rem", color: "#B91C1C" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        style={{
          padding: "12px 24px", background: isLoading ? "#CBD5E1" : "#002147",
          color: "#FFFFFF", border: "none", borderRadius: "8px",
          fontWeight: 700, fontSize: "0.9375rem",
          cursor: isLoading ? "not-allowed" : "pointer", alignSelf: "flex-end",
        }}
      >
        {isLoading ? "Creating…" : "Continue →"}
      </button>
    </form>
  );
}
