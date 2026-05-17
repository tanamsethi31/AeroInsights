// src/app/components/counterparties/CurveOverrideDrawer.tsx
import React, { useState, useEffect } from "react";
import {
  CARRIER_SEGMENT_LABELS,
  DEFAULT_PD_CURVES,
  type CarrierSegment,
  type PdCurveLibrary,
  type PdTermStructure,
} from "../../data/pdCurves";
import type { EffectiveCurves } from "../../hooks/usePdCurves";

interface CurveOverrideDrawerProps {
  isOpen: boolean;
  segment: CarrierSegment;
  curves: PdCurveLibrary;
  isOverridden: boolean;
  onSaveOverride: EffectiveCurves["saveOverride"];
  onResetToDefault: EffectiveCurves["resetToDefault"];
  onClose: () => void;
}

type TenorKey = "pd1yr" | "pd2yr" | "pd3yr" | "pd5yr" | "pdLifetime";
const TENORS: { key: TenorKey; label: string }[] = [
  { key: "pd1yr",      label: "1-year PD"    },
  { key: "pd2yr",      label: "2-year PD"    },
  { key: "pd3yr",      label: "3-year PD"    },
  { key: "pd5yr",      label: "5-year PD"    },
  { key: "pdLifetime", label: "Lifetime PD"  },
];

function toDisplay(decimal: number): string {
  return (decimal * 100).toFixed(4);
}

function toDecimal(display: string): number {
  return parseFloat(display) / 100;
}

export function CurveOverrideDrawer({
  isOpen,
  segment,
  curves,
  isOverridden,
  onSaveOverride,
  onResetToDefault,
  onClose,
}: CurveOverrideDrawerProps) {
  const curve = curves[segment];
  const label = CARRIER_SEGMENT_LABELS[segment];

  const [fields, setFields] = useState<Record<TenorKey, string>>({
    pd1yr:      toDisplay(curve.pd1yr),
    pd2yr:      toDisplay(curve.pd2yr),
    pd3yr:      toDisplay(curve.pd3yr),
    pd5yr:      toDisplay(curve.pd5yr),
    pdLifetime: toDisplay(curve.pdLifetime),
  });
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<TenorKey | "monotonicity" | "submit", string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Re-seed fields when segment or curves change
  useEffect(() => {
    setFields({
      pd1yr:      toDisplay(curve.pd1yr),
      pd2yr:      toDisplay(curve.pd2yr),
      pd3yr:      toDisplay(curve.pd3yr),
      pd5yr:      toDisplay(curve.pd5yr),
      pdLifetime: toDisplay(curve.pdLifetime),
    });
    setNotes("");
    setErrors({});
    setConfirmReset(false);
  }, [segment, curves, isOpen]);

  function validate(): boolean {
    const newErrors: Partial<Record<TenorKey | "monotonicity" | "submit", string>> = {};
    const values: Record<TenorKey, number> = {} as Record<TenorKey, number>;

    for (const { key } of TENORS) {
      const v = parseFloat(fields[key]);
      if (isNaN(v) || v <= 0 || v >= 100) {
        newErrors[key] = "Must be between 0 and 100";
      } else {
        values[key] = toDecimal(fields[key]);
      }
    }

    if (Object.keys(newErrors).length === 0) {
      const { pd1yr, pd2yr, pd3yr, pd5yr, pdLifetime } = values;
      if (!(pd1yr <= pd2yr && pd2yr <= pd3yr && pd3yr <= pd5yr && pd5yr <= pdLifetime)) {
        newErrors.monotonicity = "PD values must be non-decreasing across tenors (1yr ≤ 2yr ≤ 3yr ≤ 5yr ≤ Lifetime)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSaveOverride(segment, {
        pd1yr:      toDecimal(fields.pd1yr),
        pd2yr:      toDecimal(fields.pd2yr),
        pd3yr:      toDecimal(fields.pd3yr),
        pd5yr:      toDecimal(fields.pd5yr),
        pdLifetime: toDecimal(fields.pdLifetime),
        notes:      notes || undefined,
      });
      onClose();
    } catch {
      setErrors({ submit: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await onResetToDefault(segment);
      setConfirmReset(false);
      onClose();
    } catch {
      setErrors({ submit: "Failed to reset. Please try again." });
    } finally {
      setResetting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-[360px] bg-[#0f1117] border-l border-gray-700/50 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
          <div>
            <h3 className="text-sm font-semibold text-white">Customise {label} PD Curve</h3>
            <p className="text-xs text-gray-500 mt-0.5">Values shown as percentages</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Default values reference */}
          <div className="rounded-md bg-gray-800/40 border border-gray-700/30 px-3 py-2.5 text-xs text-gray-500">
            Aeroinsights defaults:{" "}
            {TENORS.map(({ key, label: l }, i) => (
              <span key={key}>
                {l}: {toDisplay(DEFAULT_PD_CURVES[segment][key])}%{i < TENORS.length - 1 ? " · " : ""}
              </span>
            ))}
          </div>

          {/* Tenor inputs */}
          {TENORS.map(({ key, label: tenorLabel }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                {tenorLabel} <span className="text-gray-600">(%)</span>
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="100"
                value={fields[key]}
                onChange={(e) =>
                  setFields((prev) => ({ ...prev, [key]: e.target.value }))
                }
                className={`w-full bg-[#1a1d2e] border rounded px-3 py-1.5 text-sm text-gray-200 tabular-nums focus:outline-none focus:ring-1 ${
                  errors[key]
                    ? "border-red-500/50 focus:ring-red-500/30"
                    : "border-gray-700/50 focus:ring-blue-500/30 focus:border-blue-500/50"
                }`}
              />
              {errors[key] && (
                <p className="text-xs text-red-400 mt-1">{errors[key]}</p>
              )}
            </div>
          ))}

          {/* Submit error */}
          {errors.submit && (
            <p className="text-xs text-red-400 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
              {errors.submit}
            </p>
          )}

          {/* Monotonicity error */}
          {errors.monotonicity && (
            <p className="text-xs text-red-400 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
              {errors.monotonicity}
            </p>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Source / Notes <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Internal credit model calibration Q2 2024"
              className="w-full bg-[#1a1d2e] border border-gray-700/50 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-700/50 space-y-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded px-4 py-2 transition-colors"
          >
            {saving ? "Saving…" : "Save custom curve"}
          </button>

          {isOverridden && !confirmReset && (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full text-xs text-gray-500 hover:text-red-400 transition-colors py-1"
            >
              Reset to Aeroinsights defaults
            </button>
          )}

          {confirmReset && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2.5 space-y-2">
              <p className="text-xs text-red-300">
                Are you sure? This will remove your firm's custom curve.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex-1 bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
                >
                  {resetting ? "Resetting…" : "Yes, reset"}
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded px-3 py-1.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
