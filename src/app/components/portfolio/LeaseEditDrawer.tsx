// src/app/components/portfolio/LeaseEditDrawer.tsx
import * as React from "react";
import { motion } from "framer-motion";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import type { Lease, Asset, Lessee, Provision } from "../../types/portfolio";
import {
  updateLessee, updateProvision, updateLease, applyPdToAllLesseeProvisions,
  computeEcl,
  type LesseeUpdate,
} from "../../lib/portfolioMutations";

interface LeaseEditDrawerProps {
  lease: Lease;
  asset: Asset;
  lessee: Lessee;
  provision: Provision | null;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function LeaseEditDrawer({ lease, asset, lessee, provision, orgId, onClose, onSaved }: LeaseEditDrawerProps) {
  // Lessee fields
  const [creditRating, setCreditRating] = React.useState(lessee.credit_rating ?? "");
  const [pdEstimate, setPdEstimate] = React.useState<number | null>(lessee.pd_estimate ?? null);
  const [watchlistStatus, setWatchlistStatus] = React.useState<"green" | "amber" | "red" | null>(
    lessee.watchlist_status ?? null
  );
  const [cascadePd, setCascadePd] = React.useState(false);

  // Lease fields
  const [stage, setStage] = React.useState<1 | 2 | 3 | null>(lease.stage ?? null);
  const [monthlyRental, setMonthlyRental] = React.useState<number | null>(lease.monthly_rental ?? null);

  // ECL / provision fields
  const [autoEcl, setAutoEcl] = React.useState(provision?.auto_ecl ?? true);
  const [pd, setPd] = React.useState<number | null>(provision?.pd ?? null);
  const [lgd, setLgd] = React.useState<number | null>(provision?.lgd ?? null);
  const [ead, setEad] = React.useState<number | null>(provision?.ead ?? null);
  const [manualEcl, setManualEcl] = React.useState<number | null>(provision?.ecl_amount ?? null);

  // UI state
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lesseeOpen, setLesseeOpen] = React.useState(true);

  // Live-computed ECL
  const computedEcl = React.useMemo(
    () => autoEcl ? computeEcl(pd, lgd, ead, stage ?? 1, lease.end_date) : null,
    [autoEcl, pd, lgd, ead, stage, lease.end_date]
  );
  const displayEcl = autoEcl ? computedEcl : manualEcl;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // 1. Update lessee-level fields
      const lesseeUpdates: LesseeUpdate = {};
      if (creditRating !== (lessee.credit_rating ?? "")) lesseeUpdates.credit_rating = creditRating || null;
      if (pdEstimate !== lessee.pd_estimate) lesseeUpdates.pd_estimate = pdEstimate;
      if (watchlistStatus !== lessee.watchlist_status) lesseeUpdates.watchlist_status = watchlistStatus;
      if (Object.keys(lesseeUpdates).length > 0) {
        await updateLessee(lessee.id, lesseeUpdates);
      }

      // 2. Cascade PD to all lessee provisions if checkbox ticked
      if (cascadePd && pd != null) {
        await applyPdToAllLesseeProvisions(orgId, lessee.id, pd);
      }

      // 3. Update lease-level fields
      await updateLease(lease.id, { stage, monthly_rental: monthlyRental });

