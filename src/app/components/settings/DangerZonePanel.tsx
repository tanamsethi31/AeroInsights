// src/app/components/settings/DangerZonePanel.tsx
// T-6.5 — Tenant offboarding UI. Double-confirm modal hits
// /api/admin/delete-org.

import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useData } from "../../contexts/DataContext";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export function DangerZonePanel() {
  const { user, getAccessTokenSilently } = useAuth0();
  const { orgId } = useData();
  const [orgName, setOrgName]   = useState<string | null>(null);
  const [role,    setRole]      = useState<string | null>(null);
  const [open,    setOpen]      = useState(false);
  const [confirm, setConfirm]   = useState("");
  const [busy,    setBusy]      = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  // Lazy fetch on first render of the card.
  if (orgId && orgName === null) {
    void (async () => {
      const [{ data: org }, { data: member }] = await Promise.all([
        supabase.from("organisations").select("name").eq("id", orgId).maybeSingle(),
        supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", user?.sub ?? "").maybeSingle(),
      ]);
      setOrgName(org?.name ?? "(unknown)");
      setRole(member?.role ?? null);
    })();
  }

  const isAdmin = role === "admin";

  async function handleDelete() {
    if (!orgId || !orgName) return;
    setBusy(true); setError(null);
    try {
      const token = await getAccessTokenSilently();
      const res = await fetch(`${API_BASE.replace(/\/$/, "")}/admin/delete-org`, {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ org_id: orgId, confirm_name: confirm.trim() }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: `HTTP_${res.status}` }));
        setError((e as { error?: string }).error ?? "unknown_error");
        setBusy(false);
        return;
      }
      // Success — sign out + redirect home. The org no longer exists.
      window.location.href = "/login";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "0.875rem",
    }}>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: "0.75rem",
        padding: "1rem 1.25rem",
        background: "#FEF2F2", border: "1px solid #FECACA",
        borderRadius: "0.5rem",
      }}>
        <AlertTriangle size={16} style={{ color: "#B91C1C", flexShrink: 0, marginTop: "0.125rem" }} />
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#B91C1C", marginBottom: "0.25rem" }}>
            Delete this organisation permanently
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#7F1D1D", lineHeight: 1.55 }}>
            Removes every row in this tenant: portfolios, leases, lessees, assets,
            provisions, scenario runs, audit log, reports, schedules, alert rules,
            watchlist entries, news signals, FX-overrides — and purges the
            <strong> reports/</strong> Storage prefix. The action is recorded in
            <strong> org_deletion_log</strong> for compliance.
            <br /><br />
            <strong>Irreversible.</strong> The data cannot be recovered.
            {!isAdmin && <><br /><br /><em>Only org admins can run this.</em></>}
          </div>
        </div>
      </div>

      <button
        disabled={!isAdmin || !orgId}
        onClick={() => { setConfirm(""); setError(null); setOpen(true); }}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex", alignItems: "center", gap: "0.45rem",
          padding: "0.55rem 1.25rem",
          background: isAdmin ? "#B91C1C" : "#F1F5F9",
          color:      isAdmin ? "#FFFFFF" : "#94A3B8",
          border: "none", borderRadius: "9999px",
          fontSize: "0.8125rem", fontWeight: 600,
          cursor: isAdmin ? "pointer" : "not-allowed",
        }}
      >
        <Trash2 size={13} />
        Delete organisation
      </button>

      {open && orgName && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem",
        }}>
          <div style={{
            background: "#FFFFFF", borderRadius: "0.75rem",
            maxWidth: "480px", width: "100%", padding: "1.5rem",
            boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
            display: "flex", flexDirection: "column", gap: "1rem",
          }}>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#B91C1C" }}>
              Final confirmation
            </div>
            <div style={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.55 }}>
              To proceed, type the organisation name exactly as it appears:
              <br />
              <code style={{ background: "#F1F5F9", padding: "0.15rem 0.4rem", borderRadius: "0.25rem", fontFamily: "monospace", color: "#0F172A" }}>
                {orgName}
              </code>
            </div>
            <input
              autoFocus
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={orgName}
              style={{
                border: "1px solid #E2E8F0", borderRadius: "0.375rem",
                padding: "0.55rem 0.75rem", fontSize: "0.875rem",
                outline: "none",
              }}
            />
            {error && (
              <div style={{ background: "#FEE2E2", color: "#B91C1C", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", fontSize: "0.8125rem" }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{
                  background: "transparent", border: "1px solid #E2E8F0",
                  borderRadius: "9999px", padding: "0.5rem 1.25rem",
                  fontSize: "0.8125rem", color: "#475569", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={busy || confirm.trim().toLowerCase() !== orgName.trim().toLowerCase()}
                style={{
                  background: confirm.trim().toLowerCase() === orgName.trim().toLowerCase() && !busy ? "#B91C1C" : "#F1F5F9",
                  color:      confirm.trim().toLowerCase() === orgName.trim().toLowerCase() && !busy ? "#FFFFFF" : "#94A3B8",
                  border: "none", borderRadius: "9999px",
                  padding: "0.5rem 1.25rem", fontSize: "0.8125rem", fontWeight: 600,
                  cursor: busy ? "wait" : (confirm.trim().toLowerCase() === orgName.trim().toLowerCase() ? "pointer" : "not-allowed"),
                }}
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
