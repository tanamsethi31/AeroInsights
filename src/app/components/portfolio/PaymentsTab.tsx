// src/app/components/portfolio/PaymentsTab.tsx
// 12-month forward cashflow heatmap for the Portfolio Payments tab.

import * as React from "react";
import type { PaymentSchedule, PaymentRow, CellStatus } from "../../lib/paymentAdapters";
import { Card } from "../ui/Card";

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtM(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const DOT_COLOR: Record<string, string> = {
  "1": "#002147",
  "2": "#B45309",
  "3": "#B91C1C",
  "—": "#002147",
};

const ROW_BG: Record<string, string> = {
  "3": "#FFF5F5",
  "2": "#FFFDF0",
};

// ─── Cell renderer ────────────────────────────────────────────────────────────

function HeatCell({ status, stage, idx }: { status: CellStatus; stage: string; idx: number }) {
  const color = DOT_COLOR[stage] ?? "#002147";

  if (status === "expired") {
    return (
      <td key={idx} style={{ padding: "0.5rem 0.5rem", textAlign: "center", color: "#CBD5E1", fontSize: "0.8125rem" }}>
        —
      </td>
    );
  }

  if (status === "not-started") {
    return (
      <td key={idx} style={{ padding: "0.5rem 0.5rem", textAlign: "center" }}>
        &nbsp;
      </td>
    );
  }

  if (status === "expiring") {
    return (
      <td key={idx} style={{ padding: "0.5rem 0.5rem", textAlign: "center" }}>
        <span
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: color,
            outline: "2px solid #B45309",
            outlineOffset: 1,
          }}
        />
      </td>
    );
  }

  // active
  return (
    <td key={idx} style={{ padding: "0.5rem 0.5rem", textAlign: "center" }}>
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
        }}
      />
    </td>
  );
}

// ─── Sticky column widths and left offsets ────────────────────────────────────

const STICKY_COLS = [
  { label: "Lessee",    width: 140 },
  { label: "Aircraft",  width: 100 },
  { label: "Stage",     width: 60  },
  { label: "Rent/mo",   width: 90  },
];

function stickyLeft(colIdx: number): number {
  let left = 0;
  for (let i = 0; i < colIdx; i++) left += STICKY_COLS[i].width;
  return left;
}

const stickyBase: React.CSSProperties = {
  position: "sticky",
  background: "inherit",
  zIndex: 2,
};

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#F8FAFC",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        padding: "0.875rem 1.25rem",
        flex: "1 1 0",
        minWidth: 130,
      }}
    >
      <div style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PaymentsTabProps {
  schedule: PaymentSchedule;
}

