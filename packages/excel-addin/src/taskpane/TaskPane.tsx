/**
 * TaskPane.tsx — Aeroinsights Excel Add-in
 * ─────────────────────────────────────────────────────────────────────────────
 * Four sections:
 *   1. Connection Status  — always visible, ping-based, auto-refresh 60s
 *   2. Quick Reference    — portfolio KPI table, collapsible (default open)
 *   3. Function Reference — searchable list of all 20 AER.* functions
 *   4. Insert Helper      — build + insert formula into the active cell
 *
 * Design tokens (Aeroinsights design system):
 *   Primary:     #002147 (Oxford Blue)
 *   Text primary:  #0F172A
 *   Text secondary:#475569
 *   Border:        #E2E8F0
 *   Background:    #FFFFFF / #FAFAFA cards
 *   Danger:        #DC2626
 *   Success:       #16A34A
 */

import { useState, useEffect, useCallback } from "react";
import { addinFetch, TOKEN_KEY, API_BASE } from "../shared/api";

/* ── Design constants ────────────────────────────────────────────────────── */

const C = {
  blue:     "#002147",
  text:     "#0F172A",
  muted:    "#475569",
  subtle:   "#94A3B8",
  border:   "#E2E8F0",
  bg:       "#FFFFFF",
  bgCard:   "#FAFAFA",
  bgBlue:   "#EFF6FF",
  danger:   "#DC2626",
  success:  "#16A34A",
  amber:    "#D97706",
  mono:     "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
} as const;

/* ── Function catalogue ──────────────────────────────────────────────────── */

type FnGroup = "ECL & Risk" | "Maintenance & SD" | "Jurisdictions" | "Portfolio & KPIs";

interface AerFunction {
  id:          string;          // e.g. "AER.ECL"
  params:      { name: string; placeholder: string; type: "string" | "number" }[];
  description: string;
  group:       FnGroup;
  example:     string;
}

