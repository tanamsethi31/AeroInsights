import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useSortable, sortIcon, sortIconStyle } from "../components/ui/useSortable";

const PATH_TAB: Record<string, string> = {
  "/settings/firm":         "tenant",
  "/settings/users":        "users",
  "/settings/data-sources": "datasources",
  "/settings/ecl":          "model",
  "/settings/excel":        "excel",
};
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusPill } from "../components/ui/StatusPill";
import { Building2, Users, Database, Sliders, ClipboardList, Save, Plus, Trash2, Eye, EyeOff, Check, Bell, Mail, X, Upload, FileSpreadsheet, Download, Copy, CheckCheck, ChevronDown, ChevronRight as ChevronRt, ShieldCheck, RefreshCw } from "lucide-react";
import { SANCTIONS_FEEDS, type FeedStatus } from "../data/sanctionsData";
import {
  type DimKey,
  type PolicyRule,
  DEFAULT_POLICY_RULES,
  PEAK_CONCENTRATIONS,
} from "../data/concentrationPolicy";
import { ImportWizard } from "../components/import/ImportWizard";
import { getWatchlistSummary, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS, computeScore, computeStatus, type SignalKey } from "../components/counterparties/watchlistEngine";

const tabs = [
  { id: "tenant",     label: "Tenant",        icon: Building2      },
  { id: "users",      label: "Users & RBAC",  icon: Users          },
  { id: "datasources",label: "Data Sources",  icon: Database       },
  { id: "model",      label: "Model Params",  icon: Sliders        },
  { id: "audit",      label: "Audit Log",     icon: ClipboardList  },
  { id: "alerts",     label: "Alerts",        icon: Bell           },
  { id: "excel",      label: "Excel Add-in",  icon: FileSpreadsheet },
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
  const { pathname } = useLocation();
  const [activeTab, setActiveTab] = useState(() => PATH_TAB[pathname] ?? "tenant");
  useEffect(() => { setActiveTab(PATH_TAB[pathname] ?? "tenant"); }, [pathname]);
  const [saved, setSaved] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [weights, setWeights] = useState({ baseline: 60, adverse: 25, severe: 15 });
  const [signalWeights, setSignalWeights] = useState({ ...DEFAULT_WEIGHTS });
  const [thresholds, setThresholds] = useState({ ...DEFAULT_THRESHOLDS });
  const [alertReadIds, setAlertReadIds] = useState<Set<string>>(new Set());

  // ── Email notification recipients ──
  type AlertTrigger = "red" | "red-amber";
  type EmailRecipient = { id: string; name: string; email: string; trigger: AlertTrigger };
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([
    { id: "er-1", name: "John Williams",  email: "john@aerinsights.com",  trigger: "red-amber" },
    { id: "er-2", name: "Alex Johnson",   email: "alex@aerinsights.com",  trigger: "red" },
  ]);
  const [newRecipEmail, setNewRecipEmail] = useState("");
  const [newRecipName,  setNewRecipName]  = useState("");
  const [newRecipTrig,  setNewRecipTrig]  = useState<AlertTrigger>("red-amber");
  const [recipSaved,    setRecipSaved]    = useState(false);
  const recipIdRef = useRef(100);

  function addRecipient() {
    if (!newRecipEmail.trim() || !newRecipName.trim()) return;
    setEmailRecipients(prev => [
      ...prev,
      { id: `er-${++recipIdRef.current}`, name: newRecipName.trim(), email: newRecipEmail.trim(), trigger: newRecipTrig },
    ]);
    setNewRecipEmail("");
    setNewRecipName("");
    setNewRecipTrig("red-amber");
    setRecipSaved(true);
    setTimeout(() => setRecipSaved(false), 2000);
  }

  function removeRecipient(id: string) {
    setEmailRecipients(prev => prev.filter(r => r.id !== id));
  }

  // ── Concentration Policy Rules ──
  const [policyRules, setPolicyRules] = useState<PolicyRule[]>([...DEFAULT_POLICY_RULES]);
  const [newRuleDim,   setNewRuleDim]   = useState<DimKey>("Lessee");
  const [newRuleLabel, setNewRuleLabel] = useState("");
  const [newRuleLimit, setNewRuleLimit] = useState<number>(20);
  const policyRuleIdRef = useRef(200);

  const weightSum = Object.values(signalWeights).reduce((a, b) => a + b, 0);
  const watchlistEntries = getWatchlistSummary();
  const alertEntries = watchlistEntries.filter(e => e.status !== "green");
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
            <>
            {showImportWizard && (
              <ImportWizard onClose={() => setShowImportWizard(false)} />
            )}
            <Card
              title="Data Sources"
              subtitle="CSV/XLSX upload, API connections, refresh cadence"
              headerRight={
                <button
                  onClick={() => setShowImportWizard(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1rem",
                    background: "#002147",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#FFFFFF",
                    cursor: "pointer",
                    transition: "background 150ms ease-out",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#001a35")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#002147")}
                >
                  <Upload size={13} />
                  Import New Portfolio
                </button>
              }
            >
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
            {/* ── Sanctions Feeds ─────────────────────────────────────────── */}
            <Card
              title="Sanctions Feeds"
              subtitle="Four free public feeds — screened against every lessee, counterparty and aircraft daily"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {SANCTIONS_FEEDS.map((feed) => {
                  const statusColor: Record<FeedStatus, string> = {
                    ok: "#15803D", stale: "#B45309", error: "#B91C1C",
                  };
                  const statusBg: Record<FeedStatus, string> = {
                    ok: "rgba(21,128,61,0.08)", stale: "rgba(180,83,9,0.08)", error: "rgba(185,28,28,0.08)",
                  };
                  const statusLabel: Record<FeedStatus, string> = {
                    ok: "Live", stale: "Stale", error: "Error",
                  };
                  return (
                    <div key={feed.id} style={{ border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                      {/* Icon */}
                      <div style={{
                        width: "40px", height: "40px", flexShrink: 0,
                        background: statusBg[feed.status],
                        borderRadius: "0.75rem",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <ShieldCheck size={18} style={{ color: statusColor[feed.status] }} />
                      </div>
                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>{feed.name}</span>
                          <span style={{
                            fontSize: "0.6875rem", fontWeight: 700,
                            color: statusColor[feed.status],
                            background: statusBg[feed.status],
                            borderRadius: "9999px", padding: "0.1rem 0.45rem",
                          }}>
                            {statusLabel[feed.status]}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                          {feed.authority} · {feed.records.toLocaleString()} records · {feed.cadence} · Last sync: {feed.lastSync}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "0.2rem" }}>{feed.description}</div>
                      </div>
                      {/* Actions */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.375rem", flexShrink: 0 }}>
                        <a
                          href={feed.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: "0.75rem", color: "#002147", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.25rem" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Source ↗
                        </a>
                        <button style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.375rem 0.75rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                          <RefreshCw size={12} /> Force Sync
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Policy note */}
              <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "rgba(0,33,71,0.04)", borderRadius: "0.75rem", fontSize: "0.75rem", color: "#475569", borderLeft: "3px solid #002147" }}>
                <strong style={{ color: "#002147" }}>Screening policy:</strong> All four feeds are cross-referenced against every lessee name, IATA code, operator certificate number, aircraft registration (ICAO 24-bit address) and beneficial owner on record. Alerts are generated on exact match or ≥90% fuzzy match. Results appear in Counterparties → Sanctions badge and Fleet Tracker.
              </div>
            </Card>
            </>
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

              {/* ── Concentration Policy Rules ───────────────────────────── */}
              <Card
                title="Concentration Policy Rules"
                subtitle="Board-level limits enforced against live portfolio concentration data"
              >
                {/* Active breach summary */}
                {(() => {
                  const breaches = policyRules
                    .filter((r) => r.enabled)
                    .map((r) => ({
                      rule: r,
                      peak: PEAK_CONCENTRATIONS[r.dimension],
                      overage: PEAK_CONCENTRATIONS[r.dimension].pct - r.limitPct,
                    }))
                    .filter((b) => b.overage > 0);

                  return breaches.length > 0 ? (
                    <div style={{
                      marginBottom: "1rem", padding: "0.875rem 1rem",
                      background: "rgba(180,83,9,0.06)", border: "1px solid rgba(180,83,9,0.25)",
                      borderRadius: "0.75rem",
                    }}>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#B45309", marginBottom: "0.375rem" }}>
                        ⚠ {breaches.length} active breach{breaches.length > 1 ? "es" : ""}
                        {" — "}
                        {breaches.map((b) =>
                          `${b.peak.name} (${b.rule.dimension}, +${b.overage.toFixed(1)}pp)`
                        ).join(" · ")}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                        Detected as of 29 Apr 2026 · Covenant Headroom view: Portfolio → Concentration → Covenant Headroom
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      marginBottom: "1rem", padding: "0.75rem 1rem",
                      background: "rgba(21,128,61,0.06)", border: "1px solid rgba(21,128,61,0.2)",
                      borderRadius: "0.75rem", fontSize: "0.8125rem", color: "#15803D", fontWeight: 500,
                    }}>
                      ✓ All enabled policy limits currently met.
                    </div>
                  );
                })()}

                {/* Rules table */}
                <div style={{ border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden", marginBottom: "1rem" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                    <thead>
                      <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
                        {["On", "Rule / Description", "Limit %", "Current Level", "Status", ""].map((h) => (
                          <th key={h} style={{
                            padding: "0.625rem 0.875rem", textAlign: "left",
                            fontSize: "0.6875rem", fontWeight: 600, color: "#64748B",
                            textTransform: "uppercase", letterSpacing: "0.04em",
                            whiteSpace: "nowrap",
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {policyRules.map((rule, i) => {
                        const peak = PEAK_CONCENTRATIONS[rule.dimension];
                        const overage = peak.pct - rule.limitPct;
                        const isBreached = rule.enabled && overage > 0;
                        const bLevel = isBreached && overage > rule.limitPct * 0.5 ? "red" : isBreached ? "amber" : "none";
                        return (
                          <tr
                            key={rule.id}
                            style={{
                              borderBottom: "1px solid #F1F5F9",
                              background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                              opacity: rule.enabled ? 1 : 0.6,
                            }}
                          >
                            {/* Toggle */}
                            <td style={{ padding: "0.625rem 0.875rem", width: "52px" }}>
                              <button
                                onClick={() =>
                                  setPolicyRules((prev) =>
                                    prev.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r)
                                  )
                                }
                                style={{
                                  width: "36px", height: "20px",
                                  background: rule.enabled ? "#002147" : "#CBD5E1",
                                  border: "none", borderRadius: "10px",
                                  position: "relative", cursor: "pointer",
                                  transition: "background 200ms ease",
                                }}
                              >
                                <span style={{
                                  position: "absolute", top: "2px",
                                  left: rule.enabled ? "18px" : "2px",
                                  width: "16px", height: "16px",
                                  background: "#FFFFFF", borderRadius: "50%",
                                  transition: "left 200ms ease",
                                  display: "block",
                                }} />
                              </button>
                            </td>
                            {/* Label + Description */}
                            <td style={{ padding: "0.625rem 0.875rem", minWidth: "240px" }}>
                              <div style={{ fontWeight: 500, color: "#0F172A" }}>{rule.label}</div>
                              {rule.description && (
                                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.1rem" }}>
                                  {rule.description}
                                </div>
                              )}
                            </td>
                            {/* Limit % */}
                            <td style={{ padding: "0.625rem 0.875rem", width: "110px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={rule.limitPct}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val > 0 && val <= 100) {
                                      setPolicyRules((prev) =>
                                        prev.map((r) => r.id === rule.id ? { ...r, limitPct: val } : r)
                                      );
                                    }
                                  }}
                                  style={{
                                    width: "52px", border: "1px solid #E2E8F0", borderRadius: "0.375rem",
                                    padding: "0.25rem 0.375rem", fontSize: "0.8125rem", color: "#0F172A",
                                    textAlign: "right", fontFamily: "monospace", outline: "none",
                                  }}
                                />
                                <span style={{ fontSize: "0.8125rem", color: "#94A3B8" }}>%</span>
                              </div>
                            </td>
                            {/* Current level */}
                            <td style={{ padding: "0.625rem 0.875rem", fontVariantNumeric: "tabular-nums" }}>
                              <span style={{
                                fontWeight: isBreached ? 700 : 400,
                                color: bLevel === "red" ? "#B91C1C" : bLevel === "amber" ? "#B45309" : "#475569",
                              }}>
                                {peak.pct}% <span style={{ color: "#94A3B8", fontWeight: 400, fontSize: "0.6875rem" }}>({peak.name})</span>
                              </span>
                            </td>
                            {/* Status */}
                            <td style={{ padding: "0.625rem 0.875rem", width: "160px" }}>
                              {!rule.enabled ? (
                                <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500 }}>Disabled</span>
                              ) : bLevel === "red" ? (
                                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#B91C1C" }}>
                                  ● Red Breach (+{overage.toFixed(1)}pp)
                                </span>
                              ) : bLevel === "amber" ? (
                                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#B45309" }}>
                                  ▲ Amber Breach (+{overage.toFixed(1)}pp)
                                </span>
                              ) : (
                                <span style={{ fontSize: "0.6875rem", fontWeight: 500, color: "#15803D" }}>✓ Compliant</span>
                              )}
                            </td>
                            {/* Delete */}
                            <td style={{ padding: "0.625rem 0.875rem", width: "44px" }}>
                              <button
                                onClick={() =>
                                  setPolicyRules((prev) => prev.filter((r) => r.id !== rule.id))
                                }
                                style={{
                                  background: "transparent", border: "1px solid #E2E8F0",
                                  borderRadius: "0.375rem", padding: "0.25rem 0.4rem",
                                  cursor: "pointer", color: "#B91C1C",
                                  display: "flex", alignItems: "center",
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add rule form */}
                <div style={{
                  display: "flex", gap: "0.625rem", alignItems: "flex-end",
                  padding: "0.75rem", background: "#F8FAFC",
                  border: "1px solid #E2E8F0", borderRadius: "0.625rem",
                }}>
                  <div style={{ flex: "0 0 120px" }}>
                    <label style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Dimension
                    </label>
                    <select
                      value={newRuleDim}
                      onChange={(e) => setNewRuleDim(e.target.value as DimKey)}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.4rem 0.5rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF", outline: "none", cursor: "pointer" }}
                    >
                      {(["Lessee", "Country", "Region", "Type", "Vintage", "Currency"] as DimKey[]).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Rule label
                    </label>
                    <input
                      value={newRuleLabel}
                      onChange={(e) => setNewRuleLabel(e.target.value)}
                      placeholder={`No single ${newRuleDim.toLowerCase()} > X% of book`}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.4rem 0.625rem", fontSize: "0.8125rem", color: "#0F172A", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }}
                    />
                  </div>
                  <div style={{ flex: "0 0 80px" }}>
                    <label style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Limit %
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newRuleLimit}
                      onChange={(e) => setNewRuleLimit(Number(e.target.value))}
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem", padding: "0.4rem 0.5rem", fontSize: "0.8125rem", color: "#0F172A", fontFamily: "monospace", outline: "none", textAlign: "right" as const }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!newRuleLabel.trim()) return;
                      setPolicyRules((prev) => [
                        ...prev,
                        {
                          id: `pr-custom-${++policyRuleIdRef.current}`,
                          dimension: newRuleDim,
                          label: newRuleLabel.trim(),
                          limitPct: newRuleLimit,
                          enabled: true,
                          description: "",
                        },
                      ]);
                      setNewRuleLabel("");
                      setNewRuleLimit(20);
                    }}
                    disabled={!newRuleLabel.trim()}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.375rem",
                      background: !newRuleLabel.trim() ? "#94A3B8" : "#002147",
                      color: "#FFFFFF", border: "none", borderRadius: "0.375rem",
                      padding: "0.4rem 0.875rem", fontSize: "0.8125rem", fontWeight: 500,
                      cursor: !newRuleLabel.trim() ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap" as const, flexShrink: 0,
                    }}
                  >
                    <Plus size={13} /> Add Rule
                  </button>
                </div>

                {/* Footer note */}
                <div style={{ marginTop: "0.875rem", fontSize: "0.75rem", color: "#94A3B8" }}>
                  Policy limits are checked against live portfolio concentration. Breaches surface in{" "}
                  <strong style={{ color: "#64748B" }}>Portfolio → Concentration → Covenant Headroom</strong>{" "}
                  and trigger automated email alerts per the Alerts configuration.
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

          {activeTab === "alerts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* Email Notification Rules */}
              <Card
                title="Email Notification Rules"
                subtitle="Recipients automatically emailed when a lessee crosses a configured threshold"
              >
                {/* Recipient table */}
                {emailRecipients.length > 0 && (
                  <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                      <thead>
                        <tr style={{ background: "#F4F5F7" }}>
                          {["Name", "Email Address", "Alert Trigger", ""].map(h => (
                            <th
                              key={h}
                              style={{
                                padding: "0.5rem 0.75rem", textAlign: "left",
                                fontSize: "0.6875rem", fontWeight: 600,
                                color: "#64748B", textTransform: "uppercase",
                                letterSpacing: "0.04em", whiteSpace: "nowrap",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {emailRecipients.map((r, i) => (
                          <tr
                            key={r.id}
                            style={{
                              borderBottom: "1px solid #F1F5F9",
                              background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                            }}
                          >
                            <td style={{ padding: "0.625rem 0.75rem", fontWeight: 600, color: "#0F172A" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <div
                                  style={{
                                    width: "24px", height: "24px", borderRadius: "50%",
                                    background: "#002147", display: "flex", alignItems: "center",
                                    justifyContent: "center", fontSize: "0.5625rem",
                                    fontWeight: 600, color: "#FFFFFF", flexShrink: 0,
                                  }}
                                >
                                  {r.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                                </div>
                                {r.name}
                              </div>
                            </td>
                            <td style={{ padding: "0.625rem 0.75rem", color: "#475569" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                <Mail size={11} style={{ color: "#94A3B8", flexShrink: 0 }} />
                                {r.email}
                              </div>
                            </td>
                            <td style={{ padding: "0.625rem 0.75rem" }}>
                              <div style={{ display: "flex", gap: "0.375rem" }}>
                                {(["red", "red-amber"] as AlertTrigger[]).map(t => (
                                  <button
                                    key={t}
                                    onClick={() =>
                                      setEmailRecipients(prev =>
                                        prev.map(rec => rec.id === r.id ? { ...rec, trigger: t } : rec)
                                      )
                                    }
                                    style={{
                                      fontSize: "0.6875rem", fontWeight: 600,
                                      padding: "0.2rem 0.5rem", borderRadius: "9999px",
                                      border: r.trigger === t ? "none" : "1px solid #E2E8F0",
                                      cursor: "pointer",
                                      background: r.trigger === t
                                        ? (t === "red" ? "rgba(185,28,28,0.1)" : "rgba(180,83,9,0.1)")
                                        : "#FFFFFF",
                                      color: r.trigger === t
                                        ? (t === "red" ? "#B91C1C" : "#B45309")
                                        : "#94A3B8",
                                      transition: "all 150ms ease",
                                    }}
                                  >
                                    {t === "red" ? "Red only" : "Amber & Red"}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: "0.625rem 0.75rem", textAlign: "right" }}>
                              <button
                                onClick={() => removeRecipient(r.id)}
                                style={{
                                  color: "#B91C1C", background: "transparent",
                                  border: "1px solid #E2E8F0", borderRadius: "0.375rem",
                                  padding: "0.2rem 0.4rem", cursor: "pointer",
                                  display: "flex", alignItems: "center",
                                }}
                              >
                                <X size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add recipient row */}
                <div
                  style={{
                    display: "flex", gap: "0.625rem", alignItems: "flex-end",
                    padding: "0.75rem", background: "#F8FAFC",
                    border: "1px solid #E2E8F0", borderRadius: "0.625rem",
                  }}
                >
                  <div style={{ flex: "0 0 160px" }}>
                    <label style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Name
                    </label>
                    <input
                      value={newRecipName}
                      onChange={e => setNewRecipName(e.target.value)}
                      placeholder="Jane Smith"
                      style={{
                        width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem",
                        padding: "0.4rem 0.625rem", fontSize: "0.8125rem", color: "#0F172A",
                        fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const,
                      }}
                    />
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Email address
                    </label>
                    <input
                      type="email"
                      value={newRecipEmail}
                      onChange={e => setNewRecipEmail(e.target.value)}
                      placeholder="jane@aerinsights.com"
                      onKeyDown={e => e.key === "Enter" && addRecipient()}
                      style={{
                        width: "100%", border: "1px solid #E2E8F0", borderRadius: "0.375rem",
                        padding: "0.4rem 0.625rem", fontSize: "0.8125rem", color: "#0F172A",
                        fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", display: "block", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Trigger
                    </label>
                    <select
                      value={newRecipTrig}
                      onChange={e => setNewRecipTrig(e.target.value as AlertTrigger)}
                      style={{
                        border: "1px solid #E2E8F0", borderRadius: "0.375rem",
                        padding: "0.4rem 0.625rem", fontSize: "0.8125rem", color: "#0F172A",
                        background: "#FFFFFF", outline: "none", cursor: "pointer",
                      }}
                    >
                      <option value="red-amber">Amber &amp; Red</option>
                      <option value="red">Red only</option>
                    </select>
                  </div>
                  <button
                    onClick={addRecipient}
                    disabled={!newRecipEmail.trim() || !newRecipName.trim()}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.375rem",
                      background: recipSaved ? "#15803D" : (!newRecipEmail.trim() || !newRecipName.trim()) ? "#94A3B8" : "#002147",
                      color: "#FFFFFF", border: "none", borderRadius: "0.375rem",
                      padding: "0.4rem 0.875rem", fontSize: "0.8125rem", fontWeight: 500,
                      cursor: (!newRecipEmail.trim() || !newRecipName.trim()) ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap", transition: "background 200ms ease",
                      flexShrink: 0,
                    }}
                  >
                    {recipSaved ? <><Check size={13} /> Added</> : <><Plus size={13} /> Add</>}
                  </button>
                </div>

                {/* Info note */}
                <div style={{ marginTop: "0.875rem", fontSize: "0.75rem", color: "#94A3B8", display: "flex", alignItems: "flex-start", gap: "0.375rem" }}>
                  <Mail size={12} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                  Emails are sent within 15 minutes of a watchlist status change. Each email includes the lessee name, new status, triggering signal, and evidence snapshot.
                </div>
              </Card>

              {/* Signal Weight Configuration */}
              <Card title="Signal Weight Configuration" subtitle="Adjust the relative weight of each early-warning signal (must sum to 100)">
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {(Object.keys(signalWeights) as SignalKey[]).map(key => {
                    const labels: Record<SignalKey, string> = {
                      paymentLateness: "Payment Lateness",
                      scheduleQoQ: "Schedule Cancellations (QoQ)",
                      ratingChange: "Rating Change",
                      ctcWatchlist: "AWG CTC Watchlist",
                      newsKeywordHits: "News Keyword Hits",
                    };
                    return (
                      <div key={key}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                          <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#475569" }}>{labels[key]}</label>
                          <span style={{ fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#0F172A" }}>{signalWeights[key]}</span>
                        </div>
                        <input
                          type="range" min={0} max={100} step={1} value={signalWeights[key]}
                          onChange={e => setSignalWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                          style={{ width: "100%", accentColor: "#002147" }}
                        />
                      </div>
                    );
                  })}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem",
                    background: weightSum === 100 ? "rgba(21,128,61,0.08)" : "rgba(180,83,9,0.1)",
                    borderRadius: "0.375rem", fontSize: "0.8125rem",
                    color: weightSum === 100 ? "#15803D" : "#B45309", fontWeight: 600,
                  }}>
                    {weightSum === 100 ? "✓" : "⚠"} Total weight: {weightSum} / 100
                    {weightSum !== 100 && <span style={{ fontWeight: 400 }}>— adjust sliders to reach exactly 100</span>}
                  </div>
                  <button
                    onClick={() => setSignalWeights({ ...DEFAULT_WEIGHTS })}
                    style={{ alignSelf: "flex-start", fontSize: "0.8125rem", color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.375rem 0.875rem", cursor: "pointer" }}
                  >
                    Reset to defaults
                  </button>
                </div>
              </Card>

              {/* Threshold Configuration */}
              <Card title="Threshold Configuration" subtitle="Score thresholds for Red and Amber status">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {[
                      { label: "Red threshold (score ≥)", key: "red" as const, color: "#B91C1C" },
                      { label: "Amber threshold (score ≥)", key: "amber" as const, color: "#B45309" },
                    ].map(({ label, key, color }) => (
                      <div key={key}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>{label}</label>
                        <input
                          type="number" min={0} max={100}
                          value={thresholds[key]}
                          onChange={e => setThresholds(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                          style={{ width: "100%", padding: "0.5rem 0.75rem", border: `1px solid ${color}44`, borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", boxSizing: "border-box" as const, fontVariantNumeric: "tabular-nums" }}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.5rem" }}>Preview with current thresholds</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      {watchlistEntries.map(e => {
                        const previewScore = computeScore(e.signals, signalWeights);
                        const previewStatus = computeStatus(previewScore, thresholds);
                        const c = previewStatus === "green" ? "#15803D" : previewStatus === "amber" ? "#B45309" : "#B91C1C";
                        const bg = previewStatus === "green" ? "rgba(21,128,61,0.08)" : previewStatus === "amber" ? "rgba(180,83,9,0.08)" : "rgba(185,28,28,0.08)";
                        return (
                          <div key={e.lesseeId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.375rem 0.5rem", background: bg, borderRadius: "0.25rem" }}>
                            <span style={{ fontSize: "0.8125rem", color: "#0F172A" }}>{e.lesseeName}</span>
                            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: c }}>
                              {previewStatus.charAt(0).toUpperCase() + previewStatus.slice(1)} ({previewScore.toFixed(0)})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Alert Inbox */}
              <Card
                title="Alert Inbox"
                subtitle="Active watchlist alerts requiring review"
                headerRight={
                  alertEntries.some(e => !alertReadIds.has(e.lesseeId)) ? (
                    <button
                      onClick={() => setAlertReadIds(new Set(alertEntries.map(e => e.lesseeId)))}
                      style={{ fontSize: "0.75rem", color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.25rem 0.75rem", cursor: "pointer" }}
                    >
                      Mark all read
                    </button>
                  ) : undefined
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {alertEntries.length === 0 ? (
                    <div style={{ padding: "1rem", textAlign: "center" as const, color: "#94A3B8", fontSize: "0.8125rem" }}>No active alerts</div>
                  ) : alertEntries.map(e => {
                    const isRead = alertReadIds.has(e.lesseeId);
                    const c = e.status === "red" ? "#B91C1C" : "#B45309";
                    const bg = isRead ? "#FFFFFF" : "#FFFBEB";
                    return (
                      <div key={e.lesseeId} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem", background: bg, border: "1px solid #E2E8F0", borderRadius: "0.5rem" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>{e.lesseeName}</div>
                          <div style={{ fontSize: "0.75rem", color: "#475569" }}>{e.trigger} · {e.reason}</div>
                          <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "0.125rem" }}>Last changed: {e.lastChanged}</div>
                        </div>
                        {!isRead && (
                          <button
                            onClick={() => setAlertReadIds(prev => new Set([...prev, e.lesseeId]))}
                            style={{ fontSize: "0.75rem", color: "#64748B", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.25rem 0.625rem", cursor: "pointer", flexShrink: 0 }}
                          >
                            Mark read
                          </button>
                        )}
                        {isRead && (
                          <span style={{ fontSize: "0.75rem", color: "#94A3B8", flexShrink: 0 }}>Read</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}
          {activeTab === "excel" && <ExcelAddinTab />}
        </div>
      </div>
    </div>
  );
}

/* ── Excel Add-in Settings Tab ───────────────────────────────────────────── */

const ADDIN_FUNCTIONS = [
  { id: "AER.ECL",              params: "leaseId, scenario, asOfDate", group: "ECL & Risk",       description: "Expected Credit Loss in $M for a lease under a scenario"             },
  { id: "AER.PORTFOLIO_ECL",    params: "scenario, asOfDate",          group: "ECL & Risk",       description: "Total portfolio ECL in $M"                                           },
  { id: "AER.STAGE",            params: "leaseId, asOfDate",           group: "ECL & Risk",       description: "IFRS 9 stage (1, 2, or 3) for a lease"                              },
  { id: "AER.LGD",              params: "leaseId",                     group: "ECL & Risk",       description: "Loss Given Default (decimal), net of SD and MR offsets"             },
  { id: "AER.PD",               params: 'leaseId, "12m"|"lifetime"',   group: "ECL & Risk",       description: "Probability of Default for a lease"                                  },
  { id: "AER.EAD",              params: "leaseId",                     group: "ECL & Risk",       description: "Exposure at Default in $M"                                           },
  { id: "AER.MR_BALANCE",       params: "leaseId, asOfDate",           group: "Maintenance & SD", description: "Maintenance reserve balance in $M"                                  },
  { id: "AER.SD_POSTED",        params: "leaseId",                     group: "Maintenance & SD", description: "Security deposit posted in $M"                                      },
  { id: "AER.MR_SHORTFALL",     params: "leaseId",                     group: "Maintenance & SD", description: "Projected MR shortfall at EOL in $M (negative = surplus)"          },
  { id: "AER.REPO_P50",         params: "jurisdictionCode",            group: "Jurisdictions",    description: "P50 repossession timeline in months (ISO country code)"             },
  { id: "AER.REPO_P90",         params: "jurisdictionCode",            group: "Jurisdictions",    description: "P90 repossession timeline in months"                                },
  { id: "AER.REPO_COST",        params: "jurisdictionCode",            group: "Jurisdictions",    description: "Repossession cost as % of aircraft value (decimal)"                 },
  { id: "AER.CTC_SCORE",        params: "jurisdictionCode",            group: "Jurisdictions",    description: "Cape Town Convention compliance score 0–100"                        },
  { id: "AER.BEHAVIOR_SCORE",   params: "lesseeId",                    group: "Counterparty",     description: "OCPI behavior score 0–100 (0 = worst contractual performance)"      },
  { id: "AER.WATCHLIST_STATUS", params: "lesseeId",                    group: "Counterparty",     description: 'Watchlist status: "GREEN", "AMBER", or "RED"'                      },
  { id: "AER.LESSEE_STAGE",     params: "lesseeId",                    group: "Counterparty",     description: "Worst IFRS 9 stage across all leases for a lessee"                  },
  { id: "AER.LESSEE_ECL",       params: "lesseeId, scenario",          group: "Counterparty",     description: "Total ECL in $M across all leases for a lessee"                    },
  { id: "AER.MARKET_VALUE",     params: "msn",                         group: "Portfolio",        description: "Half-life market value in $M by aircraft MSN"                       },
  { id: "AER.ENCUMBERED_VALUE", params: "msn",                         group: "Portfolio",        description: "Lease-encumbered value (LEV) in $M by MSN"                         },
  { id: "AER.KPI",              params: "metricName, asOfDate",        group: "Portfolio",        description: "Named portfolio KPI: portfolio_ecl | book_value | ecl_rate | …"    },
] as const;

const FN_GROUPS = ["ECL & Risk", "Maintenance & SD", "Jurisdictions", "Counterparty", "Portfolio"] as const;

const INSTALL_STEPS = [
  {
    platform: "Mac — Excel Desktop",
    steps: [
      "Quit Excel if it is open.",
      'Create the add-in folder if it does not exist:\nmkdir -p ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef',
      "Download manifest.xml using the button above and copy it into that folder.",
      'Open Excel → Insert → Add-ins → My Add-ins → Shared Folder → select "Aeroinsights Decision Platform".',
      "The Aeroinsights button appears in the Home ribbon. Click it to open the task pane.",
    ],
  },
  {
    platform: "Windows — Excel Desktop",
    steps: [
      "Create a local shared folder, e.g. C:\\AeroinsightsAddin, and copy manifest.xml into it.",
      "In Excel: File → Options → Trust Center → Trust Center Settings → Trusted Add-in Catalogs.",
      'Add the folder path as a catalog URL. Check "Show in Menu". Click OK and restart Excel.',
      'Insert → My Add-ins → Shared Folder → "Aeroinsights Decision Platform".',
    ],
  },
  {
    platform: "Excel Online",
    steps: [
      "Open any workbook in Excel Online.",
      "Insert → Add-ins → Upload My Add-in.",
      "Browse to the downloaded manifest.xml and click Upload.",
      "The Aeroinsights button appears in the ribbon immediately.",
    ],
  },
];

function ExcelAddinTab() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openPlatform, setOpenPlatform] = useState<string | null>("Mac — Excel Desktop");

  const copyFormula = (fn: typeof ADDIN_FUNCTIONS[number]) => {
    const example = `=AER.ECL("LSE-2019-001","Baseline","2026-04-29")`.replace(
      /^=AER\.ECL.*/,
      `=${fn.id}(${fn.params})`
    );
    navigator.clipboard.writeText(example).then(() => {
      setCopiedId(fn.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const downloadManifest = () => {
    // In production, link to https://addin.aerinsights.com/manifest.xml
    // In development, trigger browser navigation to the dev server
    window.open("https://addin.aerinsights.com/manifest.xml", "_blank");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Hero card */}
      <Card title="Excel Add-in" subtitle="Pull live Aeroinsights data directly into Excel cells using 20 custom AER.* functions">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { n: "20", label: "Custom functions" },
            { n: "4",  label: "Function groups"  },
            { n: "360°", label: "Portfolio coverage"},
          ].map(k => (
            <div key={k.label} style={{
              background: "#F8FAFC", border: "1px solid #E2E8F0",
              borderRadius: "0.5rem", padding: "1rem", textAlign: "center",
            }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#002147" }}>{k.n}</div>
              <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "0.125rem" }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{
          background: "#EFF6FF", border: "1px solid #BFDBFE",
          borderRadius: "0.5rem", padding: "1rem 1.25rem",
          marginBottom: "1.25rem",
        }}>
          <p style={{ fontSize: "0.8125rem", color: "#1D4ED8", lineHeight: 1.6, margin: 0 }}>
            <strong>How it works:</strong> After installing the add-in in Excel, sign in using the task pane.
            Your session token is stored locally and used to authenticate every{" "}
            <code style={{ fontFamily: "monospace", background: "rgba(29,78,216,0.1)", padding: "0 4px", borderRadius: 3 }}>
              AER.*
            </code>{" "}
            function call. Data flows directly from the Aeroinsights API to your Excel cells — no copy-paste, no exports.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            onClick={downloadManifest}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              background: "#002147", color: "#FFFFFF",
              border: "none", borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem", fontSize: "0.8125rem",
              fontWeight: 600, cursor: "pointer",
            }}
          >
            <Download size={15}/> Download manifest.xml
          </button>
          <a
            href="https://app.aerinsights.com/docs/excel-addin"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              background: "transparent", color: "#002147",
              border: "1px solid #CBD5E1", borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem", fontSize: "0.8125rem",
              fontWeight: 600, cursor: "pointer", textDecoration: "none",
            }}
          >
            Full documentation ↗
          </a>
        </div>
      </Card>

      {/* Installation guide */}
      <Card title="Installation" subtitle="Sideload the manifest into Excel Desktop (Mac or Windows) or Excel Online">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {INSTALL_STEPS.map(({ platform, steps }) => {
            const isOpen = openPlatform === platform;
            return (
              <div key={platform} style={{ border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>
                <button
                  onClick={() => setOpenPlatform(isOpen ? null : platform)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    justifyContent: "space-between", padding: "0.75rem 1rem",
                    background: isOpen ? "#F8FAFC" : "#FFFFFF",
                    border: "none", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
                    {platform}
                  </span>
                  {isOpen
                    ? <ChevronDown size={15} style={{ color: "#94A3B8", flexShrink: 0 }}/>
                    : <ChevronRt  size={15} style={{ color: "#94A3B8", flexShrink: 0 }}/>
                  }
                </button>
                {isOpen && (
                  <div style={{ padding: "0 1rem 1rem", borderTop: "1px solid #E2E8F0" }}>
                    <ol style={{ paddingLeft: "1.25rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                      {steps.map((step, i) => (
                        <li key={i} style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.6, marginTop: i === 0 ? "0.875rem" : 0 }}>
                          {step.split("\n").map((line, j) =>
                            j === 0 ? <span key={j}>{line}</span>
                            : <code key={j} style={{ display: "block", marginTop: "0.375rem", fontFamily: "monospace", fontSize: "0.75rem", background: "#F1F5F9", padding: "0.375rem 0.625rem", borderRadius: "0.25rem", color: "#002147" }}>{line}</code>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Function reference */}
      <Card title="Available Functions" subtitle="All 20 AER.* custom functions — click any row to copy the formula skeleton">
        {FN_GROUPS.map(group => {
          const fns = ADDIN_FUNCTIONS.filter(f => f.group === group);
          return (
            <div key={group} style={{ marginBottom: "1rem" }}>
              <div style={{
                fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em",
                color: "#64748B", textTransform: "uppercase",
                padding: "0.375rem 0", marginBottom: "0.375rem",
                borderBottom: "1px solid #E2E8F0",
              }}>
                {group}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <tbody>
                  {fns.map(fn => (
                    <tr
                      key={fn.id}
                      onClick={() => copyFormula(fn)}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        cursor: "pointer",
                        transition: "background 100ms ease-out",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "0.5rem 0.5rem 0.5rem 0", whiteSpace: "nowrap", width: "200px" }}>
                        <span style={{
                          fontFamily: "monospace", fontSize: "0.8125rem",
                          fontWeight: 700, color: "#002147",
                        }}>
                          {fn.id}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#94A3B8", fontFamily: "monospace", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                        ({fn.params})
                      </td>
                      <td style={{ padding: "0.5rem 0", color: "#475569", lineHeight: 1.4 }}>
                        {fn.description}
                      </td>
                      <td style={{ padding: "0.5rem 0 0.5rem 0.75rem", textAlign: "right", whiteSpace: "nowrap" }}>
                        {copiedId === fn.id
                          ? <span style={{ fontSize: "0.75rem", color: "#16A34A", display: "flex", alignItems: "center", gap: 4 }}><CheckCheck size={13}/> Copied</span>
                          : <Copy size={13} style={{ color: "#CBD5E1" }}/>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </Card>

      {/* Requirements */}
      <Card title="Requirements" subtitle="What you need before installing">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          {[
            { label: "Microsoft 365",        detail: "Excel Desktop (Mac or Windows) or Excel Online" },
            { label: "HTTPS dev server",      detail: "npm run dev in packages/excel-addin/ for local testing" },
            { label: "Auth0 SPA app",         detail: "A separate Auth0 client configured for addin.aerinsights.com" },
            { label: "CORS origin",           detail: "addin.aerinsights.com must be in backend CORS_ORIGINS" },
          ].map(req => (
            <div key={req.label} style={{
              background: "#F8FAFC", border: "1px solid #E2E8F0",
              borderRadius: "0.5rem", padding: "0.875rem 1rem",
            }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", marginBottom: "0.25rem" }}>
                {req.label}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B", lineHeight: 1.5 }}>
                {req.detail}
              </div>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}