      // 4. Update provision
      if (provision) {
        await updateProvision(
          provision.id,
          {
            stage,
            pd,
            lgd,
            ead,
            auto_ecl: autoEcl,
            ecl_amount: autoEcl ? undefined : manualEcl,
          },
          lease.end_date,
        );
      }

      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: "7px",
    border: "1px solid #CBD5E1", fontSize: "0.875rem",
    outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.75rem", fontWeight: 600,
    color: "#64748B", marginBottom: "5px",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "0.75rem", fontWeight: 700, color: "#334155",
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px",
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: 599,
        }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "400px",
          background: "#FFFFFF",
          zIndex: 600,
          boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", flexShrink: 0, background: "#FAFAFA" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>
                Edit Lease
              </div>
              <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#0F172A" }}>
                {asset.registration} · {asset.aircraft_type}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: "2px" }}>
                {lessee.name}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "6px", display: "flex", alignItems: "center" }}
            >
              <X size={18} style={{ color: "#94A3B8" }} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* ── Lessee defaults (collapsible) ─────────── */}
          <div style={{ marginBottom: "20px" }}>
            <button
              onClick={() => setLesseeOpen(o => !o)}
              style={{
                width: "100%", display: "flex", justifyContent: "space-between",
                alignItems: "center", background: "none", border: "none",
                cursor: "pointer", padding: "0 0 10px 0",
                borderBottom: lesseeOpen ? "none" : "1px solid #E2E8F0",
              }}
            >
              <span style={sectionTitleStyle}>Lessee Defaults</span>
              {lesseeOpen ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
            </button>

            {lesseeOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "12px" }}>
                {/* Credit Rating */}
                <div>
                  <label style={labelStyle}>Credit Rating</label>
                  <input
                    type="text"
                    value={creditRating}
                    onChange={e => setCreditRating(e.target.value)}
                    placeholder="e.g. BB+"
                    style={inputStyle}
                  />
                </div>

                {/* PD Estimate */}
                <div>
                  <label style={labelStyle}>PD Estimate (0–1)</label>
                  <input
                    type="number"
                    min={0} max={1} step={0.001}
                    value={pdEstimate ?? ""}
                    onChange={e => setPdEstimate(e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="e.g. 0.045"
                    style={inputStyle}
                  />
                </div>

                {/* Watchlist Status */}
                <div>
                  <label style={labelStyle}>Watchlist Status</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {(["green", "amber", "red"] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setWatchlistStatus(watchlistStatus === s ? null : s)}
                        style={{
                          flex: 1, padding: "6px", borderRadius: "7px", cursor: "pointer",
                          fontSize: "0.75rem", fontWeight: 600, textTransform: "capitalize",
                          border: `2px solid ${watchlistStatus === s ? (s === "green" ? "#16A34A" : s === "amber" ? "#D97706" : "#DC2626") : "#E2E8F0"}`,
                          background: watchlistStatus === s ? (s === "green" ? "#F0FDF4" : s === "amber" ? "#FFFBEB" : "#FEF2F2") : "#F8FAFC",
                          color: watchlistStatus === s ? (s === "green" ? "#16A34A" : s === "amber" ? "#D97706" : "#DC2626") : "#94A3B8",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cascade PD checkbox */}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.8125rem", color: "#475569" }}>
                  <input
                    type="checkbox"
                    checked={cascadePd}
                    onChange={e => setCascadePd(e.target.checked)}
                  />
                  Apply updated PD to all leases for this lessee
                </label>
              </div>
            )}
          </div>

          {/* ── Lease section ─────────────────────────── */}
          <div style={{ marginBottom: "20px", paddingTop: "16px", borderTop: "1px solid #E2E8F0" }}>
            <div style={sectionTitleStyle}>Lease</div>

            {/* Stage selector */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>IFRS 9 Stage</label>
              <div style={{ display: "flex", gap: "6px" }}>
                {([1, 2, 3] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStage(stage === s ? null : s)}
                    style={{
                      flex: 1, padding: "7px", borderRadius: "7px", cursor: "pointer",
                      fontSize: "0.875rem", fontWeight: 700,
                      border: `2px solid ${stage === s ? (s === 1 ? "#16A34A" : s === 2 ? "#D97706" : "#DC2626") : "#E2E8F0"}`,
                      background: stage === s ? (s === 1 ? "#F0FDF4" : s === 2 ? "#FFFBEB" : "#FEF2F2") : "#F8FAFC",
                      color: stage === s ? (s === 1 ? "#16A34A" : s === 2 ? "#D97706" : "#DC2626") : "#94A3B8",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly Rental */}
            <div>
              <label style={labelStyle}>Monthly Rental (USD)</label>
              <input
                type="number"
                min={0}
                value={monthlyRental ?? ""}
                onChange={e => setMonthlyRental(e.target.value === "" ? null : Number(e.target.value))}
                placeholder="e.g. 285000"
                style={inputStyle}
              />
            </div>
          </div>

          {/* ── ECL / Provision section ───────────────── */}
          <div style={{ paddingTop: "16px", borderTop: "1px solid #E2E8F0" }}>
            <div style={sectionTitleStyle}>ECL Model Inputs</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* PD */}
              <div>
                <label style={labelStyle}>PD (probability of default, 0–1)</label>
                <input
                  type="number" min={0} max={1} step={0.001}
                  value={pd ?? ""}
                  onChange={e => setPd(e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="e.g. 0.045"
                  style={inputStyle}
                />
              </div>

              {/* LGD */}
              <div>
                <label style={labelStyle}>LGD (loss given default, 0–1)</label>
                <input
                  type="number" min={0} max={1} step={0.01}
                  value={lgd ?? ""}
                  onChange={e => setLgd(e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="e.g. 0.45"
                  style={inputStyle}
                />
              </div>

              {/* EAD */}
              <div>
                <label style={labelStyle}>EAD (exposure at default, USD)</label>
                <input
                  type="number" min={0}
                  value={ead ?? ""}
                  onChange={e => setEad(e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="e.g. 10000000"
                  style={inputStyle}
                />
              </div>

              {/* Auto-ECL checkbox */}
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.8125rem", color: "#475569" }}>
                <input
                  type="checkbox"
                  checked={autoEcl}
                  onChange={e => setAutoEcl(e.target.checked)}
                />
                Auto-calculate ECL
              </label>

              {/* ECL amount */}
              <div>
                <label style={labelStyle}>ECL Amount (USD)</label>
                <input
                  type="number"
                  readOnly={autoEcl}
                  value={displayEcl != null ? Number(displayEcl.toFixed(0)) : ""}
                  onChange={e => !autoEcl && setManualEcl(e.target.value === "" ? null : Number(e.target.value))}
                  placeholder={autoEcl ? "Computed from PD × LGD × EAD" : "Enter ECL amount"}
                  style={{
                    ...inputStyle,
                    background: autoEcl ? "#F8FAFC" : "#FFFFFF",
                    color: autoEcl ? "#64748B" : "#0F172A",
                    cursor: autoEcl ? "not-allowed" : "text",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", flexShrink: 0, background: "#FAFAFA" }}>
          {error && (
            <div style={{ fontSize: "0.8125rem", color: "#DC2626", marginBottom: "10px", padding: "8px 10px", background: "#FEF2F2", borderRadius: "6px" }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: "9px", borderRadius: "8px",
                border: "1px solid #CBD5E1", background: "#FFFFFF",
                fontSize: "0.875rem", fontWeight: 600, color: "#475569",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 2, padding: "9px", borderRadius: "8px",
                border: "none", background: saving ? "#94A3B8" : "#002147",
                fontSize: "0.875rem", fontWeight: 700, color: "#FFFFFF",
                cursor: saving ? "not-allowed" : "pointer",
                transition: "background 150ms",
              }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