const FUNCTIONS: AerFunction[] = [
  // ── ECL & Risk ───────────────────────────────────────────────────────────
  {
    id: "AER.ECL", group: "ECL & Risk",
    params: [
      { name: "leaseId",   placeholder: '"LSE-2019-001"', type: "string" },
      { name: "scenario",  placeholder: '"Baseline"',      type: "string" },
      { name: "asOfDate",  placeholder: '"2026-04-29"',    type: "string" },
    ],
    description: "Expected Credit Loss in $M for a lease under a scenario",
    example: '=AER.ECL("LSE-2019-001","Baseline","2026-04-29")',
  },
  {
    id: "AER.PORTFOLIO_ECL", group: "ECL & Risk",
    params: [
      { name: "scenario",  placeholder: '"Baseline"',   type: "string" },
      { name: "asOfDate",  placeholder: '"2026-04-29"', type: "string" },
    ],
    description: "Total portfolio ECL in $M for a scenario",
    example: '=AER.PORTFOLIO_ECL("Baseline","2026-04-29")',
  },
  {
    id: "AER.STAGE", group: "ECL & Risk",
    params: [
      { name: "leaseId",  placeholder: '"LSE-2019-001"', type: "string" },
      { name: "asOfDate", placeholder: '"2026-04-29"',   type: "string" },
    ],
    description: "IFRS 9 stage (1, 2, or 3) for a lease",
    example: '=AER.STAGE("LSE-2019-001","2026-04-29")',
  },
  {
    id: "AER.LGD", group: "ECL & Risk",
    params: [{ name: "leaseId", placeholder: '"LSE-2019-001"', type: "string" }],
    description: "Loss Given Default as a decimal, net of SD and MR offsets",
    example: '=AER.LGD("LSE-2019-001")',
  },
  {
    id: "AER.PD", group: "ECL & Risk",
    params: [
      { name: "leaseId", placeholder: '"LSE-2019-001"', type: "string" },
      { name: "horizon", placeholder: '"12m"',           type: "string" },
    ],
    description: 'Probability of Default — horizon: "12m" or "lifetime"',
    example: '=AER.PD("LSE-2019-001","lifetime")',
  },
  {
    id: "AER.EAD", group: "ECL & Risk",
    params: [{ name: "leaseId", placeholder: '"LSE-2019-001"', type: "string" }],
    description: "Exposure at Default in $M",
    example: '=AER.EAD("LSE-2019-001")',
  },
  // ── Maintenance & SD ─────────────────────────────────────────────────────
  {
    id: "AER.MR_BALANCE", group: "Maintenance & SD",
    params: [
      { name: "leaseId",  placeholder: '"LSE-2019-001"', type: "string" },
      { name: "asOfDate", placeholder: '"2026-04-29"',   type: "string" },
    ],
    description: "Maintenance reserve balance in $M",
    example: '=AER.MR_BALANCE("LSE-2019-001","2026-04-29")',
  },
  {
    id: "AER.SD_POSTED", group: "Maintenance & SD",
    params: [{ name: "leaseId", placeholder: '"LSE-2019-001"', type: "string" }],
    description: "Security deposit posted in $M",
    example: '=AER.SD_POSTED("LSE-2019-001")',
  },
  {
    id: "AER.MR_SHORTFALL", group: "Maintenance & SD",
    params: [{ name: "leaseId", placeholder: '"LSE-2019-001"', type: "string" }],
    description: "Projected MR shortfall at EOL in $M (negative = surplus)",
    example: '=AER.MR_SHORTFALL("LSE-2019-001")',
  },
  // ── Jurisdictions ─────────────────────────────────────────────────────────
  {
    id: "AER.REPO_P50", group: "Jurisdictions",
    params: [{ name: "jurisdictionCode", placeholder: '"IN"', type: "string" }],
    description: "Months to repossession at P50 for a jurisdiction (ISO code)",
    example: '=AER.REPO_P50("IN")',
  },
  {
    id: "AER.REPO_P90", group: "Jurisdictions",
    params: [{ name: "jurisdictionCode", placeholder: '"IN"', type: "string" }],
    description: "Months to repossession at P90 for a jurisdiction (ISO code)",
    example: '=AER.REPO_P90("IN")',
  },
  {
    id: "AER.REPO_COST", group: "Jurisdictions",
    params: [{ name: "jurisdictionCode", placeholder: '"IN"', type: "string" }],
    description: "Repossession cost as % of aircraft value (decimal)",
    example: '=AER.REPO_COST("IN")',
  },
  {
    id: "AER.CTC_SCORE", group: "Jurisdictions",
    params: [{ name: "jurisdictionCode", placeholder: '"IN"', type: "string" }],
    description: "Cape Town Convention compliance score 0–100",
    example: '=AER.CTC_SCORE("IN")',
  },
  // ── Portfolio & KPIs ──────────────────────────────────────────────────────
  {
    id: "AER.BEHAVIOR_SCORE", group: "Portfolio & KPIs",
    params: [{ name: "lesseeId", placeholder: '"indigo-airlines"', type: "string" }],
    description: "OCPI behavior score 0–100 (0 = worst)",
    example: '=AER.BEHAVIOR_SCORE("indigo-airlines")',
  },
  {
    id: "AER.WATCHLIST_STATUS", group: "Portfolio & KPIs",
    params: [{ name: "lesseeId", placeholder: '"indigo-airlines"', type: "string" }],
    description: 'Watchlist status: "GREEN", "AMBER", or "RED"',
    example: '=AER.WATCHLIST_STATUS("indigo-airlines")',
  },
  {
    id: "AER.LESSEE_STAGE", group: "Portfolio & KPIs",
    params: [{ name: "lesseeId", placeholder: '"indigo-airlines"', type: "string" }],
    description: "Worst IFRS 9 stage across all leases for a lessee",
    example: '=AER.LESSEE_STAGE("indigo-airlines")',
  },
  {
    id: "AER.LESSEE_ECL", group: "Portfolio & KPIs",
    params: [
      { name: "lesseeId", placeholder: '"indigo-airlines"', type: "string" },
      { name: "scenario", placeholder: '"Baseline"',        type: "string" },
    ],
    description: "Total ECL in $M across all leases for a lessee",
    example: '=AER.LESSEE_ECL("indigo-airlines","Baseline")',
  },
  {
    id: "AER.MARKET_VALUE", group: "Portfolio & KPIs",
    params: [{ name: "msn", placeholder: '"9218"', type: "string" }],
    description: "Half-life market value in $M for an aircraft by MSN",
    example: '=AER.MARKET_VALUE("9218")',
  },
  {
    id: "AER.ENCUMBERED_VALUE", group: "Portfolio & KPIs",
    params: [{ name: "msn", placeholder: '"9218"', type: "string" }],
    description: "Lease-encumbered value (LEV) in $M by MSN",
    example: '=AER.ENCUMBERED_VALUE("9218")',
  },
  {
    id: "AER.KPI", group: "Portfolio & KPIs",
    params: [
      { name: "metricName", placeholder: '"portfolio_ecl"', type: "string" },
      { name: "asOfDate",   placeholder: '"2026-04-29"',    type: "string" },
    ],
    description: "Named portfolio KPI: portfolio_ecl | book_value | encumbered_value | avg_lease_term | ecl_rate | watchlist_red_count | watchlist_amber_count",
    example: '=AER.KPI("portfolio_ecl","2026-04-29")',
  },
];

