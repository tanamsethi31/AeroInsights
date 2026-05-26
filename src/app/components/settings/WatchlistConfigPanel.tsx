// src/app/components/settings/WatchlistConfigPanel.tsx
// Weights + thresholds editor for the live watchlist engine.

import { useEffect, useState } from "react";
import { RotateCcw, Save, Check } from "lucide-react";
import {
  useWatchlistConfig, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS,
  type WatchlistWeights, type WatchlistSignalKey,
} from "../../hooks/useWatchlistConfig";

const SIGNAL_META: Record<WatchlistSignalKey, { label: string; tooltip: string }> = {
  paymentLateness: { label: "Payment lateness", tooltip: "Derived from lessees.dpd_days. 0=current, 100=60+ DPD." },
  scheduleQoQ:     { label: "Schedule QoQ",     tooltip: "Quarter-over-quarter schedule cancellations. Inert until schedule data ingests." },
  ratingChange:    { label: "Rating change",    tooltip: "Notches downgraded since last review." },
  ctcWatchlist:    { label: "CTC watchlist",    tooltip: "AWG Cape Town Convention watchlist flag." },
  newsKeywordHits: { label: "News sentiment",   tooltip: "Insolvency / distress signals (proxy until full NewsAPI keyword scoring lands)." },
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #E2E8F0", borderRadius: "0.375rem",
  padding: "0.4rem 0.625rem", fontSize: "0.8125rem",
  color: "#0F172A", outline: "none", width: "72px",
  textAlign: "right", fontVariantNumeric: "tabular-nums",
};

export function WatchlistConfigPanel() {
  const { weights, thresholds, isPersisted, loading, error, save } = useWatchlistConfig();
  const [draftWeights,    setDraftWeights]    = useState<WatchlistWeights>(weights);
  const [draftThresholds, setDraftThresholds] = useState(thresholds);
  const [saving,    setSaving]    = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);

  useEffect(() => { setDraftWeights(weights); setDraftThresholds(thresholds); }, [weights, thresholds]);

  const sum = Object.values(draftWeights).reduce((a, b) => a + b, 0);
  const sumColor = sum === 100 ? "#15803D" : "#B45309";

  async function handleSave() {
    setSaving(true); setSavedFlag(false);
    try {
      await save({ weights: draftWeights, thresholds: draftThresholds });
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 1800);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDraftWeights(DEFAULT_WEIGHTS);
    setDraftThresholds(DEFAULT_THRESHOLDS);
  }

  if (loading) return <div style={{ color: "#94A3B8", fontSize: "0.875rem" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
        Signal weights and status thresholds used by the watchlist cron
        (re-evaluated every 30 min). Weights should sum to 100 — values
        outside that still work but the score will no longer be 0–100.
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "0.5rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.8125rem" }}>
          {error}
        </div>
      )}

      {/* Weights */}
      <div style={{
        background: "#F8FAFC", border: "1px solid #E2E8F0",
        borderRadius: "0.5rem", padding: "1rem",
        display: "flex", flexDirection: "column", gap: "0.625rem",
      }}>
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A", display: "flex", justifyContent: "space-between" }}>
          <span>Signal weights</span>
          <span style={{ color: sumColor }}>Σ = {sum}</span>
        </div>
        {(Object.keys(SIGNAL_META) as WatchlistSignalKey[]).map((k) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.75rem", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.8125rem", color: "#0F172A", fontWeight: 500 }}>{SIGNAL_META[k].label}</div>
              <div style={{ fontSize: "0.7rem", color: "#64748B" }}>{SIGNAL_META[k].tooltip}</div>
            </div>
            <input
              type="range" min={0} max={100} step={1}
              value={draftWeights[k]}
              onChange={(e) => setDraftWeights({ ...draftWeights, [k]: Number(e.target.value) })}
              style={{ width: "200px" }}
            />
            <input
              type="number" min={0} max={100} step={1}
              value={draftWeights[k]}
              onChange={(e) => setDraftWeights({ ...draftWeights, [k]: Math.max(0, Math.min(100, Number(e.target.value))) })}
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      {/* Thresholds */}
      <div style={{
        background: "#F8FAFC", border: "1px solid #E2E8F0",
        borderRadius: "0.5rem", padding: "1rem",
        display: "flex", flexDirection: "column", gap: "0.625rem",
      }}>
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>Status thresholds</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.75rem", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.8125rem", color: "#0F172A", fontWeight: 500 }}>RED at or above</div>
            <div style={{ fontSize: "0.7rem", color: "#64748B" }}>Lessees with score ≥ this are flagged red.</div>
          </div>
          <input type="range" min={0} max={100} step={1} value={draftThresholds.red}
            onChange={(e) => setDraftThresholds({ ...draftThresholds, red: Number(e.target.value) })} style={{ width: "200px" }} />
          <input type="number" min={0} max={100} value={draftThresholds.red}
            onChange={(e) => setDraftThresholds({ ...draftThresholds, red: Math.max(0, Math.min(100, Number(e.target.value))) })} style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.75rem", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.8125rem", color: "#0F172A", fontWeight: 500 }}>AMBER at or above</div>
            <div style={{ fontSize: "0.7rem", color: "#64748B" }}>Lessees below RED but ≥ this are flagged amber.</div>
          </div>
          <input type="range" min={0} max={100} step={1} value={draftThresholds.amber}
            onChange={(e) => setDraftThresholds({ ...draftThresholds, amber: Number(e.target.value) })} style={{ width: "200px" }} />
          <input type="number" min={0} max={100} value={draftThresholds.amber}
            onChange={(e) => setDraftThresholds({ ...draftThresholds, amber: Math.max(0, Math.min(100, Number(e.target.value))) })} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            background: "#002147", color: "#FFFFFF",
            border: "none", borderRadius: "9999px",
            padding: "0.55rem 1.25rem", fontSize: "0.8125rem", fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {savedFlag ? <Check size={13} /> : <Save size={13} />}
          {saving ? "Saving…" : savedFlag ? "Saved" : isPersisted ? "Save changes" : "Save"}
        </button>
        <button
          onClick={handleReset}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            background: "transparent", color: "#475569",
            border: "1px solid #E2E8F0", borderRadius: "9999px",
            padding: "0.55rem 1rem", fontSize: "0.8125rem",
            cursor: "pointer",
          }}
        >
          <RotateCcw size={13} /> Reset to defaults
        </button>
      </div>
    </div>
  );
}
