// src/app/components/portfolio-builder/ManualPortfolioWizard.tsx
//
// 7-step manual data entry wizard for "Create Custom Portfolio" (Card 3).
// Steps:
//   1. Portfolio info        (required)
//   2. Fleet (aircraft)      (required, table)
//   3. Lessees               (required, table)
//   4. Leases                (required, table; links aircraft <-> lessees)
//   5. ECL parameters        (optional, with feature-gate warning)
//   6. Security Deposits + MR (optional, with feature-gate warning)
//   7. Review & Create

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowLeft, ArrowRight, Check, Plus, Trash2, AlertTriangle,
  CheckCircle2, Loader2,
} from "lucide-react";
import {
  CURRENCIES, WATCHLIST_STATUSES, IFRS_STAGES,
  type DraftPortfolio, type DraftAircraft, type DraftLessee, type DraftLease,
  type DraftEcl, type DraftSecurityDeposit, type DraftMaintenanceReserve,
  type Currency, type WatchlistStatus, type IfrsStage,
  ECL_GATED_FEATURES, SDMR_GATED_FEATURES,
  emptyDraftPortfolio, newLocalId, validateStep,
} from "./types";
import { saveManualPortfolio, type SaveResult } from "./saveManualPortfolio";

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Portfolio Info",      required: true  },
  { id: 2, label: "Fleet",                required: true  },
  { id: 3, label: "Lessees",              required: true  },
  { id: 4, label: "Leases",               required: true  },
  { id: 5, label: "ECL Parameters",       required: false },
  { id: 6, label: "Security Deposits + MR", required: false },
  { id: 7, label: "Review & Create",      required: true  },
] as const;

// ─── Shared UI primitives ────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid #E2E8F0",
  borderRadius: "6px",
  fontSize: "0.8125rem",
  color: "#0F172A",
  outline: "none",
  background: "#FFFFFF",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.6875rem",
  fontWeight: 700,
  color: "#64748B",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "4px",
};

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  fontSize: "0.6875rem",
  fontWeight: 700,
  color: "#64748B",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  background: "#F8FAFC",
  borderBottom: "1px solid #E2E8F0",
};

const tdStyle: React.CSSProperties = {
  padding: "4px 6px",
  borderBottom: "1px solid #F1F5F9",
  verticalAlign: "middle",
};