const FN_GROUPS: FnGroup[] = ["ECL & Risk", "Maintenance & SD", "Jurisdictions", "Portfolio & KPIs"];

const KPI_METRICS = [
  { metric: "portfolio_ecl",        label: "Portfolio ECL",    fmt: (v: number) => `$${v.toFixed(1)}M` },
  { metric: "ecl_rate",             label: "ECL Rate",         fmt: (v: number) => `${v.toFixed(2)}%` },
  { metric: "book_value",           label: "Book Value",       fmt: (v: number) => `$${(v / 1000).toFixed(2)}B` },
  { metric: "watchlist_red_count",  label: "Watchlist Red",    fmt: (v: number) => String(v) },
  { metric: "watchlist_amber_count",label: "Watchlist Amber",  fmt: (v: number) => String(v) },
] as const;

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Dot({ color }: { color: string }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: color, flexShrink: 0,
    }}/>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      overflow: "hidden",
      ...style,
    }}>
      {children}
    </div>
  );
}

function CollapsibleHeader({
  label, open, onToggle, action,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", cursor: "pointer", userSelect: "none",
        background: C.bg, borderBottom: open ? `1px solid ${C.border}` : "none",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
        color: C.muted, textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {action}
        <span style={{
          fontSize: 11, color: C.subtle,
          transform: open ? "rotate(90deg)" : "none",
          display: "inline-block", transition: "transform 150ms ease-out",
        }}>›</span>
      </div>
    </div>
  );
}

/* ── Section 1: Connection Status ────────────────────────────────────────── */

type ConnState = "checking" | "connected" | "auth" | "error";

