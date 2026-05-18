// src/app/components/risk-ecl/ClosePeriodModal.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock } from "lucide-react";
import { useEclSnapshots, type LockPeriodPayload } from "../../hooks/useEclSnapshots";

function currentQuarterLabel(): string {
  const now = new Date();
  return `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;
}

interface ClosePeriodModalProps {
  open:     boolean;
  onClose:  () => void;
  onLocked: () => void;
  liveData: LockPeriodPayload;
}

const fmtM = (n: number) => `$${Math.abs(n).toFixed(1)}M`;

export function ClosePeriodModal({ open, onClose, onLocked, liveData }: ClosePeriodModalProps) {
  const { lockPeriod } = useEclSnapshots();
  const [periodLabel, setPeriodLabel] = useState(currentQuarterLabel);
  const [saving, setSaving]           = useState(false);
  const [done, setDone]               = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPeriodLabel(currentQuarterLabel());
      setSaving(false);
      setDone(false);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Cleanup timer and trigger callbacks when done
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => { onClose(); onLocked(); }, 1200);
    return () => clearTimeout(id);
  }, [done, onClose, onLocked]);

  const canConfirm = periodLabel.trim() !== "" && liveData.eclRows.length > 0 && !saving && !done;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSaving(true);
    try {
      await lockPeriod({ ...liveData, periodLabel: periodLabel.trim() });
      setDone(true);
    } catch (err) {
      console.error("[ClosePeriodModal] lockPeriod error:", err);
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", zIndex: 1000 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            style={{
              position: "fixed", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: "480px", background: "#FFFFFF",
              borderRadius: "1rem",
              boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
              zIndex: 1001, overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", background: "#002147" }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF" }}>Close Period</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "0.125rem" }}>
                  Lock current ECL state for IFRS 9 reporting
                </div>
              </div>
              <button
                onClick={onClose}
                style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", cursor: "pointer", color: "#FFFFFF" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "1.5rem" }}>
              {/* Period label input */}
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", display: "block", marginBottom: "0.375rem" }}>
                Period Label
              </label>
              <input
                value={periodLabel}
                onChange={e => setPeriodLabel(e.target.value)}
                placeholder="e.g. Q2 2026"
                disabled={saving || done}
                style={{
                  width: "100%", boxSizing: "border-box",
                  border: "1px solid #E2E8F0", borderRadius: "0.5rem",
                  padding: "0.625rem 0.875rem", fontSize: "0.9375rem",
                  color: "#0F172A", outline: "none",
                  marginBottom: "1.25rem",
                  transition: "border-color 150ms ease",
                }}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#002147"; }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "#E2E8F0"; }}
              />

              {/* ECL summary strip */}
              <div style={{ background: "#F8FAFC", borderRadius: "0.75rem", padding: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
                {[
                  { label: "Total ECL",  value: fmtM(liveData.totalEcl) },
                  { label: "Stage 1",    value: fmtM(liveData.stage1Ecl) },
                  { label: "Stage 2",    value: fmtM(liveData.stage2Ecl) },
                  { label: "Stage 3",    value: fmtM(liveData.stage3Ecl) },
                  { label: "ECL 12-Mo",  value: fmtM(liveData.ecl12m) },
                  { label: "Coverage",   value: `${liveData.coveragePct.toFixed(2)}%` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: "0.6875rem", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.125rem" }}>{label}</div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0F172A" }}>{value}</div>
                  </div>
                ))}
              </div>

              {liveData.eclRows.length === 0 && (
                <p style={{ fontSize: "0.8125rem", color: "#B45309", background: "#FEF3C7", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", marginBottom: "1rem", marginTop: 0 }}>
                  No leases in portfolio — add leases before closing a period.
                </p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  onClick={onClose}
                  disabled={saving}
                  style={{ padding: "0.625rem 1.25rem", borderRadius: "9999px", border: "1px solid #E2E8F0", background: "transparent", color: "#475569", fontSize: "0.875rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    padding: "0.625rem 1.375rem", borderRadius: "9999px", border: "none",
                    background: done ? "#15803D" : canConfirm ? "#002147" : "#CBD5E1",
                    color: "#FFFFFF", fontSize: "0.875rem", fontWeight: 600,
                    cursor: canConfirm ? "pointer" : "not-allowed",
                    transition: "background 150ms ease",
                  }}
                >
                  <Lock size={13} />
                  {done ? "Period locked ✓" : saving ? "Locking…" : "Lock Period"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