function FeatureGateCard({
  title, features, onAddData, onSkip, isSkipped,
}: {
  title: string;
  features: string[];
  onAddData: () => void;
  onSkip: () => void;
  isSkipped: boolean;
}) {
  return (
    <div
      style={{
        background: isSkipped ? "#FEF3C7" : "#FFFBEB",
        border: `1px solid ${isSkipped ? "#FCD34D" : "#FDE68A"}`,
        borderRadius: "10px",
        padding: "16px",
        marginBottom: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <AlertTriangle size={18} style={{ color: "#B45309", flexShrink: 0, marginTop: "1px" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0F172A", marginBottom: "4px" }}>
            {title}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#475569", marginBottom: "10px" }}>
            If you skip this step, the following features won&rsquo;t be available until you add the data later:
          </div>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.8125rem", color: "#475569" }}>
            {features.map((f) => (
              <li key={f} style={{ marginBottom: "3px" }}>{f}</li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button
              onClick={onAddData}
              style={{
                padding: "6px 12px", background: "#002147", color: "#FFFFFF",
                border: "none", borderRadius: "6px", fontWeight: 600,
                fontSize: "0.75rem", cursor: "pointer",
              }}
            >
              Add data
            </button>
            <button
              onClick={onSkip}
              style={{
                padding: "6px 12px", background: isSkipped ? "#FCD34D" : "transparent",
                color: isSkipped ? "#78350F" : "#475569",
                border: `1px solid ${isSkipped ? "#FCD34D" : "#E2E8F0"}`,
                borderRadius: "6px", fontWeight: 500, fontSize: "0.75rem", cursor: "pointer",
              }}
            >
              {isSkipped ? "Skipped (click to undo)" : "Skip for now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableTable({
  columns, rows, onAdd, onRemove, addLabel,
}: {
  columns: { key: string; label: string; width?: string }[];
  rows: React.ReactNode[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  addLabel: string;
}) {
  return (
    <div>
      <div
        style={{
          border: "1px solid #E2E8F0",
          borderRadius: "8px",
          overflow: "hidden",
          background: "#FFFFFF",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ ...thStyle, width: c.width }}>
                  {c.label}
                </th>
              ))}
              <th style={{ ...thStyle, width: "44px" }}> </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} style={{ padding: "20px", textAlign: "center", color: "#94A3B8", fontSize: "0.8125rem" }}>
                  No rows yet — click &ldquo;{addLabel}&rdquo; to add one.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx}>
                  {row}
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button
                      onClick={() => onRemove(idx)}
                      style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        color: "#94A3B8", display: "inline-flex", padding: "4px",
                      }}
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        onClick={onAdd}
        style={{
          marginTop: "10px",
          display: "inline-flex", alignItems: "center", gap: "5px",
          padding: "6px 12px", background: "#FFFFFF", color: "#002147",
          border: "1px solid #002147", borderRadius: "6px",
          fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
        }}
      >
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  );
}

// ─── Step components ─────────────────────────────────────────────────────────

function PortfolioInfoStep({
  draft, setDraft,
}: {
  draft: DraftPortfolio;
  setDraft: React.Dispatch<React.SetStateAction<DraftPortfolio>>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <label style={labelStyle}>Portfolio name <span style={{ color: "#B91C1C" }}>*</span></label>
        <input
          type="text" value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="e.g. Q2 2026 Active Fleet"
          style={{ ...inputStyle, fontSize: "0.9375rem", padding: "10px 12px" }}
        />
      </div>
      <div>
        <label style={labelStyle}>Base currency</label>
        <select
          value={draft.base_currency}
          onChange={(e) => setDraft((d) => ({ ...d, base_currency: e.target.value as Currency }))}
          style={{ ...inputStyle, fontSize: "0.9375rem", padding: "10px 12px", cursor: "pointer" }}
        >
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Description (optional)</label>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="A short note to help your team recognise this portfolio later."
          rows={3}
          style={{ ...inputStyle, fontSize: "0.875rem", padding: "10px 12px", resize: "vertical", minHeight: "70px" }}
        />
      </div>
    </div>
  );
}

function FleetStep({
  draft, setDraft,
}: {
  draft: DraftPortfolio;
  setDraft: React.Dispatch<React.SetStateAction<DraftPortfolio>>;
}) {
  function update(idx: number, patch: Partial<DraftAircraft>) {
    setDraft((d) => ({
      ...d,
      aircraft: d.aircraft.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  }
  function add() {
    setDraft((d) => ({
      ...d,
      aircraft: [...d.aircraft, {
        _localId: newLocalId("ac"),
        registration: "", msn: "", aircraft_type: "",
        manufacturer: "", vintage: "", current_operator: "", country: "",
      }],
    }));
  }
  function remove(idx: number) {
    setDraft((d) => ({ ...d, aircraft: d.aircraft.filter((_, i) => i !== idx) }));
  }

  const columns = [
    { key: "reg",  label: "Registration *", width: "14%" },
    { key: "msn",  label: "MSN *",          width: "12%" },
    { key: "type", label: "Type *",         width: "16%" },
    { key: "man",  label: "Manufacturer",   width: "16%" },
    { key: "vin",  label: "Vintage",        width: "12%" },
    { key: "op",   label: "Operator",       width: "16%" },
    { key: "co",   label: "Country",        width: "10%" },
  ];

  const rows = draft.aircraft.map((a, idx) => (
    <React.Fragment key={a._localId}>
      <td style={tdStyle}>
        <input style={inputStyle} value={a.registration} placeholder="VT-IYC"
          onChange={(e) => update(idx, { registration: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={a.msn} placeholder="9218"
          onChange={(e) => update(idx, { msn: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={a.aircraft_type} placeholder="A320neo"
          onChange={(e) => update(idx, { aircraft_type: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={a.manufacturer} placeholder="Airbus"
          onChange={(e) => update(idx, { manufacturer: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={a.vintage} placeholder="2019" inputMode="numeric"
          onChange={(e) => update(idx, { vintage: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={a.current_operator} placeholder="IndiGo"
          onChange={(e) => update(idx, { current_operator: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={a.country} placeholder="India"
          onChange={(e) => update(idx, { country: e.target.value })} />
      </td>
    </React.Fragment>
  ));

  return (
    <div>
      <div style={{ fontSize: "0.8125rem", color: "#475569", marginBottom: "12px" }}>
        Add every aircraft in this portfolio. Required: <strong>Registration</strong>, <strong>MSN</strong>, <strong>Type</strong>.
      </div>
      <EditableTable columns={columns} rows={rows} onAdd={add} onRemove={remove} addLabel="Add aircraft" />
    </div>
  );
}

function LesseesStep({
  draft, setDraft,
}: {
  draft: DraftPortfolio;
  setDraft: React.Dispatch<React.SetStateAction<DraftPortfolio>>;
}) {
  function update(idx: number, patch: Partial<DraftLessee>) {
    setDraft((d) => ({
      ...d,
      lessees: d.lessees.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }
  function add() {
    setDraft((d) => ({
      ...d,
      lessees: [...d.lessees, {
        _localId: newLocalId("le"),
        name: "", iata_code: "", country: "", region: "",
        credit_rating: "", pd_estimate: "", watchlist_status: "",
      }],
    }));
  }
  function remove(idx: number) {
    setDraft((d) => ({ ...d, lessees: d.lessees.filter((_, i) => i !== idx) }));
  }

  const columns = [
    { key: "name", label: "Name *",          width: "22%" },
    { key: "iata", label: "IATA",            width: "8%"  },
    { key: "co",   label: "Country",         width: "14%" },
    { key: "rg",   label: "Region",          width: "12%" },
    { key: "cr",   label: "Credit rating",   width: "14%" },
    { key: "pd",   label: "PD (0–1)",        width: "10%" },
    { key: "wl",   label: "Watchlist",       width: "16%" },
  ];

  const rows = draft.lessees.map((l, idx) => (
    <React.Fragment key={l._localId}>
      <td style={tdStyle}>
        <input style={inputStyle} value={l.name} placeholder="IndiGo Airlines"
          onChange={(e) => update(idx, { name: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={l.iata_code} placeholder="6E"
          onChange={(e) => update(idx, { iata_code: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={l.country} placeholder="India"
          onChange={(e) => update(idx, { country: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={l.region} placeholder="APAC"
          onChange={(e) => update(idx, { region: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={l.credit_rating} placeholder="BB-"
          onChange={(e) => update(idx, { credit_rating: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={l.pd_estimate} placeholder="0.12" inputMode="decimal"
          onChange={(e) => update(idx, { pd_estimate: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={l.watchlist_status}
          onChange={(e) => update(idx, { watchlist_status: e.target.value as WatchlistStatus | "" })}>
          <option value="">—</option>
          {WATCHLIST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
    </React.Fragment>
  ));

  return (
    <div>
      <div style={{ fontSize: "0.8125rem", color: "#475569", marginBottom: "12px" }}>
        Add every airline / lessee in the portfolio. Required: <strong>Name</strong>.
      </div>
      <EditableTable columns={columns} rows={rows} onAdd={add} onRemove={remove} addLabel="Add lessee" />
    </div>
  );
}

function LeasesStep({
  draft, setDraft,
}: {
  draft: DraftPortfolio;
  setDraft: React.Dispatch<React.SetStateAction<DraftPortfolio>>;
}) {
  function update(idx: number, patch: Partial<DraftLease>) {
    setDraft((d) => ({
      ...d,
      leases: d.leases.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }
  function add() {
    setDraft((d) => ({
      ...d,
      leases: [...d.leases, {
        _localId: newLocalId("ls"),
        aircraftLocalId: "", lesseeLocalId: "",
        start_date: "", end_date: "",
        monthly_rental: "", currency: d.base_currency, stage: null,
      }],
    }));
  }
  function remove(idx: number) {
    setDraft((d) => ({ ...d, leases: d.leases.filter((_, i) => i !== idx) }));
  }

  const noAircraft = draft.aircraft.length === 0;
  const noLessees  = draft.lessees.length === 0;

  if (noAircraft || noLessees) {
    return (
      <div style={{
        padding: "16px", background: "#FEF2F2", border: "1px solid #FECACA",
        borderRadius: "8px", fontSize: "0.8125rem", color: "#B91C1C",
      }}>
        Add at least one aircraft and one lessee in the previous steps before creating leases.
      </div>
    );
  }

  const columns = [
    { key: "ac",   label: "Aircraft *",     width: "18%" },
    { key: "le",   label: "Lessee *",       width: "18%" },
    { key: "sd",   label: "Start date *",   width: "13%" },
    { key: "ed",   label: "End date *",     width: "13%" },
    { key: "rent", label: "Monthly rent",   width: "13%" },
    { key: "cur",  label: "Currency",       width: "10%" },
    { key: "stg",  label: "IFRS Stage",     width: "10%" },
  ];

  const rows = draft.leases.map((ls, idx) => (
    <React.Fragment key={ls._localId}>
      <td style={tdStyle}>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={ls.aircraftLocalId}
          onChange={(e) => update(idx, { aircraftLocalId: e.target.value })}>
          <option value="">— pick —</option>
          {draft.aircraft.map((a) => (
            <option key={a._localId} value={a._localId}>
              {a.registration || a.msn || "(unnamed)"}{a.aircraft_type ? ` · ${a.aircraft_type}` : ""}
            </option>
          ))}
        </select>
      </td>
      <td style={tdStyle}>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={ls.lesseeLocalId}
          onChange={(e) => update(idx, { lesseeLocalId: e.target.value })}>
          <option value="">— pick —</option>
          {draft.lessees.map((l) => (
            <option key={l._localId} value={l._localId}>{l.name || "(unnamed)"}</option>
          ))}
        </select>
      </td>
      <td style={tdStyle}>
        <input type="date" style={inputStyle} value={ls.start_date}
          onChange={(e) => update(idx, { start_date: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input type="date" style={inputStyle} value={ls.end_date}
          onChange={(e) => update(idx, { end_date: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <input style={inputStyle} value={ls.monthly_rental} placeholder="285000" inputMode="numeric"
          onChange={(e) => update(idx, { monthly_rental: e.target.value })} />
      </td>
      <td style={tdStyle}>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={ls.currency}
          onChange={(e) => update(idx, { currency: e.target.value as Currency })}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td style={tdStyle}>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={ls.stage ?? ""}
          onChange={(e) => update(idx, { stage: e.target.value ? Number(e.target.value) as IfrsStage : null })}>
          <option value="">—</option>
          {IFRS_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
    </React.Fragment>
  ));

  return (
    <div>
      <div style={{ fontSize: "0.8125rem", color: "#475569", marginBottom: "12px" }}>
        Link each aircraft to its lessee. Required: <strong>Aircraft</strong>, <strong>Lessee</strong>, <strong>Start</strong>, <strong>End</strong>.
      </div>
      <EditableTable columns={columns} rows={rows} onAdd={add} onRemove={remove} addLabel="Add lease" />
    </div>
  );
}

function EclStep({
  draft, setDraft,
}: {
  draft: DraftPortfolio;
  setDraft: React.Dispatch<React.SetStateAction<DraftPortfolio>>;
}) {
  const showAdd = !draft.skipEcl;

  // Auto-seed one ECL row per lease the first time the user enters this step
  // with "Add data" selected, so they don't start with an empty table.
  React.useEffect(() => {
    if (showAdd && draft.ecl.length === 0 && draft.leases.length > 0) {
      setDraft((d) => ({
        ...d,
        ecl: d.leases.map((l) => ({
          _localId: newLocalId("ec"),
          leaseLocalId: l._localId,
          stage: l.stage, pd: "", lgd: "", ead: "", ecl_amount: "",
        })),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd]);

  function update(idx: number, patch: Partial<DraftEcl>) {
    setDraft((d) => ({
      ...d,
      ecl: d.ecl.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  }

  function leaseLabel(ls: DraftLease | undefined): string {
    if (!ls) return "—";
    const ac = draft.aircraft.find((a) => a._localId === ls.aircraftLocalId);
    const le = draft.lessees.find((l) => l._localId === ls.lesseeLocalId);
    return `${ac?.registration ?? "?"} · ${le?.name ?? "?"}`;
  }

  return (
    <div>
      <FeatureGateCard
        title="ECL Parameters (IFRS 9)"
        features={ECL_GATED_FEATURES}
        isSkipped={draft.skipEcl}
        onAddData={() => setDraft((d) => ({ ...d, skipEcl: false }))}
        onSkip={() => setDraft((d) => ({ ...d, skipEcl: !d.skipEcl, ecl: d.skipEcl ? d.ecl : [] }))}
      />

      {showAdd && (
        <div>
          <div style={{ fontSize: "0.8125rem", color: "#475569", marginBottom: "10px" }}>
            One row per lease. PD and LGD are fractions between 0 and 1. EAD and ECL are USD amounts.
          </div>
          <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden", background: "#FFFFFF" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: "26%" }}>Lease</th>
                  <th style={{ ...thStyle, width: "10%" }}>Stage</th>
                  <th style={{ ...thStyle, width: "12%" }}>PD</th>
                  <th style={{ ...thStyle, width: "12%" }}>LGD</th>
                  <th style={{ ...thStyle, width: "20%" }}>EAD ($)</th>
                  <th style={{ ...thStyle, width: "20%" }}>ECL ($)</th>
                </tr>
              </thead>
              <tbody>
                {draft.ecl.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#94A3B8", fontSize: "0.8125rem" }}>No leases to score yet.</td></tr>
                ) : draft.ecl.map((e, idx) => {
                  const lease = draft.leases.find((l) => l._localId === e.leaseLocalId);
                  return (
                    <tr key={e._localId}>
                      <td style={{ ...tdStyle, fontSize: "0.8125rem", color: "#0F172A", fontWeight: 500, padding: "10px" }}>
                        {leaseLabel(lease)}
                      </td>
                      <td style={tdStyle}>
                        <select style={{ ...inputStyle, cursor: "pointer" }} value={e.stage ?? ""}
                          onChange={(ev) => update(idx, { stage: ev.target.value ? Number(ev.target.value) as IfrsStage : null })}>
                          <option value="">—</option>
                          {IFRS_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={tdStyle}><input style={inputStyle} value={e.pd}  placeholder="0.12" inputMode="decimal" onChange={(ev) => update(idx, { pd:  ev.target.value })} /></td>
                      <td style={tdStyle}><input style={inputStyle} value={e.lgd} placeholder="0.45" inputMode="decimal" onChange={(ev) => update(idx, { lgd: ev.target.value })} /></td>
                      <td style={tdStyle}><input style={inputStyle} value={e.ead} placeholder="24200000" inputMode="numeric" onChange={(ev) => update(idx, { ead: ev.target.value })} /></td>
                      <td style={tdStyle}><input style={inputStyle} value={e.ecl_amount} placeholder="4200000" inputMode="numeric" onChange={(ev) => update(idx, { ecl_amount: ev.target.value })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SdMrStep({
  draft, setDraft,
}: {
  draft: DraftPortfolio;
  setDraft: React.Dispatch<React.SetStateAction<DraftPortfolio>>;
}) {
  const showAdd = !draft.skipSdMr;

  React.useEffect(() => {
    if (showAdd && draft.deposits.length === 0 && draft.leases.length > 0) {
      setDraft((d) => ({
        ...d,
        deposits: d.leases.map((l) => ({
          _localId: newLocalId("sd"),
          leaseLocalId: l._localId,
          deposit_months: "", deposit_amount_usd: "", type: "cash",
        })),
        reserves: d.leases.map((l) => ({
          _localId: newLocalId("mr"),
          leaseLocalId: l._localId,
          component: "Engine PR", rate_usd: "", cumulative_balance_usd: "", refundable: true,
        })),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd]);

  function updateDeposit(idx: number, patch: Partial<DraftSecurityDeposit>) {
    setDraft((d) => ({ ...d, deposits: d.deposits.map((x, i) => (i === idx ? { ...x, ...patch } : x)) }));
  }
  function updateReserve(idx: number, patch: Partial<DraftMaintenanceReserve>) {
    setDraft((d) => ({ ...d, reserves: d.reserves.map((x, i) => (i === idx ? { ...x, ...patch } : x)) }));
  }

  function leaseLabel(lid: string): string {
    const ls = draft.leases.find((l) => l._localId === lid);
    if (!ls) return "—";
    const ac = draft.aircraft.find((a) => a._localId === ls.aircraftLocalId);
    const le = draft.lessees.find((l) => l._localId === ls.lesseeLocalId);
    return `${ac?.registration ?? "?"} · ${le?.name ?? "?"}`;
  }

  return (
    <div>
      <FeatureGateCard
        title="Security Deposits + Maintenance Reserves"
        features={SDMR_GATED_FEATURES}
        isSkipped={draft.skipSdMr}
        onAddData={() => setDraft((d) => ({ ...d, skipSdMr: false }))}
        onSkip={() => setDraft((d) => ({ ...d, skipSdMr: !d.skipSdMr, deposits: d.skipSdMr ? d.deposits : [], reserves: d.skipSdMr ? d.reserves : [] }))}
      />

      {showAdd && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Security Deposits */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Security Deposits
            </div>
            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden", background: "#FFFFFF" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: "32%" }}>Lease</th>
                    <th style={{ ...thStyle, width: "18%" }}>Months</th>
                    <th style={{ ...thStyle, width: "30%" }}>Amount ($)</th>
                    <th style={{ ...thStyle, width: "20%" }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.deposits.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: "16px", textAlign: "center", color: "#94A3B8", fontSize: "0.8125rem" }}>No data.</td></tr>
                  ) : draft.deposits.map((d, idx) => (
                    <tr key={d._localId}>
                      <td style={{ ...tdStyle, fontSize: "0.8125rem", padding: "10px" }}>{leaseLabel(d.leaseLocalId)}</td>
                      <td style={tdStyle}><input style={inputStyle} value={d.deposit_months} placeholder="3" inputMode="decimal" onChange={(e) => updateDeposit(idx, { deposit_months: e.target.value })} /></td>
                      <td style={tdStyle}><input style={inputStyle} value={d.deposit_amount_usd} placeholder="855000" inputMode="numeric" onChange={(e) => updateDeposit(idx, { deposit_amount_usd: e.target.value })} /></td>
                      <td style={tdStyle}>
                        <select style={{ ...inputStyle, cursor: "pointer" }} value={d.type} onChange={(e) => updateDeposit(idx, { type: e.target.value })}>
                          <option value="cash">cash</option>
                          <option value="letter_of_credit">letter of credit</option>
                          <option value="guarantee">guarantee</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maintenance Reserves */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Maintenance Reserves
            </div>
            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden", background: "#FFFFFF" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: "30%" }}>Lease</th>
                    <th style={{ ...thStyle, width: "20%" }}>Component</th>
                    <th style={{ ...thStyle, width: "18%" }}>Rate ($)</th>
                    <th style={{ ...thStyle, width: "22%" }}>Balance ($)</th>
                    <th style={{ ...thStyle, width: "10%" }}>Refundable</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.reserves.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: "16px", textAlign: "center", color: "#94A3B8", fontSize: "0.8125rem" }}>No data.</td></tr>
                  ) : draft.reserves.map((r, idx) => (
                    <tr key={r._localId}>
                      <td style={{ ...tdStyle, fontSize: "0.8125rem", padding: "10px" }}>{leaseLabel(r.leaseLocalId)}</td>
                      <td style={tdStyle}>
                        <select style={{ ...inputStyle, cursor: "pointer" }} value={r.component} onChange={(e) => updateReserve(idx, { component: e.target.value })}>
                          <option>Engine PR</option>
                          <option>APU</option>
                          <option>Landing Gear</option>
                          <option>Airframe</option>
                          <option>LLP</option>
                        </select>
                      </td>
                      <td style={tdStyle}><input style={inputStyle} value={r.rate_usd} placeholder="350" inputMode="numeric" onChange={(e) => updateReserve(idx, { rate_usd: e.target.value })} /></td>
                      <td style={tdStyle}><input style={inputStyle} value={r.cumulative_balance_usd} placeholder="1200000" inputMode="numeric" onChange={(e) => updateReserve(idx, { cumulative_balance_usd: e.target.value })} /></td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <input type="checkbox" checked={r.refundable} onChange={(e) => updateReserve(idx, { refundable: e.target.checked })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewStep({ draft }: { draft: DraftPortfolio }) {
  const skipNotes: string[] = [];
  if (draft.skipEcl) skipNotes.push(...ECL_GATED_FEATURES);
  if (draft.skipSdMr) skipNotes.push(...SDMR_GATED_FEATURES);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{
        background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: "10px",
        padding: "16px",
      }}>
        <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A", marginBottom: "10px" }}>
          {draft.name || "(unnamed portfolio)"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", fontSize: "0.8125rem" }}>
          <div><div style={{ color: "#64748B" }}>Aircraft</div><div style={{ fontWeight: 700, color: "#0F172A", fontSize: "1.125rem" }}>{draft.aircraft.length}</div></div>
          <div><div style={{ color: "#64748B" }}>Lessees</div><div style={{ fontWeight: 700, color: "#0F172A", fontSize: "1.125rem" }}>{draft.lessees.length}</div></div>
          <div><div style={{ color: "#64748B" }}>Leases</div><div style={{ fontWeight: 700, color: "#0F172A", fontSize: "1.125rem" }}>{draft.leases.length}</div></div>
          <div><div style={{ color: "#64748B" }}>ECL rows</div><div style={{ fontWeight: 700, color: "#0F172A", fontSize: "1.125rem" }}>{draft.skipEcl ? "—" : draft.ecl.length}</div></div>
          <div><div style={{ color: "#64748B" }}>Deposits</div><div style={{ fontWeight: 700, color: "#0F172A", fontSize: "1.125rem" }}>{draft.skipSdMr ? "—" : draft.deposits.length}</div></div>
          <div><div style={{ color: "#64748B" }}>MR rows</div><div style={{ fontWeight: 700, color: "#0F172A", fontSize: "1.125rem" }}>{draft.skipSdMr ? "—" : draft.reserves.length}</div></div>
        </div>
      </div>

      {skipNotes.length > 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <AlertTriangle size={16} style={{ color: "#B45309", flexShrink: 0, marginTop: "1px" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A", marginBottom: "6px" }}>
                You skipped optional data
              </div>
              <div style={{ fontSize: "0.75rem", color: "#475569", marginBottom: "6px" }}>
                These features won&rsquo;t be active until you add the data later via Settings → Portfolio.
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.75rem", color: "#475569" }}>
                {skipNotes.map((n) => <li key={n} style={{ marginBottom: "2px" }}>{n}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
        Click <strong>Create portfolio</strong> below to save this data and open your new dashboard.
      </div>
    </div>
  );
}

// ─── Modal container ─────────────────────────────────────────────────────────

interface ManualPortfolioWizardProps {
  orgId: string;
  onClose: () => void;
  onComplete: (result: SaveResult) => void;
}

export function ManualPortfolioWizard({ orgId, onClose, onComplete }: ManualPortfolioWizardProps) {
  const [step, setStep] = React.useState<number>(1);
  const [draft, setDraft] = React.useState<DraftPortfolio>(emptyDraftPortfolio);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  function tryAdvance() {
    const issues = validateStep(step, draft);
    if (issues.length > 0) {
      setErrors(issues.map((i) => i.message));
      return;
    }
    setErrors([]);
    setStep((s) => Math.min(STEPS.length, s + 1));
  }
  function goBack() {
    setErrors([]);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleCreate() {
    // Final validation across required steps.
    const allIssues = [1, 2, 3, 4].flatMap((s) => validateStep(s, draft));
    if (allIssues.length > 0) {
      setErrors(allIssues.map((i) => `Step ${i.step}: ${i.message}`));
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await saveManualPortfolio(draft, orgId);
      onComplete(result);
    } catch (err) {
      setSaveError((err as Error).message);
      setIsSaving(false);
    }
  }

  const isLastStep = step === STEPS.length;
  const stepDef = STEPS[step - 1];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 500,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        style={{
          background: "#FFFFFF", borderRadius: "14px",
          width: "100%", maxWidth: "1080px", maxHeight: "92vh",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.30)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: "#002147", padding: "18px 24px", color: "#FFFFFF" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.0625rem" }}>Create Custom Portfolio</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.65)", marginTop: "2px" }}>
                Step {step} of {STEPS.length} — {stepDef.label}
                {!stepDef.required && <span style={{ marginLeft: "8px", padding: "1px 7px", background: "rgba(255,255,255,0.15)", borderRadius: "999px", fontSize: "0.6875rem", fontWeight: 600 }}>Optional</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.75)", cursor: "pointer", display: "flex" }}>
              <X size={18} />
            </button>
          </div>
          {/* Progress bar */}
          <div style={{ display: "flex", gap: "5px" }}>
            {STEPS.map((s, i) => (
              <div key={s.id} style={{
                flex: 1, height: "3px", borderRadius: "2px",
                background: i + 1 <= step ? "#FFFFFF" : "rgba(255,255,255,0.20)",
                transition: "background 250ms",
              }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px", minHeight: 0 }}>
          {errors.length > 0 && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px",
              padding: "10px 14px", fontSize: "0.8125rem", color: "#B91C1C", marginBottom: "14px",
            }}>
              <ul style={{ margin: 0, paddingLeft: "18px" }}>
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {saveError && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px",
              padding: "10px 14px", fontSize: "0.8125rem", color: "#B91C1C", marginBottom: "14px",
            }}>
              <strong>Could not save:</strong> {saveError}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {step === 1 && <PortfolioInfoStep draft={draft} setDraft={setDraft} />}
              {step === 2 && <FleetStep draft={draft} setDraft={setDraft} />}
              {step === 3 && <LesseesStep draft={draft} setDraft={setDraft} />}
              {step === 4 && <LeasesStep draft={draft} setDraft={setDraft} />}
              {step === 5 && <EclStep draft={draft} setDraft={setDraft} />}
              {step === 6 && <SdMrStep draft={draft} setDraft={setDraft} />}
              {step === 7 && <ReviewStep draft={draft} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid #E2E8F0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#FAFBFC",
        }}>
          <button
            onClick={goBack}
            disabled={step === 1 || isSaving}
            style={{
              padding: "8px 14px", background: "transparent", color: step === 1 ? "#CBD5E1" : "#475569",
              border: "1px solid #E2E8F0", borderRadius: "8px", fontWeight: 500, fontSize: "0.875rem",
              cursor: step === 1 ? "not-allowed" : "pointer",
              display: "inline-flex", alignItems: "center", gap: "5px",
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          {isLastStep ? (
            <button
              onClick={handleCreate}
              disabled={isSaving}
              style={{
                padding: "9px 18px", background: isSaving ? "#94A3B8" : "#15803D", color: "#FFFFFF",
                border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.875rem",
                cursor: isSaving ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", gap: "6px",
              }}
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {isSaving ? "Creating…" : "Create portfolio"}
            </button>
          ) : (
            <button
              onClick={tryAdvance}
              style={{
                padding: "8px 16px", background: "#002147", color: "#FFFFFF",
                border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "0.875rem",
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px",
              }}
            >
              {step === 4 && (draft.skipEcl || draft.skipSdMr || true) ? "Next" : "Next"} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Inline spin keyframes for the saving spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .animate-spin { animation: spin 1s linear infinite; }`}</style>
    </motion.div>
  );
}
