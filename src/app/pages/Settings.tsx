import { useState } from "react";
import { useSortable, sortIcon, sortIconStyle } from "../components/ui/useSortable";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { Building2, Users, Database, Sliders, ClipboardList, Save, Plus, Trash2, Eye, EyeOff, Check } from "lucide-react";

const tabs = [
  { id: "tenant", label: "Tenant", icon: Building2 },
  { id: "users", label: "Users & RBAC", icon: Users },
  { id: "datasources", label: "Data Sources", icon: Database },
  { id: "model", label: "Model Params", icon: Sliders },
  { id: "audit", label: "Audit Log", icon: ClipboardList },
];

const users = [
  { id: "USR-001", name: "John Williams", email: "john@aerinsights.com", role: "Admin", mfa: true, lastLogin: "29 Apr 2026, 09:05", status: "active" },
  { id: "USR-002", name: "Alex Johnson", email: "alex@aerinsights.com", role: "Risk Analyst", mfa: true, lastLogin: "29 Apr 2026, 08:47", status: "active" },
  { id: "USR-003", name: "Sarah Chen", email: "sarah@aerinsights.com", role: "Accounting", mfa: true, lastLogin: "28 Apr 2026, 17:22", status: "active" },
  { id: "USR-004", name: "Marcus Webb", email: "marcus@aerinsights.com", role: "Read-Only", mfa: false, lastLogin: "25 Apr 2026, 11:14", status: "active" },
  { id: "USR-005", name: "Priya Nair", email: "priya@aerinsights.com", role: "Risk Analyst", mfa: true, lastLogin: "27 Apr 2026, 14:30", status: "inactive" },
];

const dataSources = [
  { id: "DS-001", name: "Portfolio CSV Upload", type: "CSV", lastRefresh: "29 Apr 2026, 08:00", status: "ok", records: 173 },
  { id: "DS-002", name: "Lessee Payment History", type: "XLSX", lastRefresh: "28 Apr 2026, 18:00", status: "ok", records: 2840 },
  { id: "DS-003", name: "Aircraft Market Values (Heuristic)", type: "Internal", lastRefresh: "29 Apr 2026, 06:00", status: "ok", records: 173 },
  { id: "DS-004", name: "AWG CTC Index", type: "API", lastRefresh: "01 Apr 2026", status: "stale", records: 80 },
  { id: "DS-005", name: "Cirium Market Data", type: "API (Phase 2)", lastRefresh: "—", status: "not-connected", records: 0 },
];

const auditLog = [
  { id: "AUD-9814", timestamp: "29 Apr 2026, 09:20", user: "Alex Johnson", action: "Export: Auditor Evidence Pack", resource: "RUN-2024-0847", ip: "10.0.1.44" },
  { id: "AUD-9813", timestamp: "29 Apr 2026, 09:14", user: "Alex Johnson", action: "Run Scenario", resource: "Baseline Q1 2026", ip: "10.0.1.44" },
  { id: "AUD-9812", timestamp: "29 Apr 2026, 09:05", user: "John Williams", action: "Login", resource: "—", ip: "10.0.1.12" },
  { id: "AUD-9811", timestamp: "28 Apr 2026, 17:22", user: "Sarah Chen", action: "Export: Portfolio Register", resource: "XLSX", ip: "10.0.1.31" },
  { id: "AUD-9810", timestamp: "28 Apr 2026, 16:32", user: "Alex Johnson", action: "Run Scenario", resource: "Fuel Spike +40%", ip: "10.0.1.44" },
  { id: "AUD-9809", timestamp: "28 Apr 2026, 14:30", user: "Sarah Chen", action: "Export: ECL Disclosure Pack", resource: "PDF", ip: "10.0.1.31" },
  { id: "AUD-9808", timestamp: "28 Apr 2026, 11:05", user: "John Williams", action: "Update Model Param", resource: "Scenario weights", ip: "10.0.1.12" },
  { id: "AUD-9807", timestamp: "27 Apr 2026, 16:00", user: "John Williams", action: "Export: Watchlist Report", resource: "PDF", ip: "10.0.1.12" },
];

const roleColors: Record<string, { bg: string; color: string }> = {
  "Admin": { bg: "rgba(0,33,71,0.08)", color: "#002147" },
  "Risk Analyst": { bg: "rgba(3,105,161,0.08)", color: "#0369A1" },
  "Accounting": { bg: "rgba(21,128,61,0.08)", color: "#15803D" },
  "Read-Only": { bg: "#F4F5F7", color: "#475569" },
};