export function PaymentsTab({ schedule }: PaymentsTabProps) {
  const { months, rows, monthlyTotals, grandTotal } = schedule;

  // KPI values
  const avgMonthly = grandTotal / 12;
  const atRiskIncome = rows
    .filter((r) => r.stage === "2" || r.stage === "3")
    .reduce((sum, r) => sum + r.rowTotal, 0);
  const leasesActive = rows.filter((r) =>
    r.cells.some((c) => c.status === "active" || c.status === "expiring"),
  ).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* KPI Strip */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <KPICard label="Avg Monthly"    value={fmtM(avgMonthly)} />
        <KPICard label="12M Total"      value={fmtM(grandTotal)} />
        <KPICard label="At-Risk Income" value={fmtM(atRiskIncome)} />
        <KPICard label="Leases Active"  value={String(leasesActive)} />
      </div>

      {/* Heatmap table */}
      <Card noPadding title="Payment Register">
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.8125rem",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {/* Sticky header cells */}
                {STICKY_COLS.map((col, ci) => (
                  <th
                    key={col.label}
                    style={{
                      ...stickyBase,
                      left: stickyLeft(ci),
                      width: col.width,
                      minWidth: col.width,
                      padding: "0.625rem 0.75rem",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#0F172A",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                      background: "#F8FAFC",
                      borderRight: ci === STICKY_COLS.length - 1 ? "1px solid #E2E8F0" : undefined,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
                {/* Month headers */}
                {months.map((m) => (
                  <th
                    key={m}
                    style={{
                      padding: "0.625rem 0.5rem",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#475569",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m}
                  </th>
                ))}
                {/* Row total header */}
                <th
                  style={{
                    padding: "0.625rem 0.75rem",
                    textAlign: "right",
                    fontWeight: 600,
                    color: "#0F172A",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                    borderLeft: "1px solid #E2E8F0",
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row: PaymentRow, rowIdx: number) => {
                const rowBg = ROW_BG[row.stage] ?? (rowIdx % 2 === 0 ? "#FFFFFF" : "#FAFBFC");
                return (
                  <tr key={row.leaseId} style={{ borderBottom: "1px solid #E2E8F0", background: rowBg }}>
                    {/* Sticky: Lessee */}
                    <td
                      style={{
                        ...stickyBase,
                        left: stickyLeft(0),
                        width: STICKY_COLS[0].width,
                        minWidth: STICKY_COLS[0].width,
                        padding: "0.5rem 0.75rem",
                        fontWeight: 600,
                        color: "#0F172A",
                        whiteSpace: "nowrap",
                        background: rowBg,
                      }}
                    >
                      {row.lessee}
                    </td>

                    {/* Sticky: Aircraft */}
                    <td
                      style={{
                        ...stickyBase,
                        left: stickyLeft(1),
                        width: STICKY_COLS[1].width,
                        minWidth: STICKY_COLS[1].width,
                        padding: "0.5rem 0.75rem",
                        color: "#475569",
                        whiteSpace: "nowrap",
                        background: rowBg,
                      }}
                    >
                      {row.aircraft}
                    </td>

                    {/* Sticky: Stage */}
                    <td
                      style={{
                        ...stickyBase,
                        left: stickyLeft(2),
                        width: STICKY_COLS[2].width,
                        minWidth: STICKY_COLS[2].width,
                        padding: "0.5rem 0.75rem",
                        color: row.stage === "3" ? "#B91C1C" : row.stage === "2" ? "#B45309" : "#475569",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        background: rowBg,
                      }}
                    >
                      {row.stage !== "—" ? `S${row.stage}` : "—"}
                    </td>

                    {/* Sticky: Rent/mo */}
                    <td
                      style={{
                        ...stickyBase,
                        left: stickyLeft(3),
                        width: STICKY_COLS[3].width,
                        minWidth: STICKY_COLS[3].width,
                        padding: "0.5rem 0.75rem",
                        color: "#0F172A",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        background: rowBg,
                        borderRight: "1px solid #E2E8F0",
                      }}
                    >
                      {fmtM(row.monthlyRental)}
                    </td>

                    {/* Month cells */}
                    {row.cells.map((cell, ci) => (
                      <HeatCell key={ci} idx={ci} status={cell.status} stage={row.stage} />
                    ))}

                    {/* Row total */}
                    <td
                      style={{
                        padding: "0.5rem 0.75rem",
                        textAlign: "right",
                        fontWeight: 600,
                        color: "#0F172A",
                        whiteSpace: "nowrap",
                        borderLeft: "1px solid #E2E8F0",
                      }}
                    >
                      {fmtM(row.rowTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr style={{ borderTop: "2px solid #CBD5E1", background: "#F1F5F9" }}>
                {/* Sticky footer cells */}
                <td
                  colSpan={STICKY_COLS.length}
                  style={{
                    position: "sticky",
                    left: 0,
                    background: "#F1F5F9",
                    zIndex: 2,
                    padding: "0.625rem 0.75rem",
                    fontWeight: 700,
                    color: "#0F172A",
                    fontSize: "0.8125rem",
                    borderRight: "1px solid #E2E8F0",
                  }}
                >
                  Monthly total
                </td>

                {/* Monthly total columns */}
                {monthlyTotals.map((total, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "0.625rem 0.5rem",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "#0F172A",
                      fontSize: "0.8125rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtM(total)}
                  </td>
                ))}

                {/* Grand total */}
                <td
                  style={{
                    padding: "0.625rem 0.75rem",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#0F172A",
                    fontSize: "0.8125rem",
                    whiteSpace: "nowrap",
                    borderLeft: "1px solid #E2E8F0",
                  }}
                >
                  {fmtM(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