function ConnectionStatus({ token, onSignIn, onSignOut }: {
  token: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const [state, setState]   = useState<ConnState>("checking");
  const [tenant, setTenant] = useState<string>("");

  const ping = useCallback(async () => {
    if (!token) { setState("auth"); return; }
    setState("checking");
    try {
      const data = await addinFetch("/excel/ping");
      setTenant(data.tenant ?? "");
      setState("connected");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setState(msg === "AUTH" ? "auth" : "error");
    }
  }, [token]);

  // Ping on mount and every 60s
  useEffect(() => { void ping(); }, [ping]);
  useEffect(() => {
    const id = setInterval(() => void ping(), 60_000);
    return () => clearInterval(id);
  }, [ping]);

  return (
    <Card>
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {state === "checking" ? (
            <Dot color={C.subtle}/>
          ) : state === "connected" ? (
            <Dot color={C.success}/>
          ) : (
            <Dot color={C.danger}/>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: C.text }}>
            {state === "checking"  && "Checking connection…"}
            {state === "connected" && `Connected · ${tenant || "Aeroinsights"}`}
            {state === "auth"      && "Not signed in"}
            {state === "error"     && "Connection error"}
          </span>
        </div>

        {state === "auth" && (
          <button
            onClick={onSignIn}
            style={{
              background: C.blue, color: "#fff", border: "none",
              borderRadius: 6, padding: "5px 12px", fontSize: 11,
              fontWeight: 600, cursor: "pointer",
            }}
          >
            Sign In
          </button>
        )}

        {state === "connected" && (
          <button
            onClick={onSignOut}
            style={{
              background: "transparent", color: C.muted, border: `1px solid ${C.border}`,
              borderRadius: 6, padding: "4px 10px", fontSize: 11,
              fontWeight: 500, cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        )}
      </div>

      {state === "auth" && (
        <div style={{
          padding: "8px 14px 12px", borderTop: `1px solid ${C.border}`,
          background: "#FFF7ED",
        }}>
          <p style={{ fontSize: 11, color: "#92400E", lineHeight: 1.5 }}>
            Open the Aeroinsights app at{" "}
            <a href="https://app.aerinsights.com" target="_blank" rel="noreferrer"
               style={{ color: C.blue }}>app.aerinsights.com</a>,
            then click <strong>Sign In</strong> above to link your session.
          </p>
        </div>
      )}
    </Card>
  );
}

/* ── Section 2: Quick Reference KPIs ────────────────────────────────────── */

interface KpiRow { label: string; value: string; }

function QuickReference({ token }: { token: string | null }) {
  const [open, setOpen]       = useState(true);
  const [rows, setRows]       = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const today = new Date(2026, 4, 6).toISOString().slice(0, 10);
    try {
      const settled = await Promise.allSettled(
        KPI_METRICS.map(m =>
          addinFetch(`/excel/kpi?metric=${m.metric}&as_of=${today}`)
        )
      );
      const result: KpiRow[] = KPI_METRICS.map((m, i) => {
        const s = settled[i];
        const val = s.status === "fulfilled" ? m.fmt(s.value.value) : "—";
        return { label: m.label, value: val };
      });
      setRows(result);
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Card>
      <CollapsibleHeader
        label="Quick Reference"
        open={open}
        onToggle={() => setOpen(p => !p)}
        action={
          <button
            onClick={e => { e.stopPropagation(); void load(); }}
            disabled={loading || !token}
            style={{
              background: "transparent", border: `1px solid ${C.border}`,
              borderRadius: 5, padding: "2px 8px", fontSize: 10,
              fontWeight: 600, color: C.muted, cursor: "pointer",
            }}
          >
            {loading ? "…" : "Refresh"}
          </button>
        }
      />

      {open && (
        <div style={{ padding: "0 0 6px" }}>
          {!token ? (
            <p style={{ fontSize: 11, color: C.muted, padding: "12px 14px" }}>
              Sign in to load portfolio KPIs.
            </p>
          ) : rows.length === 0 && loading ? (
            <p style={{ fontSize: 11, color: C.muted, padding: "12px 14px" }}>Loading…</p>
          ) : (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "7px 14px", fontSize: 11, color: C.muted, width: "55%" }}>
                        {row.label}
                      </td>
                      <td style={{
                        padding: "7px 14px", fontSize: 12, fontWeight: 600,
                        color: C.text, textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {updatedAt && (
                <p style={{ fontSize: 10, color: C.subtle, padding: "6px 14px 0" }}>
                  Last updated: {updatedAt}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── Section 3: Function Reference ──────────────────────────────────────── */

function FunctionReference() {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = query.trim()
    ? FUNCTIONS.filter(f =>
        f.id.toLowerCase().includes(query.toLowerCase()) ||
        f.description.toLowerCase().includes(query.toLowerCase())
      )
    : FUNCTIONS;

  const copyFn = (fn: AerFunction) => {
    navigator.clipboard.writeText(fn.example).then(() => {
      setCopied(fn.id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <Card>
      <CollapsibleHeader label="Function Reference" open={open} onToggle={() => setOpen(p => !p)}/>

      {open && (
        <div>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search functions…"
              style={{
                width: "100%", padding: "6px 10px",
                border: `1px solid ${C.border}`, borderRadius: 6,
                fontSize: 12, color: C.text, outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          {FN_GROUPS.map(group => {
            const fns = filtered.filter(f => f.group === group);
            if (fns.length === 0) return null;
            return (
              <div key={group}>
                <div style={{
                  padding: "6px 14px", fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.06em", color: C.subtle, textTransform: "uppercase",
                  background: C.bgBlue, borderBottom: `1px solid ${C.border}`,
                  borderTop: `1px solid ${C.border}`,
                }}>
                  {group}
                </div>
                {fns.map(fn => (
                  <div
                    key={fn.id}
                    onClick={() => copyFn(fn)}
                    style={{
                      padding: "9px 14px", borderBottom: `1px solid ${C.border}`,
                      cursor: "pointer", display: "flex", justifyContent: "space-between",
                      alignItems: "flex-start", gap: 8,
                      transition: "background 100ms ease-out",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.bgCard)}
                    onMouseLeave={e => (e.currentTarget.style.background = C.bg)}
                  >
                    <div>
                      <div style={{
                        fontFamily: C.mono, fontSize: 11,
                        fontWeight: 600, color: C.blue, marginBottom: 2,
                      }}>
                        ={fn.id}(
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
                        {fn.description}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, color: copied === fn.id ? C.success : C.subtle,
                      flexShrink: 0, fontWeight: 600, marginTop: 1,
                      transition: "color 100ms ease-out",
                    }}>
                      {copied === fn.id ? "Copied!" : "Copy"}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ── Section 4: Insert Helper ────────────────────────────────────────────── */

function InsertHelper() {
  const [selectedId, setSelectedId] = useState<string>("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [copiedFormula, setCopiedFormula] = useState(false);

  const selectedFn = FUNCTIONS.find(f => f.id === selectedId) ?? null;

  const handleFnSelect = (id: string) => {
    setSelectedId(id);
    setParamValues({});
    setStatus(null);
  };

  const buildFormula = (): string => {
    if (!selectedFn) return "";
    const args = selectedFn.params.map(p => {
      const val = paramValues[p.name] ?? "";
      return p.type === "number" ? (val || "0") : `"${val}"`;
    });
    return `=${selectedFn.id}(${args.join(",")})`;
  };

  const formula = buildFormula();
  const isReady = selectedFn !== null &&
    selectedFn.params.every(p => (paramValues[p.name] ?? "").trim() !== "");

  const insertIntoCell = async () => {
    if (!isReady) return;
    try {
      /* ── Correct API: Excel.run with range.formulas (not setSelectedDataAsync) ── */
      await Excel.run(async (context) => {
        const range = context.workbook.getSelectedRange();
        range.formulas = [[formula]];
        await context.sync();
      });
      setStatus({ type: "success", msg: "Inserted into active cell." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Insert failed";
      setStatus({ type: "error", msg });
    }
    setTimeout(() => setStatus(null), 3000);
  };

  const copyFormula = () => {
    if (!formula) return;
    navigator.clipboard.writeText(formula).then(() => {
      setCopiedFormula(true);
      setTimeout(() => setCopiedFormula(false), 1500);
    });
  };

  return (
    <Card>
      <CollapsibleHeader label="Insert Helper" open onToggle={() => {}}/>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Function picker */}
        <select
          value={selectedId}
          onChange={e => handleFnSelect(e.target.value)}
          style={{
            width: "100%", padding: "7px 10px",
            border: `1px solid ${C.border}`, borderRadius: 6,
            fontSize: 12, color: selectedId ? C.text : C.subtle,
            background: C.bg, fontFamily: "inherit", outline: "none",
          }}
        >
          <option value="">Select function…</option>
          {FN_GROUPS.map(g => (
            <optgroup key={g} label={g}>
              {FUNCTIONS.filter(f => f.group === g).map(f => (
                <option key={f.id} value={f.id}>{f.id}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Parameter inputs */}
        {selectedFn && selectedFn.params.map(p => (
          <div key={p.name}>
            <label style={{
              display: "block", fontSize: 10, fontWeight: 600,
              color: C.muted, marginBottom: 4, textTransform: "capitalize",
            }}>
              {p.name.replace(/([A-Z])/g, " $1").toLowerCase()}
            </label>
            <input
              value={paramValues[p.name] ?? ""}
              onChange={e => setParamValues(prev => ({ ...prev, [p.name]: e.target.value }))}
              placeholder={p.placeholder}
              style={{
                width: "100%", padding: "6px 10px",
                border: `1px solid ${C.border}`, borderRadius: 6,
                fontSize: 12, color: C.text, fontFamily: "inherit", outline: "none",
              }}
            />
          </div>
        ))}

        {/* Formula preview */}
        {formula && (
          <div style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "6px 10px",
            fontFamily: C.mono, fontSize: 11,
            color: C.blue, wordBreak: "break-all",
          }}>
            {formula}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => void insertIntoCell()}
            disabled={!isReady}
            style={{
              flex: 1, background: isReady ? C.blue : C.border,
              color: isReady ? "#fff" : C.subtle,
              border: "none", borderRadius: 6, padding: "8px 12px",
              fontSize: 12, fontWeight: 600,
              cursor: isReady ? "pointer" : "not-allowed",
              transition: "background 150ms ease-out",
            }}
          >
            Insert into Cell
          </button>
          <button
            onClick={copyFormula}
            disabled={!formula}
            style={{
              background: "transparent", border: `1px solid ${C.border}`,
              borderRadius: 6, padding: "8px 12px", fontSize: 12,
              fontWeight: 600, color: copiedFormula ? C.success : C.muted,
              cursor: formula ? "pointer" : "not-allowed",
            }}
          >
            {copiedFormula ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Status message */}
        {status && (
          <p style={{
            fontSize: 11, margin: 0,
            color: status.type === "success" ? C.success : C.danger,
          }}>
            {status.msg}
          </p>
        )}
      </div>
    </Card>
  );
}

/* ── Root component ──────────────────────────────────────────────────────── */

export default function TaskPane() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY)
  );

  /* Open Auth0 sign-in dialog via Office dialog API */
  const handleSignIn = () => {
    const dialogUrl = `${window.location.origin}/auth-dialog.html`;

    Office.context.ui.displayDialogAsync(
      dialogUrl,
      { height: 55, width: 30, requireHTTPS: true },
      (asyncResult) => {
        if (asyncResult.status === Office.AsyncResultStatus.Failed) {
          console.error("Dialog open failed:", asyncResult.error.message);
          return;
        }
        const dialog = asyncResult.value;
        dialog.addEventHandler(
          Office.EventType.DialogMessageReceived,
          (arg) => {
            try {
              const data = JSON.parse(
                (arg as { message: string }).message
              ) as { access_token?: string; error?: string };

              if (data.access_token) {
                localStorage.setItem(TOKEN_KEY, data.access_token);
                setToken(data.access_token);
              }
            } catch {
              /* ignore parse errors */
            }
            dialog.close();
          }
        );
      }
    );
  };

  const handleSignOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return (
    <div style={{
      maxWidth: 350, margin: "0 auto",
      padding: "12px 10px 24px",
      display: "flex", flexDirection: "column", gap: 10,
      fontFamily: "inherit",
    }}>
      {/* Wordmark */}
      <div style={{
        padding: "8px 4px 4px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: C.blue, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="7" width="3" height="6" fill="white" rx="0.5"/>
            <rect x="5.5" y="4" width="3" height="9" fill="white" rx="0.5"/>
            <rect x="10" y="1" width="3" height="12" fill="white" rx="0.5"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.blue, lineHeight: 1 }}>
            Aeroinsights
          </div>
          <div style={{ fontSize: 10, color: C.subtle, lineHeight: 1, marginTop: 2 }}>
            Decision Platform
          </div>
        </div>
      </div>

      <ConnectionStatus token={token} onSignIn={handleSignIn} onSignOut={handleSignOut}/>
      <QuickReference   token={token}/>
      <FunctionReference/>
      <InsertHelper/>
    </div>
  );
}