const userAccessors = {
  name: (u: typeof users[0]) => u.name,
  role: (u: typeof users[0]) => u.role,
  lastLogin: (u: typeof users[0]) => u.lastLogin,
  status: (u: typeof users[0]) => u.status,
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState("tenant");
  const [saved, setSaved] = useState(false);
  const [weights, setWeights] = useState({ baseline: 60, adverse: 25, severe: 15 });
  const { sorted: sortedUsers, sortState: userSortState, toggleSort: toggleUserSort } = useSortable(users, userAccessors);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader title="Settings" subtitle="Tenant configuration, users, data sources, model parameters, audit log" />

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Tab List */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "1rem", overflow: "hidden" }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  width: "100%",
                  padding: "0.875rem 1.25rem",
                  borderBottom: "1px solid #E2E8F0",
                  background: activeTab === tab.id ? "#F4F5F7" : "#FFFFFF",
                  border: "none",
                  borderLeft: activeTab === tab.id ? "3px solid #002147" : "3px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.875rem",
                  fontWeight: activeTab === tab.id ? 600 : 500,
                  color: activeTab === tab.id ? "#002147" : "#475569",
                }}
              >
                <Icon size={16} style={{ flexShrink: 0, color: activeTab === tab.id ? "#002147" : "#94A3B8" }} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Tenant */}
          {activeTab === "tenant" && (
            <Card title="Tenant Settings" subtitle="Company-wide configuration">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                {[
                  { label: "Company Name", value: "Aer Capital Partners Ltd." },
                  { label: "Primary Currency", value: "USD" },
                  { label: "Timezone", value: "Europe/London (UTC+1)" },
                  { label: "Fiscal Year End", value: "31 December" },
                  { label: "IFRS 9 Adoption Date", value: "1 January 2019" },
                  { label: "Default Discount Rate", value: "5.75% (lessee-risk-adjusted WACC)" },
                ].map((field) => (
                  <div key={field.label}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.5rem" }}>
                      {field.label}
                    </label>
                    <input
                      defaultValue={field.value}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "0.625rem 0.75rem", fontSize: "0.875rem", color: "#0F172A", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                      onFocus={(e) => { e.target.style.borderColor = "#002147"; e.target.style.boxShadow = "0 0 0 3px rgba(0,33,71,0.1)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={handleSave} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: saved ? "#15803D" : "#002147", color: "#FFFFFF", border: "none", borderRadius: "9999px", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", transition: "all 200ms" }}>
                  {saved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Changes</>}
                </button>
              </div>
            </Card>
          )}

          {/* Users */}
          {activeTab === "users" && (
            <Card title="Users & Roles" subtitle="RBAC — Admin · Risk Analyst · Accounting · Read-Only"
              headerRight={
                <button style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#002147", color: "#FFFFFF", border: "none", borderRadius: "9999px", padding: "0.5rem 0.875rem", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}>
                  <Plus size={14} /> Invite User
                </button>
              }
              noPadding
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                    {([
                      { label: "Name", key: "name" },
                      { label: "Email", key: null },
                      { label: "Role", key: "role" },
                      { label: "MFA", key: null },
                      { label: "Last Login", key: "lastLogin" },
                      { label: "Status", key: "status" },
                      { label: "", key: null },
                    ] as { label: string; key: string | null }[]).map(({ label, key }) => (
                      <th
                        key={label || "_action"}
                        onClick={key ? () => toggleUserSort(key) : undefined}
                        style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", cursor: key ? "pointer" : "default", userSelect: "none" }}
                      >
                        {label}
                        {key && <span style={sortIconStyle(key, userSortState)}>{sortIcon(key, userSortState)}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((user, i) => (
                    <tr key={user.id} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#002147", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.625rem", fontWeight: 600, color: "#FFFFFF", flexShrink: 0 }}>
                            {user.name.split(" ").map(w => w[0]).join("")}
                          </div>
                          {user.name}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{user.email}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 500, padding: "0.2rem 0.5rem", borderRadius: "0.5rem", ...roleColors[user.role] }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        {user.mfa ? (
                          <span style={{ color: "#15803D", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem" }}><Check size={13} /> Enabled</span>
                        ) : (
                          <span style={{ color: "#B45309", fontSize: "0.8125rem" }}>Disabled</span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{user.lastLogin}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <StatusPill stage={user.status === "active" ? "green" : "neutral"} label={user.status} />
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ display: "flex", gap: "0.375rem" }}>
                          <button style={{ fontSize: "0.75rem", color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.25rem 0.5rem", cursor: "pointer" }}>Edit</button>
                          <button style={{ color: "#B91C1C", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.25rem 0.4rem", cursor: "pointer" }}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* Data Sources */}
          {activeTab === "datasources" && (
            <Card title="Data Sources" subtitle="CSV/XLSX upload, API connections, refresh cadence">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {dataSources.map(ds => (
                  <div key={ds.id} style={{ border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: "40px", height: "40px", background: ds.status === "ok" ? "rgba(21,128,61,0.08)" : ds.status === "stale" ? "rgba(180,83,9,0.08)" : "#F4F5F7", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Database size={18} style={{ color: ds.status === "ok" ? "#15803D" : ds.status === "stale" ? "#B45309" : "#94A3B8" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>{ds.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{ds.type} · {ds.records} records · Last refresh: {ds.lastRefresh}</div>
                    </div>
                    <StatusPill stage={ds.status === "ok" ? "green" : ds.status === "stale" ? "amber" : "neutral"} label={ds.status === "ok" ? "Connected" : ds.status === "stale" ? "Stale" : "Not Connected"} />
                    <button style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.375rem 0.75rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {ds.status === "not-connected" ? "Connect" : "Refresh"}
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Model Params */}
          {activeTab === "model" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Card title="Scenario Weights" subtitle="Must sum to 100%. Applied to all ECL calculations.">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                  {[
                    { key: "baseline" as const, label: "Baseline", color: "#15803D" },
                    { key: "adverse" as const, label: "Adverse", color: "#B45309" },
                    { key: "severe" as const, label: "Severe", color: "#B91C1C" },
                  ].map(({ key, label, color }) => (
                    <div key={key}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.5rem" }}>{label}</label>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="number"
                          value={weights[key]}
                          onChange={(e) => setWeights(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                          style={{ width: "80px", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "#0F172A", fontFamily: "monospace", outline: "none" }}
                        />
                        <span style={{ fontSize: "0.875rem", color: "#94A3B8" }}>%</span>
                      </div>
                      <div style={{ marginTop: "0.5rem", height: "4px", background: "#E2E8F0", borderRadius: "2px" }}>
                        <div style={{ width: `${weights[key]}%`, height: "100%", background: color, borderRadius: "2px" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "1rem", padding: "0.75rem", background: weights.baseline + weights.adverse + weights.severe === 100 ? "rgba(21,128,61,0.05)" : "rgba(185,28,28,0.05)", borderRadius: "0.75rem", fontSize: "0.8125rem" }}>
                  <span style={{ color: weights.baseline + weights.adverse + weights.severe === 100 ? "#15803D" : "#B91C1C", fontWeight: 600 }}>
                    Total: {weights.baseline + weights.adverse + weights.severe}% {weights.baseline + weights.adverse + weights.severe === 100 ? "✓" : "(must equal 100%)"}
                  </span>
                </div>
              </Card>

              <Card title="SICR Triggers" subtitle="Significant Increase in Credit Risk — IAS 109 thresholds">
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {[
                    { label: "Days Past Due Threshold (Stage 2)", value: "30 days" },
                    { label: "Days Past Due Threshold (Stage 3)", value: "90 days" },
                    { label: "PD Increase Threshold (Stage 2)", value: "×2.5 vs origination" },
                    { label: "Rating Downgrade Trigger", value: "≥ 2 notches in 12 months" },
                    { label: "Schedule Reduction Trigger", value: "≥ 20% YoY reduction" },
                    { label: "Watchlist Automatic Stage 2", value: "Enabled (on Red status)" },
                  ].map((param) => (
                    <div key={param.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: "1px solid #E2E8F0" }}>
                      <span style={{ fontSize: "0.875rem", color: "#475569" }}>{param.label}</span>
                      <input
                        defaultValue={param.value}
                        style={{ width: "240px", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "0.4rem 0.75rem", fontSize: "0.875rem", color: "#0F172A", fontFamily: "monospace", outline: "none" }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={handleSave} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: saved ? "#15803D" : "#002147", color: "#FFFFFF", border: "none", borderRadius: "9999px", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", transition: "all 200ms" }}>
                    {saved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Parameters</>}
                  </button>
                </div>
              </Card>
            </div>
          )}

          {/* Audit Log */}
          {activeTab === "audit" && (
            <Card title="Audit Log" subtitle="Immutable 7-year retention — all user actions logged" noPadding>
              <div style={{ padding: "1rem", borderBottom: "1px solid #E2E8F0", background: "#F4F5F7" }}>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input placeholder="Search by user, action, resource..." style={{ flex: 1, minWidth: "200px", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "#0F172A", outline: "none" }} />
                  <input type="date" defaultValue="2026-04-01" style={{ border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem", outline: "none" }} />
                  <input type="date" defaultValue="2026-04-29" style={{ border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem", outline: "none" }} />
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                    {["Event ID", "Timestamp", "User", "Action", "Resource", "IP Address"].map(h => (
                      <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry, i) => (
                    <tr key={entry.id} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>{entry.id}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569", whiteSpace: "nowrap" }}>{entry.timestamp}</td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{entry.user}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>{entry.action}</td>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>{entry.resource}</td>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#94A3B8" }}>{entry.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}