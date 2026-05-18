// src/app/components/risk-ecl/RecoveryFactorDrawer.tsx
import { useState, useEffect } from "react";
import {
  computeLgdBenchmark,
  DEFAULT_RECOVERY_FACTOR,
} from "../../data/lgdCurves";
import { classifyAircraftFamily } from "../../data/aircraftFamilyMap";

interface Props {
  isOpen:               boolean;
  currentRecoveryFactor: number;
  isOverridden:         boolean;
  /** Optional: preview impact on a representative asset */
  previewAircraftType?: string;
  previewAgeYears?:     number;
  onSave:               (factor: number, notes?: string) => Promise<void>;
  onReset:              () => Promise<void>;
  onClose:              () => void;
}

export function RecoveryFactorDrawer({
  isOpen, currentRecoveryFactor, isOverridden,
  previewAircraftType, previewAgeYears,
  onSave, onReset, onClose,
}: Props) {
  const [inputPct, setInputPct]     = useState("");
  const [notes, setNotes]           = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputPct((currentRecoveryFactor * 100).toFixed(1));
      setNotes("");
      setError(null);
      setSaving(false);
      setConfirmReset(false);
    }
  }, [isOpen, currentRecoveryFactor]);

  if (!isOpen) return null;

  const parsedFactor = parseFloat(inputPct) / 100;
  const isValid = !isNaN(parsedFactor) && parsedFactor > 0.10 && parsedFactor < 0.95;

  // Impact preview
  let previewFrom: string | null = null;
  let previewTo:   string | null = null;
  if (isValid && previewAircraftType != null && previewAgeYears != null) {
    const family = classifyAircraftFamily(previewAircraftType);
    previewFrom = `${(computeLgdBenchmark(family, previewAgeYears, currentRecoveryFactor) * 100).toFixed(1)}%`;
    previewTo   = `${(computeLgdBenchmark(family, previewAgeYears, parsedFactor) * 100).toFixed(1)}%`;
  }

  async function handleSave() {
    if (!isValid) { setError("Recovery factor must be between 10% and 95%."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(parsedFactor, notes || undefined);
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setError(null);
    try {
      await onReset();
      onClose();
    } catch {
      setError("Failed to reset. Please try again.");
    } finally {
      setSaving(false);
      setConfirmReset(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 49 }}
      />
      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 380,
        background: "#FFFFFF", zIndex: 50, boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid #E2E8F0" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0F172A" }}>Adjust Recovery Factor</div>
            <div style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: "0.125rem" }}>Firm-level LGD assumption</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: "1.25rem", color: "#64748B", cursor: "pointer" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.375rem" }}>
            Recovery factor (%)
          </label>
          <input
            type="number"
            min={10.1}
            max={94.9}
            step={0.1}
            value={inputPct}
            onChange={(e) => { setInputPct(e.target.value); setError(null); }}
            style={{
              width: "100%", padding: "0.625rem 0.75rem", border: "1px solid #CBD5E1",
              borderRadius: "0.5rem", fontSize: "0.875rem", color: "#0F172A",
              boxSizing: "border-box",
            }}
          />
          <p style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.375rem" }}>
            Default: {(DEFAULT_RECOVERY_FACTOR * 100).toFixed(1)}% (AVAC through-the-cycle, 2023). Valid range: 10.1% – 94.9%.
          </p>

          {/* Impact preview */}
          {previewFrom && previewTo && (
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: "0.25rem" }}>
                IMPACT PREVIEW · {previewAircraftType} ({previewAgeYears} yr)
              </div>
              <div style={{ fontSize: "0.875rem", color: "#0F172A" }}>
                LGD benchmark: <b>{previewFrom}</b> → <b>{previewTo}</b>
              </div>
            </div>
          )}

          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.375rem", marginTop: "1.25rem" }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for override..."
            rows={3}
            style={{
              width: "100%", padding: "0.625rem 0.75rem", border: "1px solid #CBD5E1",
              borderRadius: "0.5rem", fontSize: "0.875rem", color: "#0F172A",
              resize: "vertical", boxSizing: "border-box",
            }}
          />

          {error && (
            <p style={{ color: "#B91C1C", fontSize: "0.8125rem", marginTop: "0.5rem" }}>{error}</p>
          )}

          {/* Reset section */}
          {isOverridden && (
            <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #F1F5F9" }}>
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  style={{ background: "none", border: "1px solid #FCA5A5", borderRadius: "9999px", padding: "0.375rem 0.875rem", fontSize: "0.8125rem", color: "#B91C1C", cursor: "pointer" }}
                >
                  Reset to default
                </button>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>Remove firm override?</span>
                  <button onClick={handleReset} disabled={saving} style={{ background: "#B91C1C", border: "none", borderRadius: "9999px", padding: "0.3rem 0.75rem", fontSize: "0.8125rem", color: "#FFFFFF", cursor: "pointer" }}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirmReset(false)} style={{ background: "none", border: "none", fontSize: "0.8125rem", color: "#64748B", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.5rem 1.25rem", fontSize: "0.875rem", color: "#475569", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            style={{ background: "#002147", border: "none", borderRadius: "9999px", padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, color: "#FFFFFF", cursor: isValid && !saving ? "pointer" : "not-allowed", opacity: isValid && !saving ? 1 : 0.5 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
