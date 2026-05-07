import { useState } from "react";
import { Info } from "lucide-react";
import {
  TYPE_HEURISTICS,
  MR_ADEQUACY,
  mrFlagColor,
  mrFlagBg,
  mrFlagBorder,
  type MRAdeqFlag,
  type ComponentName,
} from "../../data/maintenanceHeuristics";
import { sdmrData, type MRComponent } from "./SDMRTab";

// ─── Lease context table (mirrors Portfolio.tsx leases[]) ─────────────────────
const LEASE_CONTEXT: Record<string, { leaseId: string; leaseEnd: string; stage: string }> = {
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

// ─── Projection logic ─────────────────────────────────────────────────────────

interface ComponentProjection {
  component: ComponentName;
  currentBalance: number;
  monthlyAccrual: number;         // assumes lessee keeps paying
  monthsToNextEvent: number;
  nextEventDate: Date;
  projectedBalanceAtEvent: number;
  heuristicEventCost: number;
  shortfallAtEvent: number;       // +ve = shortfall, -ve = surplus
  projectedBalanceAtEOL: number;
  eolObligation: number;          // contractual obligation at full-life return
  eolShortfall: number;           // +ve = shortfall, -ve = surplus
  distressedEOLShortfall: number; // conservative: lessee stops paying today
}

function buildProjections(
  msn: string,
  aircraftType: string,
  leaseEndDate: Date,
  stage: string,
): ComponentProjection[] {
  const ctx = LEASE_CONTEXT[msn];
  if (!ctx) return [];

  const lease = sdmrData.find((l) => l.leaseId === ctx.leaseId);
  if (!lease) return [];

  const heuristic = TYPE_HEURISTICS[aircraftType] ?? TYPE_HEURISTICS["A320neo"];
  const now = new Date(2026, 4, 1); // May 2026 (app reference date)
  const monthsToEOL = Math.max(0, monthsBetween(now, leaseEndDate));

  return lease.mrComponents.map((comp: MRComponent): ComponentProjection => {
    const h = heuristic.components[comp.component];
    const monthlyUtil = comp.rateBasis === "$/FH"
      ? heuristic.utilizationFH / 12
      : heuristic.utilizationCy / 12;

    const monthlyAccrual    = comp.rateAmount * monthlyUtil;
    const monthsToNextEvent = comp.remainingUnits / monthlyUtil;
    const nextEventDate     = addMonths(now, monthsToNextEvent);

    // Projected balance at next event (base: lessee keeps paying)
    const projectedBalanceAtEvent = comp.cumulativeBalance + comp.remainingUnits * comp.rateAmount;
    const heuristicEventCost      = h ? h.costUSD : comp.fullIntervalUnits * comp.rateAmount;
    const shortfallAtEvent        = heuristicEventCost - projectedBalanceAtEvent;

    // Base EOL projection (lessee continues paying)
    const projectedBalanceAtEOL = comp.cumulativeBalance + monthsToEOL * monthlyAccrual;

    // EOL obligation: units used from full interval × rate
    const remainingAtEOL = Math.max(0, comp.remainingUnits - monthsToEOL * monthlyUtil);
    const usedInInterval = (h?.intervalFH ?? comp.fullIntervalUnits) - remainingAtEOL;
    const eolObligation  = usedInInterval * comp.rateAmount;

    // Conservative (distressed: lessee stops paying today)
    const distressedBalance     = comp.cumulativeBalance;
    const currentUsed           = comp.fullIntervalUnits - comp.remainingUnits;
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
      shortfallAtEvent,
      projectedBalanceAtEOL,
      eolObligation,
      eolShortfall:             eolObligation - projectedBalanceAtEOL,
      distressedEOLShortfall,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  msn: string;
  aircraftType: string;
  vintage: number;
}

export function MaintenanceForecastTab({ msn, aircraftType, vintage: _ }: Props) {
  const [showDistressed, setShowDistressed] = useState(false);
  const [expandedComp, setExpandedComp] = useState<string | null>(null);

  const ctx = LEASE_CONTEXT[msn];
  const adeq = ctx ? MR_ADEQUACY[ctx.leaseId] : null;

  if (!ctx) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
        No maintenance data available for MSN {msn}.
      </div>
    );
  }

  const leaseEndDate = new Date(ctx.leaseEnd);
  const now = new Date(2026, 4, 1);
  const monthsToEOL = Math.max(0, monthsBetween(now, leaseEndDate));

  const projections = buildProjections(msn, aircraftType, leaseEndDate, ctx.stage);

  const totalCurrentBalance  = projections.reduce((s, p) => s + p.currentBalance, 0);
  const totalProjectedAtEOL  = projections.reduce((s, p) => s + p.projectedBalanceAtEOL, 0);
  const totalEOLObligation   = projections.reduce((s, p) => s + p.eolObligation, 0);
  const totalEOLShortfall    = totalEOLObligation - totalProjectedAtEOL;
  const totalDistressedShort = projections.reduce((s, p) => s + p.distressedEOLShortfall, 0);

  const flag: MRAdeqFlag = adeq?.flag ?? "green";
  const flagColor  = mrFlagColor(flag);
  const flagBg     = mrFlagBg(flag);
  const flagBorder = mrFlagBorder(flag);

  const adequacyLabel: Record<MRAdeqFlag, string> = {
    green: "All events covered — MR surplus at EOL",
    amber: "Shortfall at one or more events",
    red:   "Shortfall >20% at EOL",
  };

  return (
    <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

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
              label: adeq && adeq.eolShortfall > 0 ? "EOL Shortfall" : "EOL Surplus",
              value: fmtUSD(Math.abs(adeq?.eolShortfall ?? totalEOLShortfall)),
              sub:   `${((Math.abs(adeq?.eolShortfall ?? totalEOLShortfall) / Math.max(1, totalEOLObligation)) * 100).toFixed(1)}% of obligation`,
              alert: (adeq?.eolShortfall ?? totalEOLShortfall) > 0,
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
            Source: IATA MCTF / IAWG heuristic · Cirium adapter in Phase 3
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Component", "Current MR Balance", "Monthly Accrual", "Next Event", "Proj. Balance @ Event", "Event Cost (Heuristic)", "Shortfall / Surplus @ Event", "Proj. Balance @ EOL", "EOL Obligation", "EOL Position"].map((h) => (
                  <th key={h} style={{ padding: "0.5rem 0.875rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
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
                    <td style={{ padding: "0.625rem 0.875rem", fontVariantNumeric: "tabular-nums", color: "#475569" }}>{fmtUSD(p.heuristicEventCost)}</td>
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
      {adeq && adeq.eolShortfall > 0 && (
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
        Base projection assumes lessee continues MR payments at contracted rate for {monthsToEOL} months until EOL.
        Conservative projection assumes MR payments cease immediately (applicable to Stage 3 / distress review).
        EOL obligation = cost to restore aircraft to full-life condition at redelivery.
        Cirium MRO Forecast API adapter planned for Phase 3 to replace heuristics.
      </div>
    </div>
  );
}
