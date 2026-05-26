// src/app/components/settings/AlertRulesPanel.tsx
//
// T-5.1 — CRUD for alert_rules + recent send history.

import { useState } from "react";
import { Bell, Trash2, Mail, AlertTriangle, Check } from "lucide-react";
import { useAlertRules, type AlertKind, type AlertRule } from "../../hooks/useAlertRules";

const KIND_LABEL: Record<AlertKind, string> = {
  dpd_breach:      "DPD breach",
  stage_downgrade: "Stage downgrade",
  watchlist_red:   "Watchlist RED",
  sanctions_hit:   "Sanctions hit",
};

function ThresholdEditor({
  kind, value, onChange,
}: {
  kind: AlertKind;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  if (kind === "dpd_breach") {
    return (
      <input
        type="number" min={1}
        value={Number(value.days ?? 30)}
        onChange={(e) => onChange({ days: Number(e.target.value) })}
        style={inputStyle}
        placeholder="days"
      />
    );
  }
  if (kind === "stage_downgrade") {
    return (
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <select value={value.from as number | undefined ?? ""} onChange={(e) => onChange({ ...value, from: e.target.value ? Number(e.target.value) : undefined })} style={inputStyle}>
          <option value="">any</option><option value="1">S1</option><option value="2">S2</option>
        </select>
        <span style={{ alignSelf: "center", color: "#64748B" }}>→</span>
        <select value={value.to as number | undefined ?? ""} onChange={(e) => onChange({ ...value, to: e.target.value ? Number(e.target.value) : undefined })} style={inputStyle}>
          <option value="">any</option><option value="2">S2</option><option value="3">S3</option>
        </select>
      </div>
    );
  }
  return <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>—</span>;
}

const inputStyle: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: "0.375rem",
  padding: "0.375rem 0.625rem", fontSize: "0.8125rem",
  color: "#0F172A", outline: "none", minWidth: "80px",
};

