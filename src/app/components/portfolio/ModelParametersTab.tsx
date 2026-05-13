// src/app/components/portfolio/ModelParametersTab.tsx
import * as React from "react";
import type { Lease, Asset, Lessee, Provision } from "../../types/portfolio";
import {
  updateLease, updateProvision, computeEcl,
  type ProvisionUpdate, type LeaseUpdate,
} from "../../lib/portfolioMutations";

interface ModelParametersTabProps {
  leases: Lease[];
  assets: Asset[];
  lessees: Lessee[];
  provisions: Provision[];
  orgId: string;
  isDemo: boolean;
  onSaved: () => void;
}

export function ModelParametersTab({ leases, assets, lessees, provisions, isDemo, onSaved }: ModelParametersTabProps) {
  type RowChanges = Partial<ProvisionUpdate & LeaseUpdate>;
  const [dirty, setDirty] = React.useState<Record<string, RowChanges>>({});
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const [savedRows, setSavedRows] = React.useState<Set<string>>(new Set());
  const [errorRows, setErrorRows] = React.useState<Record<string, string>>({});
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  function markDirty(leaseId: string, field: keyof RowChanges, value: unknown) {
    setDirty(prev => ({
      ...prev,
      [leaseId]: { ...prev[leaseId], [field]: value },
    }));
  }

  function getVal<T>(leaseId: string, field: keyof RowChanges, fallback: T): T {
    const row = dirty[leaseId];
    if (row && field in row) return row[field as keyof typeof row] as T;
    return fallback;
  }

  async function saveRow(leaseId: string) {
    const changes = dirty[leaseId];
    if (!changes || Object.keys(changes).length === 0) return;
    const provision = provisions.find(p => p.lease_id === leaseId);
    setSaving(prev => ({ ...prev, [leaseId]: true }));
    setErrorRows(prev => { const n = { ...prev }; delete n[leaseId]; return n; });
    try {
      const leaseChanges: LeaseUpdate = {};
      if ("stage" in changes) leaseChanges.stage = changes.stage as 1 | 2 | 3 | null;
      if ("monthly_rental" in changes) leaseChanges.monthly_rental = changes.monthly_rental as number | null;
      if (Object.keys(leaseChanges).length > 0) {
        await updateLease(leaseId, leaseChanges);
      }
      if (provision) {
        const provChanges: ProvisionUpdate = {};
        if ("pd" in changes) provChanges.pd = changes.pd as number | null;
        if ("lgd" in changes) provChanges.lgd = changes.lgd as number | null;
        if ("ead" in changes) provChanges.ead = changes.ead as number | null;
        if ("auto_ecl" in changes) provChanges.auto_ecl = changes.auto_ecl as boolean;
        if ("ecl_amount" in changes) provChanges.ecl_amount = changes.ecl_amount as number | null;
        if (Object.keys(provChanges).length > 0) {
          const lease = leases.find(l => l.id === leaseId);
          await updateProvision(provision.id, provChanges, lease?.end_date);
        }
      }
      setSavedRows(prev => new Set([...prev, leaseId]));
      setTimeout(() => setSavedRows(prev => { const n = new Set(prev); n.delete(leaseId); return n; }), 1400);
      setDirty(prev => { const n = { ...prev }; delete n[leaseId]; return n; });
      onSaved();
    } catch (err) {
      setErrorRows(prev => ({ ...prev, [leaseId]: (err as Error).message }));
    } finally {
      setSaving(prev => { const n = { ...prev }; delete n[leaseId]; return n; });
    }
  }

  async function bulkSetStage(s: 1 | 2 | 3) {
    for (const leaseId of selected) {
      await updateLease(leaseId, { stage: s });
    }
    onSaved();
    setSelected(new Set());
  }

  async function bulkRecalcEcl() {
    for (const leaseId of selected) {
      const provision = provisions.find(p => p.lease_id === leaseId);
      const lease = leases.find(l => l.id === leaseId);
      if (provision && provision.auto_ecl) {
        const ecl = computeEcl(provision.pd, provision.lgd, provision.ead, provision.stage, lease?.end_date);
        if (ecl != null) {
          await updateProvision(provision.id, { ecl_amount: ecl }, lease?.end_date);
        }
      }
    }
    onSaved();
    setSelected(new Set());
  }

  const STAGE_COLORS: Record<number, { bg: string; color: string; border: string }> = {
    1: { bg: "#F0FDF4", color: "#16A34A", border: "#16A34A" },
    2: { bg: "#FFFBEB", color: "#D97706", border: "#D97706" },
    3: { bg: "#FEF2F2", color: "#DC2626", border: "#DC2626" },
  };

  const thStyle: React.CSSProperties = {
    padding: "10px 8px", textAlign: "left", fontWeight: 700,
    color: "#64748B", textTransform: "uppercase", fontSize: "0.6875rem",
    letterSpacing: "0.05em", whiteSpace: "nowrap",
  };

  const inputStyle: React.CSSProperties = {
    padding: "4px 6px", borderRadius: "5px",
    border: "1px solid #E2E8F0", fontSize: "0.8125rem", outline: "none",
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Demo overlay */}
      {isDemo && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "rgba(255,255,255,0.85)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "8px", minHeight: "200px",
        }}>
          <div style={{ textAlign: "center", color: "#475569", padding: "24px" }}>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "6px" }}>
              Upload your portfolio to edit model parameters
            </div>
            <div style={{ fontSize: "0.875rem" }}>
              Model parameter editing is disabled for the sample portfolio.
            </div>
          </div>
        </div>
      )}

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div style={{
          display: "flex", gap: "8px", padding: "10px 16px",
          background: "#F0F9FF", borderBottom: "1px solid #BAE6FD",
          alignItems: "center", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "0.8125rem", color: "#0369A1", fontWeight: 600, marginRight: "4px" }}>
            {selected.size} lease{selected.size > 1 ? "s" : ""} selected
          </span>
          {([1, 2, 3] as const).map(s => (
            <button
              key={s}
              onClick={() => bulkSetStage(s)}
              style={{
                padding: "4px 10px", borderRadius: "6px", cursor: "pointer",
                fontSize: "0.75rem", fontWeight: 700,
                border: `1px solid ${STAGE_COLORS[s].border}`,
                background: STAGE_COLORS[s].bg,
                color: STAGE_COLORS[s].color,
              }}
            >
              Set Stage {s}
            </button>
          ))}
          <button
            onClick={bulkRecalcEcl}
            style={{
              padding: "4px 10px", borderRadius: "6px", cursor: "pointer",
              fontSize: "0.75rem", fontWeight: 700,
              border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155",
            }}
          >
            Recalculate ECL
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
              <th style={{ ...thStyle, width: "36px" }}>
                <input
                  type="checkbox"
                  disabled={isDemo}
                  checked={selected.size === leases.length && leases.length > 0}
                  onChange={e => setSelected(e.target.checked ? new Set(leases.map(l => l.id)) : new Set())}
                />
              </th>
              <th style={{ ...thStyle, minWidth: "120px" }}>Lessee</th>
              <th style={{ ...thStyle, minWidth: "100px" }}>Aircraft</th>
              <th style={{ ...thStyle, minWidth: "80px" }}>Reg</th>
              <th style={{ ...thStyle, width: "70px" }}>Stage</th>
              <th style={{ ...thStyle, width: "90px" }}>PD %</th>
              <th style={{ ...thStyle, width: "90px" }}>LGD %</th>
              <th style={{ ...thStyle, width: "100px" }}>EAD ($M)</th>
              <th style={{ ...thStyle, width: "100px" }}>ECL ($M)</th>
              <th style={{ ...thStyle, width: "70px", textAlign: "center" }}>Auto</th>
              <th style={{ ...thStyle, width: "80px" }}></th>
            </tr>
          </thead>
          <tbody>
            {leases.map(lease => {
              const asset = assets.find(a => a.id === lease.asset_id);
              const lessee = lessees.find(l => l.id === lease.lessee_id);
              const provision = provisions.find(p => p.lease_id === lease.id);
              const isDirty = !!dirty[lease.id] && Object.keys(dirty[lease.id]).length > 0;
              const isSaved = savedRows.has(lease.id);
              const isSaving = saving[lease.id];
              const rowError = errorRows[lease.id];

              const curStage = getVal<1 | 2 | 3 | null>(lease.id, "stage", lease.stage ?? null);
              const curPd = getVal<number | null>(lease.id, "pd", provision?.pd ?? null);
              const curLgd = getVal<number | null>(lease.id, "lgd", provision?.lgd ?? null);
              const curEad = getVal<number | null>(lease.id, "ead", provision?.ead ?? null);
              const curAutoEcl = getVal<boolean>(lease.id, "auto_ecl", provision?.auto_ecl ?? true);
              const curEcl = curAutoEcl
                ? computeEcl(curPd, curLgd, curEad, curStage, lease.end_date)
                : getVal<number | null>(lease.id, "ecl_amount", provision?.ecl_amount ?? null);

              const rowBg = isSaved
                ? "#F0FDF4"
                : isDirty
                ? "#FFFBEB"
                : rowError
                ? "#FEF2F2"
                : "#FFFFFF";

              return (
                <tr
                  key={lease.id}
                  style={{ background: rowBg, borderBottom: "1px solid #F1F5F9", transition: "background 400ms" }}
                  onKeyDown={e => { if (e.key === "Enter") saveRow(lease.id); }}
                >
                  {/* Checkbox */}
                  <td style={{ padding: "8px" }}>
                    <input
                      type="checkbox"
                      disabled={isDemo}
                      checked={selected.has(lease.id)}
                      onChange={e => {
                        const next = new Set(selected);
                        e.target.checked ? next.add(lease.id) : next.delete(lease.id);
                        setSelected(next);
                      }}
                    />
                  </td>

                  {/* Lessee */}
                  <td style={{ padding: "8px", color: "#0F172A", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lessee?.name ?? "—"}
                  </td>

                  {/* Aircraft type */}
                  <td style={{ padding: "8px", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {asset?.aircraft_type ?? "—"}
                  </td>

                  {/* Registration */}
                  <td style={{ padding: "8px", color: "#475569", fontFamily: "monospace", fontSize: "0.75rem" }}>
                    {asset?.registration ?? "—"}
                  </td>

                  {/* Stage — click cycles null→1→2→3→null */}
                  <td style={{ padding: "8px" }}>
                    <button
                      disabled={isDemo}
                      onClick={() => {
                        const next: 1 | 2 | 3 | null = curStage === null ? 1 : curStage === 1 ? 2 : curStage === 2 ? 3 : null;
                        markDirty(lease.id, "stage", next);
                      }}
                      style={{
                        padding: "3px 10px", borderRadius: "99px",
                        cursor: isDemo ? "default" : "pointer",
                        fontWeight: 700, fontSize: "0.75rem", border: "none",
                        background: curStage ? STAGE_COLORS[curStage].bg : "#F1F5F9",
                        color: curStage ? STAGE_COLORS[curStage].color : "#94A3B8",
                      }}
                    >
                      {curStage ?? "—"}
                    </button>
                  </td>

                  {/* PD */}
                  <td style={{ padding: "8px" }}>
                    <input
                      type="number" min={0} max={1} step={0.001}
                      disabled={isDemo}
                      value={curPd != null ? curPd : ""}
                      onChange={e => markDirty(lease.id, "pd", e.target.value === "" ? null : Number(e.target.value))}
                      style={{ ...inputStyle, width: "70px" }}
                    />
                  </td>

                  {/* LGD */}
                  <td style={{ padding: "8px" }}>
                    <input
                      type="number" min={0} max={1} step={0.01}
                      disabled={isDemo}
                      value={curLgd != null ? curLgd : ""}
                      onChange={e => markDirty(lease.id, "lgd", e.target.value === "" ? null : Number(e.target.value))}
                      style={{ ...inputStyle, width: "70px" }}
                    />
                  </td>

                  {/* EAD $M */}
                  <td style={{ padding: "8px" }}>
                    <input
                      type="number" min={0}
                      disabled={isDemo}
                      value={curEad != null ? (curEad / 1_000_000).toFixed(2) : ""}
                      onChange={e => markDirty(lease.id, "ead", e.target.value === "" ? null : Number(e.target.value) * 1_000_000)}
                      style={{ ...inputStyle, width: "80px" }}
                    />
                  </td>

                  {/* ECL $M */}
                  <td style={{ padding: "8px" }}>
                    <input
                      type="number"
                      disabled={isDemo}
                      readOnly={curAutoEcl}
                      value={curEcl != null ? (curEcl / 1_000_000).toFixed(3) : ""}
                      onChange={e => !curAutoEcl && markDirty(lease.id, "ecl_amount", e.target.value === "" ? null : Number(e.target.value) * 1_000_000)}
                      style={{
                        ...inputStyle, width: "80px",
                        background: curAutoEcl ? "#F8FAFC" : "#FFFFFF",
                        color: curAutoEcl ? "#64748B" : "#0F172A",
                      }}
                    />
                  </td>

                  {/* Auto ECL */}
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      disabled={isDemo}
                      checked={curAutoEcl}
                      onChange={e => markDirty(lease.id, "auto_ecl", e.target.checked)}
                    />
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "8px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {rowError && (
                      <span style={{ fontSize: "0.6875rem", color: "#DC2626", marginRight: "4px" }} title={rowError}>
                        Error
                      </span>
                    )}
                    {isDirty && !isSaving && (
                      <button
                        onClick={() => saveRow(lease.id)}
                        style={{
                          padding: "4px 10px", borderRadius: "6px", cursor: "pointer",
                          fontSize: "0.75rem", fontWeight: 700,
                          background: "#002147", color: "#FFFFFF", border: "none",
                        }}
                      >
                        Save
                      </button>
                    )}
                    {isSaving && (
                      <span style={{ fontSize: "0.75rem", color: "#64748B" }}>…</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {leases.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
            No leases found.
          </div>
        )}
      </div>
    </div>
  );
}
