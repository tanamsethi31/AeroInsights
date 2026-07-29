import * as React from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import {
  TYPE_HEURISTICS,
  mrFlagColor,
  mrFlagBg,
  mrFlagBorder,
  type MRAdeqFlag,
  type ComponentName,
} from "../../data/maintenanceHeuristics";
import { sdmrData, type LeaseSDMR, type MRComponent } from "./SDMRTab";
import { useServicerReport } from "../../hooks/useServicerReport";
import type { ServicerReport } from "../../hooks/useServicerReport";
import type { CostOverride } from "../../hooks/useCostOverrides";
import { useCostOverrides } from "../../hooks/useCostOverrides";

// ─── Lease context table (mirrors Portfolio.tsx leases[]) ─────────────────────
export const LEASE_CONTEXT: Record<string, { leaseId: string; leaseEnd: string; stage: string }> = {
  "9218":  { leaseId: "LSE-2019-001", leaseEnd: "2028-03-01", stage: "3" },
  "41234": { leaseId: "LSE-2020-014", leaseEnd: "2027-06-15", stage: "3" },
  "62047": { leaseId: "LSE-2021-022", leaseEnd: "2030-01-10", stage: "1" },
  "1728":  { leaseId: "LSE-2020-031", leaseEnd: "2026-09-01", stage: "2" },
  "67892": { leaseId: "LSE-2022-009", leaseEnd: "2032-04-15", stage: "1" },
  "0378":  { leaseId: "LSE-2018-047", leaseEnd: "2028-07-20", stage: "1" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}k`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Parse a YYYY-MM-DD date string as local time (avoids UTC-offset day shift). */
function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ─── Projection logic ─────────────────────────────────────────────────────────

export interface ComponentProjection {
  component: ComponentName;
  currentBalance: number;
  monthlyAccrual: number;         // assumes lessee keeps paying
  monthsToNextEvent: number;
  nextEventDate: Date;
  projectedBalanceAtEvent: number;
  heuristicEventCost: number;
  costSource: "heuristic" | "override";
  costOverrideMeta?: { createdBy: string; updatedAt: string; note: string | null };
  shortfallAtEvent: number;       // +ve = shortfall, -ve = surplus
  projectedBalanceAtEOL: number;
  eolObligation: number;          // contractual obligation at full-life return
  eolShortfall: number;           // +ve = shortfall, -ve = surplus
  distressedEOLShortfall: number; // conservative: lessee stops paying today
}

export interface MRAdequacy {
  flag: MRAdeqFlag;
  eolShortfall: number;            // sum of positive component eolShortfall, $
  eolShortfallPct: number;         // eolShortfall / total eolObligation, 0 if obligation is 0
  distressedEOLShortfall: number;  // sum of Math.max(0, component distressedEOLShortfall) — matches MRPortfolioGrid.tsx's existing production logic
}

/** Single source of truth for MR adequacy — replaces the old MR_ADEQUACY static lookup table. */
export function computeMRAdequacy(projections: ComponentProjection[]): MRAdequacy {
  const eolShortfall = projections.reduce((s, p) => s + Math.max(0, p.eolShortfall), 0);
  const distressedEOLShortfall = projections.reduce((s, p) => s + Math.max(0, p.distressedEOLShortfall), 0);
  const totalObligation = projections.reduce((s, p) => s + p.eolObligation, 0);
  const flag: MRAdeqFlag =
    projections.some(p => p.eolShortfall > 0) ? "red"
    : projections.some(p => p.distressedEOLShortfall > 0) ? "amber"
    : "green";
  return {
    flag,
    eolShortfall,
    eolShortfallPct: totalObligation > 0 ? (eolShortfall / totalObligation) * 100 : 0,
    distressedEOLShortfall,
  };
}

// Reverse lookup: leaseId → { msn, leaseEnd } — same table MRPortfolioGrid.tsx builds inline today.
const CONTEXT_BY_LEASE_ID: Record<string, { msn: string; leaseEnd: string }> = Object.fromEntries(
  Object.entries(LEASE_CONTEXT).map(([msn, ctx]) => [ctx.leaseId, { msn, leaseEnd: ctx.leaseEnd }])
);

/** Adequacy for a whole book of leases, keyed by leaseId. Falls back to LEASE_CONTEXT for demo
 *  leases that don't carry their own leaseEnd (buildLiveSDMRData always populates leaseEnd on real records). */
export function buildAdequacyMap(leases: LeaseSDMR[]): Map<string, MRAdequacy> {
  const map = new Map<string, MRAdequacy>();
  for (const lease of leases) {
    const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
    const leaseEndDate = lease.leaseEnd
      ? parseDateLocal(lease.leaseEnd)
      : ctx
      ? parseDateLocal(ctx.leaseEnd)
      : new Date(2028, 0, 1); // last-resort fallback, mirrors MRPortfolioGrid.tsx's existing fallback
    const projections = buildProjections(lease, lease.aircraft, leaseEndDate);
    map.set(lease.leaseId, computeMRAdequacy(projections));
  }
  return map;
}

export interface UtilOverride {
  annualFH: number;
  annualCy: number;
  componentRemaining: Record<string, number>; // component name → remaining units
}

export function buildProjections(
  lease: LeaseSDMR,
  aircraftType: string,
  leaseEndDate: Date,
  utilOverride?: UtilOverride,
  costOverrides?: Record<string, CostOverride>,
): ComponentProjection[] {
  const heuristic = TYPE_HEURISTICS[aircraftType] ?? TYPE_HEURISTICS["A320neo"];
  const now = new Date(2026, 4, 1); // May 2026 (app reference date)
  const monthsToEOL = Math.max(0, monthsBetween(now, leaseEndDate));

  return lease.mrComponents.map((comp: MRComponent): ComponentProjection => {
    const h = heuristic.components[comp.component];
    const monthlyUtil = comp.rateBasis === "$/FH"
      ? (utilOverride?.annualFH ?? heuristic.utilizationFH) / 12
      : (utilOverride?.annualCy ?? heuristic.utilizationCy) / 12;

    const remainingUnits    = utilOverride?.componentRemaining[comp.component] ?? comp.remainingUnits;
    const monthlyAccrual    = comp.rateAmount * monthlyUtil;
    const monthsToNextEvent = remainingUnits / monthlyUtil;
    const nextEventDate     = addMonths(now, monthsToNextEvent);

    // Projected balance at next event (base: lessee keeps paying)
    const projectedBalanceAtEvent = comp.cumulativeBalance + remainingUnits * comp.rateAmount;
    const costOverride            = costOverrides?.[comp.component];
    const heuristicEventCost      = costOverride ? costOverride.costUSD : (h ? h.costUSD : comp.fullIntervalUnits * comp.rateAmount);
    const costSource: "heuristic" | "override" = costOverride ? "override" : "heuristic";
    const shortfallAtEvent        = heuristicEventCost - projectedBalanceAtEvent;

    // Base EOL projection (lessee continues paying)
    const projectedBalanceAtEOL = comp.cumulativeBalance + monthsToEOL * monthlyAccrual;

    // EOL obligation: units used from full interval × rate
    const remainingAtEOL = Math.max(0, remainingUnits - monthsToEOL * monthlyUtil);
    const usedInInterval = (h?.intervalFH ?? comp.fullIntervalUnits) - remainingAtEOL;
    const eolObligation  = usedInInterval * comp.rateAmount;

    // Conservative (distressed: lessee stops paying today)
    const distressedBalance     = comp.cumulativeBalance;
    const currentUsed           = comp.fullIntervalUnits - remainingUnits;
    const currentObligation     = currentUsed * comp.rateAmount;
    const distressedEOLShortfall = currentObligation - distressedBalance;

    return {
      component:                comp.component as ComponentName,
      currentBalance:           comp.cumulativeBalance,
      monthlyAccrual,
      monthsToNextEvent,
      nextEventDate,
      projectedBalanceAtEvent,
      heuristicEventCost,
      costSource,
      costOverrideMeta: costOverride
        ? { createdBy: costOverride.createdBy, updatedAt: costOverride.updatedAt, note: costOverride.note }
        : undefined,
      shortfallAtEvent,
      projectedBalanceAtEOL,
      eolObligation,
      eolShortfall:             eolObligation - projectedBalanceAtEOL,
      distressedEOLShortfall,
    };
  });
}

// ─── Draft form ───────────────────────────────────────────────────────────────

interface DraftForm {
  reportDate:          string;
  annualFH:            string;
  annualCy:             string;
  showComponents:      boolean;
  componentRemaining:  Record<string, string>; // component name → string (empty = not overridden)
  showCostOverrides:   boolean;
  costOverrides:       Record<string, string>; // component name → cost string (empty = not overridden)
  costNote:            string;                  // single shared note for whichever costs are changed
}

function emptyDraft(): DraftForm {
  return {
    reportDate: "", annualFH: "", annualCy: "", showComponents: false, componentRemaining: {},
    showCostOverrides: false, costOverrides: {}, costNote: "",
  };
}

function draftFromReport(r: ServicerReport, costOverrides: Record<string, CostOverride>): DraftForm {
  return {
    reportDate:         r.reportDate,
    annualFH:           String(r.annualFH),
    annualCy:           String(r.annualCy),
    showComponents:     Object.keys(r.componentOverrides).length > 0,
    componentRemaining: Object.fromEntries(
      Object.entries(r.componentOverrides).map(([k, v]) => [k, String(v)])
    ),
    showCostOverrides:  Object.keys(costOverrides).length > 0,
    costOverrides:      Object.fromEntries(
      Object.entries(costOverrides).map(([k, v]) => [k, String(v.costUSD)])
    ),
    costNote:           "",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  msn: string;
  aircraftType: string;
  vintage: number;
  liveRecord?: LeaseSDMR;
}

export function MaintenanceForecastTab({ msn, aircraftType, vintage: _, liveRecord }: Props) {
  const [showDistressed, setShowDistressed] = React.useState(false);
  const [expandedComp, setExpandedComp] = React.useState<string | null>(null);

  // Prefer live data; fall back to hardcoded LEASE_CONTEXT for demo mode
  const ctx = liveRecord
    ? { leaseId: liveRecord.leaseId, leaseEnd: liveRecord.leaseEnd ?? "", stage: String(liveRecord.stage ?? 1) }
    : LEASE_CONTEXT[msn];

  const leaseRecord: LeaseSDMR | undefined = liveRecord ?? (ctx ? sdmrData.find((l) => l.leaseId === ctx.leaseId) : undefined);

  // ── Servicer report hook (must be above early return per Rules of Hooks) ──
  const leaseId = liveRecord?.leaseId ?? ctx?.leaseId ?? null;
  const { report, saving, saveReport, clearReport } = useServicerReport(leaseId);
  const { overrides: costOverrides, saving: costSaving, saveOverrides, clearOverrides } = useCostOverrides(leaseId);

  const [panelOpen, setPanelOpen] = React.useState(false);
  const [draft,     setDraft    ] = React.useState<DraftForm>(emptyDraft);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (report) {
      setDraft(draftFromReport(report, costOverrides));
    } else {
      setDraft(d => ({ ...emptyDraft(), showCostOverrides: Object.keys(costOverrides).length > 0,
        costOverrides: Object.fromEntries(Object.entries(costOverrides).map(([k, v]) => [k, String(v.costUSD)])) }));
    }
  }, [report, costOverrides]);

  const utilOverride = report
    ? {
        annualFH:           report.annualFH,
        annualCy:           report.annualCy,
        componentRemaining: report.componentOverrides,
      }
    : undefined;

  if (!ctx || !leaseRecord) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
        No maintenance data available for MSN {msn}.
      </div>
    );
  }

  const leaseEndDate = new Date(ctx.leaseEnd);
  const now = new Date(2026, 4, 1);
  const monthsToEOL = Math.max(0, monthsBetween(now, leaseEndDate));

  const projections = buildProjections(leaseRecord, aircraftType, leaseEndDate, utilOverride, costOverrides);
  const adeq = computeMRAdequacy(projections);

  const totalCurrentBalance  = projections.reduce((s, p) => s + p.currentBalance, 0);
  const totalProjectedAtEOL  = projections.reduce((s, p) => s + p.projectedBalanceAtEOL, 0);
  const totalEOLObligation   = projections.reduce((s, p) => s + p.eolObligation, 0);
  const totalEOLShortfall    = totalEOLObligation - totalProjectedAtEOL;
  const totalDistressedShort = projections.reduce((s, p) => s + p.distressedEOLShortfall, 0);

  const flag: MRAdeqFlag = adeq.flag;
  const flagColor  = mrFlagColor(flag);
  const flagBg     = mrFlagBg(flag);
  const flagBorder = mrFlagBorder(flag);

  const adequacyLabel: Record<MRAdeqFlag, string> = {
    green: "All events covered — MR surplus at EOL",
    amber: "Shortfall at one or more events",
    red:   "Shortfall >20% at EOL",
  };

  async function handleSave() {
    if (!leaseId) return;
    setSaveError(null);

    // Build cost-override changes — omit empty fields
    const costChanges: Record<string, number> = {};
    for (const [comp, val] of Object.entries(draft.costOverrides)) {
      if (val === "") continue;
      const n = parseFloat(val);
      if (!isNaN(n) && n >= 0) costChanges[comp] = n;
    }

    // Servicer-report fields are only required if the user is actually
    // providing servicer data — not just a cost override. Without this
    // check, a user who only wants to correct one component's cost would
    // be forced to also fill in report date/FH/cycles they may not have.
    const wantsServicerReport = draft.reportDate !== "" || draft.annualFH !== "" || draft.annualCy !== "";

    if (wantsServicerReport) {
      const fh = parseInt(draft.annualFH, 10);
      const cy = parseInt(draft.annualCy, 10);
      if (!draft.reportDate) { setSaveError("Report date is required."); return; }
      if (isNaN(fh) || fh < 1 || fh > 8760) { setSaveError("Annual FH must be between 1 and 8760."); return; }
      if (isNaN(cy) || cy < 1 || cy > 8760) { setSaveError("Annual cycles must be between 1 and 8760."); return; }
    }

    if (!wantsServicerReport && Object.keys(costChanges).length === 0) {
      setSaveError("Enter servicer data or a cost override before saving.");
      return;
    }

    // Build componentOverrides — omit empty fields
    const componentOverrides: Record<string, number> = {};
    for (const [comp, val] of Object.entries(draft.componentRemaining)) {
      if (val === "") continue;
      const n = parseInt(val, 10);
      if (!isNaN(n) && n >= 0) componentOverrides[comp] = n;
    }

    let reportSaved = false;
    try {
      if (wantsServicerReport) {
        const fh = parseInt(draft.annualFH, 10);
        const cy = parseInt(draft.annualCy, 10);
        await saveReport({
          leaseId,
          msn,
          reportDate:         draft.reportDate,
          annualFH:           fh,
          annualCy:           cy,
          componentOverrides,
        });
        reportSaved = true;
      }
      if (Object.keys(costChanges).length > 0) {
        await saveOverrides(costChanges, draft.costNote || null);
      }
      setPanelOpen(false);
    } catch {
      // If the servicer report already committed before the cost-override
      // save threw, say so — otherwise the user has no way to know half
      // their save landed and may re-enter data that's already saved.
      setSaveError(
        reportSaved
          ? "Servicer report saved, but the cost override failed. Please try again."
          : "Failed to save. Please try again.",
      );
    }
  }

  return (
    <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Servicer Report Panel ─────────────────────────────────────────── */}
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.5rem", overflow: "hidden" }}>

        {/* Collapsed banner — always visible */}
        <div
          onClick={() => { setPanelOpen(o => !o); setSaveError(null); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.875rem", cursor: "pointer", userSelect: "none" } as React.CSSProperties}
        >
          <span style={{ fontSize: "0.75rem", color: "#475569" }}>
            {report
              ? <>
                  <span style={{ background: "#002147", color: "#fff", fontSize: "0.625rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 6px", marginRight: "0.5rem" }}>LIVE</span>
                  Servicer report · {parseDateLocal(report.reportDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {report.annualFH.toLocaleString()} FH/yr · {report.annualCy.toLocaleString()} cy/yr
                </>
              : <span style={{ color: "#94A3B8" }}>Heuristic utilisation · {aircraftType} fleet average · <span style={{ color: "#002147", fontWeight: 600 }}>+ Add servicer data</span></span>
            }
          </span>
          {panelOpen ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
        </div>

        {/* Expanded form */}
        {panelOpen && (
          <div style={{ padding: "0.875rem", borderTop: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: "0.875rem" }}>

            {/* Row 1: Report date */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                Report date
                <input
                  type="date"
                  value={draft.reportDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setDraft(d => ({ ...d, reportDate: e.target.value }))}
                  style={{ padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                />
              </label>
            </div>

            {/* Row 2: Annual FH + cycles */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                Annual FH
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={draft.annualFH}
                  placeholder="e.g. 3200"
                  onChange={e => setDraft(d => ({ ...d, annualFH: e.target.value }))}
                  style={{ width: "120px", padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                Annual cycles
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={draft.annualCy}
                  placeholder="e.g. 2100"
                  onChange={e => setDraft(d => ({ ...d, annualCy: e.target.value }))}
                  style={{ width: "120px", padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                />
              </label>
            </div>

            {/* Row 3: Per-component remaining units (optional, collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setDraft(d => ({ ...d, showComponents: !d.showComponents }))}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.75rem", color: "#475569", display: "flex", alignItems: "center", gap: "0.25rem" }}
              >
                {draft.showComponents ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Component remaining units <span style={{ color: "#94A3B8" }}>(optional)</span>
              </button>

              {draft.showComponents && (
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.625rem" }}>
                  {leaseRecord.mrComponents.map(comp => (
                    <label key={comp.component} style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                      {comp.component} <span style={{ fontWeight: 400, color: "#94A3B8" }}>({comp.rateBasis === "$/FH" ? "FH" : "cycles"})</span>
                      <input
                        type="number"
                        min={0}
                        max={comp.fullIntervalUnits}
                        value={draft.componentRemaining[comp.component] ?? ""}
                        placeholder={String(comp.remainingUnits)}
                        onChange={e => setDraft(d => ({
                          ...d,
                          componentRemaining: { ...d.componentRemaining, [comp.component]: e.target.value },
                        }))}
                        style={{ width: "110px", padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Row 4: Per-component cost overrides (optional, collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setDraft(d => ({ ...d, showCostOverrides: !d.showCostOverrides }))}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.75rem", color: "#475569", display: "flex", alignItems: "center", gap: "0.25rem" }}
              >
                {draft.showCostOverrides ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Component cost overrides <span style={{ color: "#94A3B8" }}>(optional)</span>
              </button>

              {draft.showCostOverrides && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginTop: "0.625rem" }}>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {leaseRecord.mrComponents.map(comp => {
                      const heuristic = TYPE_HEURISTICS[aircraftType]?.components[comp.component];
                      const placeholder = heuristic ? String(heuristic.costUSD) : "";
                      return (
                        <label key={comp.component} style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                          {comp.component} <span style={{ fontWeight: 400, color: "#94A3B8" }}>(USD)</span>
                          <input
                            type="number"
                            min={0}
                            value={draft.costOverrides[comp.component] ?? ""}
                            placeholder={placeholder}
                            onChange={e => setDraft(d => ({
                              ...d,
                              costOverrides: { ...d.costOverrides, [comp.component]: e.target.value },
                            }))}
                            style={{ width: "130px", padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                          />
                        </label>
                      );
                    })}
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                    Evidence note <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional — applies to whichever costs above you change)</span>
                    <input
                      type="text"
                      value={draft.costNote}
                      placeholder="e.g. Per MRO quote dated 2026-06-15"
                      onChange={e => setDraft(d => ({ ...d, costNote: e.target.value }))}
                      style={{ width: "100%", maxWidth: "420px", padding: "0.375rem 0.5rem", border: "1px solid #CBD5E1", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Save error */}
            {saveError && (
              <div style={{ fontSize: "0.75rem", color: "#B91C1C" }}>{saveError}</div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || costSaving}
                style={{ padding: "0.375rem 0.875rem", background: "#002147", color: "#FFFFFF", border: "none", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600, cursor: (saving || costSaving) ? "not-allowed" : "pointer", opacity: (saving || costSaving) ? 0.7 : 1 }}
              >
                {(saving || costSaving) ? "Saving…" : "Save"}
              </button>
              {(report || Object.keys(costOverrides).length > 0) && (
                <button
                  type="button"
                  onClick={() => { void clearReport(); void clearOverrides(); setPanelOpen(false); }}
                  disabled={saving || costSaving}
                  style={{ padding: "0.375rem 0.875rem", background: "transparent", color: "#B91C1C", border: "1px solid #FCA5A5", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                >
                  Reset to heuristic
                </button>
              )}
              <button
                type="button"
                onClick={() => { setPanelOpen(false); setSaveError(null); setDraft(report ? draftFromReport(report, costOverrides) : emptyDraft()); }}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "#94A3B8" }}
              >
                &#x2715; Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Top: Adequacy flag + EOL summary ─────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "1rem", alignItems: "start" }}>

        {/* Flag card */}
        <div style={{
          background: flagBg, border: `1px solid ${flagBorder}`,
          borderLeft: `3px solid ${flagColor}`, borderRadius: "0.625rem",
          padding: "0.875rem 1.25rem", minWidth: "200px",
        }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>
            MR Adequacy
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "1.25rem" }}>
              {flag === "green"
                ? <i className="bi bi-circle-fill" style={{ color: "#15803D", fontSize: "0.6rem" }} />
                : flag === "amber"
                  ? <i className="bi bi-diamond-fill" style={{ color: "#B45309", fontSize: "0.6rem" }} />
                  : <i className="bi bi-triangle-fill" style={{ color: "#B91C1C", fontSize: "0.6rem" }} />}
            </span>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: flagColor, textTransform: "capitalize" }}>
              {flag === "green" ? "Adequate" : flag === "amber" ? "Attention" : "Shortfall"}
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: flagColor }}>{adequacyLabel[flag]}</div>
        </div>

        {/* EOL position strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          {[
            { label: "Current MR Balance",   value: fmtUSD(totalCurrentBalance),             sub: "Held today"                    },
            { label: "Projected at EOL",      value: fmtUSD(totalProjectedAtEOL),             sub: `+${monthsToEOL} months accrual` },
            {
              label: adeq.eolShortfall > 0 ? "EOL Shortfall" : "EOL Surplus",
              value: fmtUSD(Math.abs(adeq.eolShortfall)),
              sub:   `${((Math.abs(adeq.eolShortfall) / Math.max(1, totalEOLObligation)) * 100).toFixed(1)}% of obligation`,
              alert: adeq.eolShortfall > 0,
            },
          ].map(({ label, value, sub, alert }) => (
            <div key={label} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "0.75rem" }}>
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>{label}</div>
              <div style={{ fontSize: "1.125rem", fontWeight: 700, color: alert ? "#B91C1C" : "#0F172A", fontVariantNumeric: "tabular-nums" }}>{value}</div>
              <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Scenario toggle */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "140px" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>Projection Mode</div>
          {(["base", "distressed"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setShowDistressed(m === "distressed")}
              style={{
                padding: "0.375rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600,
                cursor: "pointer", border: "1px solid",
                background: (m === "distressed") === showDistressed ? "#002147" : "transparent",
                color:      (m === "distressed") === showDistressed ? "#FFFFFF" : "#475569",
                borderColor:(m === "distressed") === showDistressed ? "#002147" : "#E2E8F0",
              }}
            >
              {m === "base" ? "Base (lessee pays)" : "Conservative (distress)"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lease context ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "1.5rem", padding: "0.625rem 0.875rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.5rem", fontSize: "0.8125rem", color: "#475569", flexWrap: "wrap" }}>
        <span><strong style={{ color: "#0F172A" }}>Lease ends:</strong> {fmtDate(leaseEndDate)} ({monthsToEOL} months remaining)</span>
        <span><strong style={{ color: "#0F172A" }}>Aircraft type:</strong> {aircraftType}</span>
        <span><strong style={{ color: "#0F172A" }}>IFRS Stage:</strong> {ctx.stage}</span>
        <span><strong style={{ color: "#0F172A" }}>Projection:</strong> {showDistressed ? "Conservative — no future MR payments assumed" : "Base — lessee continues at contracted rate"}</span>
      </div>

      {/* ── Component Projection Table ────────────────────────────────── */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E2E8F0", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Component Projection Table</span>
          <span style={{ fontWeight: 400, color: "#94A3B8", textTransform: "none" }}>
            Source: IATA MCTF / IAWG heuristic · per-component overrides shown above when evidenced · Cirium adapter in Phase 3
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {(["Component", "Current MR Balance", "Monthly Accrual", "Next Event", "Proj. Balance @ Event", "Event Cost", "Shortfall / Surplus @ Event", "Proj. Balance @ EOL", "EOL Obligation", "EOL Position"] as const).map((h) => (
                  <th key={h} style={{ padding: "0.5rem 0.875rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    {h === "Monthly Accrual" && report
                      ? <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                          Monthly Accrual
                          <span style={{ background: "#002147", color: "#fff", fontSize: "0.5625rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 5px" }}>LIVE</span>
                        </span>
                      : h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projections.map((p, i) => {
                const eventShortfall    = p.shortfallAtEvent;
                const eolPos            = showDistressed
                  ? p.distressedEOLShortfall
                  : p.eolShortfall;
                const eventColor        = eventShortfall > 0 ? "#B91C1C" : "#15803D";
                const eolColor          = eolPos > 0 ? "#B91C1C" : "#15803D";
                const eventIcon         = eventShortfall > 0
                  ? <i className="bi bi-triangle-fill" style={{ color: "#B91C1C", fontSize: "0.6rem" }} />
                  : <i className="bi bi-circle-fill" style={{ color: "#15803D", fontSize: "0.6rem" }} />;
                const eolIcon           = eolPos > 0
                  ? <i className="bi bi-triangle-fill" style={{ color: "#B91C1C", fontSize: "0.6rem" }} />
                  : <i className="bi bi-circle-fill" style={{ color: "#15803D", fontSize: "0.6rem" }} />;

                return (
                  <tr
                    key={p.component}
                    style={{ borderTop: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", cursor: "pointer" }}
                    onClick={() => setExpandedComp(expandedComp === p.component ? null : p.component)}
                  >
                    <td style={{ padding: "0.625rem 0.875rem", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>{p.component}</td>
                    <td style={{ padding: "0.625rem 0.875rem", fontVariantNumeric: "tabular-nums", color: "#0F172A" }}>{fmtUSD(p.currentBalance)}</td>
                    <td style={{ padding: "0.625rem 0.875rem", fontVariantNumeric: "tabular-nums", color: "#475569" }}>
                      {showDistressed ? <span style={{ color: "#94A3B8" }}>— paused</span> : fmtUSD(p.monthlyAccrual) + "/mo"}
                    </td>
                    <td style={{ padding: "0.625rem 0.875rem", color: "#475569", whiteSpace: "nowrap" }}>
                      {fmtDate(p.nextEventDate)}
                      <span style={{ display: "block", fontSize: "0.6875rem", color: "#94A3B8" }}>
                        {p.monthsToNextEvent > monthsToEOL ? "After EOL" : `In ${p.monthsToNextEvent.toFixed(0)} mo`}
                      </span>
                    </td>
                    <td style={{ padding: "0.625rem 0.875rem", fontVariantNumeric: "tabular-nums", color: "#0F172A" }}>
                      {fmtUSD(showDistressed ? p.currentBalance : p.projectedBalanceAtEvent)}
                    </td>
                    <td style={{ padding: "0.625rem 0.875rem", fontVariantNumeric: "tabular-nums", color: "#475569" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        {fmtUSD(p.heuristicEventCost)}
                        {p.costSource === "override" ? (
                          <span
                            title={p.costOverrideMeta ? `Set by ${p.costOverrideMeta.createdBy} on ${new Date(p.costOverrideMeta.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${p.costOverrideMeta.note ? ` — ${p.costOverrideMeta.note}` : ""}` : undefined}
                            style={{ background: "#002147", color: "#fff", fontSize: "0.5625rem", fontWeight: 700, borderRadius: "9999px", padding: "1px 6px", cursor: "help" }}
                          >
                            Override
                          </span>
                        ) : (
                          <span style={{ color: "#94A3B8", fontSize: "0.5625rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                            Heuristic
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "0.625rem 0.875rem", fontWeight: 600, color: eventColor, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      <span>{eventIcon}</span>{" "}
                      {Math.abs(eventShortfall) >= 1_000 ? fmtUSD(Math.abs(eventShortfall)) : "—"}
                      <span style={{ fontWeight: 400, fontSize: "0.6875rem", marginLeft: "0.25rem" }}>
                        {eventShortfall > 0 ? "shortfall" : "surplus"}
                      </span>
                    </td>
                    <td style={{ padding: "0.625rem 0.875rem", fontVariantNumeric: "tabular-nums", color: "#0F172A" }}>
                      {fmtUSD(showDistressed ? p.currentBalance : p.projectedBalanceAtEOL)}
                    </td>
                    <td style={{ padding: "0.625rem 0.875rem", fontVariantNumeric: "tabular-nums", color: "#475569" }}>{fmtUSD(p.eolObligation)}</td>
                    <td style={{ padding: "0.625rem 0.875rem", fontWeight: 700, color: eolColor, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      <span>{eolIcon}</span>{" "}
                      {fmtUSD(Math.abs(eolPos))}
                      <span style={{ fontWeight: 400, fontSize: "0.6875rem", marginLeft: "0.25rem" }}>
                        {eolPos > 0 ? "shortfall" : "surplus"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F4F5F7" }}>
                <td colSpan={4} style={{ padding: "0.625rem 0.875rem", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem" }}>Portfolio Total</td>
                <td style={{ padding: "0.625rem 0.875rem", fontWeight: 700, color: "#002147", fontVariantNumeric: "tabular-nums" }}>
                  {fmtUSD(showDistressed ? totalCurrentBalance : projections.reduce((s, p) => s + p.projectedBalanceAtEvent, 0))}
                </td>
                <td style={{ padding: "0.625rem 0.875rem", fontWeight: 700, color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                  {fmtUSD(projections.reduce((s, p) => s + p.heuristicEventCost, 0))}
                </td>
                <td />
                <td style={{ padding: "0.625rem 0.875rem", fontWeight: 700, color: "#002147", fontVariantNumeric: "tabular-nums" }}>
                  {fmtUSD(showDistressed ? totalCurrentBalance : totalProjectedAtEOL)}
                </td>
                <td style={{ padding: "0.625rem 0.875rem", fontWeight: 700, color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                  {fmtUSD(totalEOLObligation)}
                </td>
                <td style={{ padding: "0.625rem 0.875rem", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                  color: (showDistressed ? totalDistressedShort : totalEOLShortfall) > 0 ? "#B91C1C" : "#15803D" }}>
                  {fmtUSD(Math.abs(showDistressed ? totalDistressedShort : totalEOLShortfall))}
                  <span style={{ fontWeight: 400, fontSize: "0.6875rem", marginLeft: "0.25rem" }}>
                    {(showDistressed ? totalDistressedShort : totalEOLShortfall) > 0 ? "shortfall" : "surplus"}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── ECL Linkage Notice ────────────────────────────────────────── */}
      {adeq.eolShortfall > 0 && (
        <div style={{
          display: "flex", gap: "0.75rem", alignItems: "flex-start",
          background: "rgba(185,28,28,0.04)", border: "1px solid rgba(185,28,28,0.15)",
          borderRadius: "0.5rem", padding: "0.875rem 1rem",
        }}>
          <Info size={14} style={{ color: "#B91C1C", flexShrink: 0, marginTop: "0.1rem" }} />
          <div style={{ fontSize: "0.8125rem", color: "#0F172A", lineHeight: 1.6 }}>
            <strong style={{ color: "#B91C1C" }}>ECL Impact: </strong>
            Projected MR shortfall of <strong>{fmtUSD(adeq.eolShortfall)}</strong> reduces LGD offset in the ECL module.
            The lessor's net recovery at EOL is reduced by this amount, increasing expected credit loss.
            {" "}<span style={{ color: "#002147", fontWeight: 600 }}>→ See ECL by Lease tab for adjusted LGD.</span>
          </div>
        </div>
      )}

      {/* ── Methodology footnote ─────────────────────────────────────── */}
      <div style={{ fontSize: "0.6875rem", color: "#94A3B8", borderTop: "1px solid #F1F5F9", paddingTop: "0.75rem", lineHeight: 1.7 }}>
        <strong>Assumptions:</strong> Heuristic event costs sourced from IATA MCTF & IAWG published cost ranges.
        {Object.keys(costOverrides).length > 0 && (
          <> {Object.keys(costOverrides).length} component{Object.keys(costOverrides).length !== 1 ? "s" : ""} overridden from evidence on this lease ({Object.keys(costOverrides).join(", ")}) — see table above for detail.</>
        )}
        {report
          ? <> Utilisation sourced from servicer report dated {parseDateLocal(report.reportDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · Annual FH: {report.annualFH.toLocaleString()} · Annual cycles: {report.annualCy.toLocaleString()}.</>
          : <> Base utilisation: {aircraftType} fleet average ({TYPE_HEURISTICS[aircraftType]?.utilizationFH?.toLocaleString() ?? "N/A"} FH/yr, {TYPE_HEURISTICS[aircraftType]?.utilizationCy?.toLocaleString() ?? "N/A"} cy/yr).</>
        }
        {" "}Base projection assumes lessee continues MR payments at contracted rate for {monthsToEOL} months until EOL.
        Conservative projection assumes MR payments cease immediately (applicable to Stage 3 / distress review).
        EOL obligation = cost to restore aircraft to full-life condition at redelivery.
      </div>
    </div>
  );
}