export function AlertRulesPanel() {
  const { rules, sends, loading, error, createRule, updateRule, deleteRule } = useAlertRules();
  const [draftName, setDraftName] = useState("");
  const [draftKind, setDraftKind] = useState<AlertKind>("dpd_breach");
  const [draftThreshold, setDraftThreshold] = useState<Record<string, unknown>>({ days: 30 });
  const [draftRecipients, setDraftRecipients] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!draftName.trim() || !draftRecipients.trim()) return;
    setCreating(true);
    try {
      const recipients = draftRecipients.split(",").map((r) => r.trim()).filter(Boolean);
      await createRule({ name: draftName.trim(), kind: draftKind, threshold: draftThreshold, recipients });
      setDraftName(""); setDraftRecipients("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header strip */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
        <Bell size={14} />
        <span>
          Cron evaluates rules every 30 minutes. Recipients are emailed when a
          rule fires outside its cooldown window. Every send is recorded in
          alert_sends.
        </span>
      </div>

      {/* Existing rules table */}
      {loading && <div style={{ color: "#94A3B8", fontSize: "0.875rem" }}>Loading…</div>}
      {error   && <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.8125rem" }}>{error}</div>}

      {rules.length === 0 ? (
        <div style={{ fontSize: "0.8125rem", color: "#64748B" }}>
          No rules configured yet. Use the form below to add one.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", border: "1px solid #E2E8F0", borderRadius: "0.5rem" }}>
          <thead>
            <tr style={{ background: "#F4F5F7" }}>
              {["Name", "Kind", "Threshold", "Recipients", "Cooldown", "Enabled", ""].map(h => (
                <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r: AlertRule) => (
              <tr key={r.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                <td style={{ padding: "0.625rem 0.75rem", fontWeight: 600, color: "#0F172A" }}>{r.name}</td>
                <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>{KIND_LABEL[r.kind]}</td>
                <td style={{ padding: "0.625rem 0.75rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>
                  {JSON.stringify(r.threshold)}
                </td>
                <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>
                  {r.recipients.join(", ")}
                </td>
                <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>
                  {r.cooldownMinutes} min
                </td>
                <td style={{ padding: "0.625rem 0.75rem" }}>
                  <button
                    onClick={() => updateRule(r.id, { enabled: !r.enabled })}
                    style={{
                      background: r.enabled ? "#DCFCE7" : "#F1F5F9",
                      color:      r.enabled ? "#15803D" : "#64748B",
                      border: "none", borderRadius: "9999px",
                      padding: "0.2rem 0.625rem",
                      fontSize: "0.7rem", fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {r.enabled ? "ON" : "OFF"}
                  </button>
                </td>
                <td style={{ padding: "0.625rem 0.75rem" }}>
                  <button
                    onClick={() => deleteRule(r.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
                    title="Delete rule"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* New-rule form */}
      <div style={{
        background: "#F8FAFC", border: "1px solid #E2E8F0",
        borderRadius: "0.5rem", padding: "1rem",
        display: "flex", flexDirection: "column", gap: "0.625rem",
      }}>
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>Add rule</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.625rem" }}>
          <input
            placeholder="Rule name" value={draftName}
            onChange={(e) => setDraftName(e.target.value)} style={inputStyle}
          />
          <select value={draftKind} onChange={(e) => {
            const k = e.target.value as AlertKind;
            setDraftKind(k);
            setDraftThreshold(k === "dpd_breach" ? { days: 30 } : {});
          }} style={inputStyle}>
            <option value="dpd_breach">DPD breach</option>
            <option value="stage_downgrade">Stage downgrade</option>
            <option value="watchlist_red">Watchlist RED</option>
            <option value="sanctions_hit">Sanctions hit</option>
          </select>
          <ThresholdEditor kind={draftKind} value={draftThreshold} onChange={setDraftThreshold} />
        </div>
        <input
          placeholder="Recipients (comma separated emails)"
          value={draftRecipients}
          onChange={(e) => setDraftRecipients(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={handleCreate}
          disabled={creating || !draftName.trim() || !draftRecipients.trim()}
          style={{
            alignSelf: "flex-start",
            background: "#002147", color: "#FFFFFF",
            border: "none", borderRadius: "9999px",
            padding: "0.5rem 1.25rem", fontSize: "0.8125rem", fontWeight: 600,
            cursor: creating ? "wait" : "pointer",
            opacity: !draftName.trim() || !draftRecipients.trim() ? 0.5 : 1,
          }}
        >
          {creating ? "Saving…" : "Create rule"}
        </button>
      </div>

      {/* Recent sends */}
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A", marginBottom: "0.5rem" }}>
          Recent sends
        </div>
        {sends.length === 0 ? (
          <div style={{ fontSize: "0.8125rem", color: "#94A3B8" }}>
            No alerts dispatched yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
            {sends.slice(0, 15).map((s, i) => {
              const Icon = s.status === "sent" ? Check : s.status === "failed" ? AlertTriangle : Mail;
              const color = s.status === "sent" ? "#15803D" : s.status === "failed" ? "#B91C1C" : "#64748B";
              return (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: "0.75rem", alignItems: "center", padding: "0.5rem 0.875rem", borderTop: i === 0 ? "none" : "1px solid #F1F5F9", fontSize: "0.8125rem", background: "#FFFFFF" }}>
                  <Icon size={13} style={{ color }} />
                  <div>
                    <div style={{ fontWeight: 600, color: "#0F172A" }}>{s.entityLabel ?? s.entityId ?? "—"}</div>
                    <div style={{ fontSize: "0.7rem", color: "#94A3B8" }}>{s.recipient}</div>
                  </div>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color, textTransform: "uppercase" }}>{s.status.replace("_", " ")}</span>
                  <span style={{ color: "#94A3B8", fontSize: "0.7rem" }}>{new Date(s.sentAt).toLocaleString("en-GB")}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
