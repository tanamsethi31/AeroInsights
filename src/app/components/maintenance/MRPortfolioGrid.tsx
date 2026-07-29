import { useState, useMemo, useCallback, Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "../ui/Card";
import {
  mrFlagColor,
  mrFlagBg,
  type MRAdeqFlag,
} from "../../data/maintenanceHeuristics";
import type { AdjustedLease } from "../../utils/maintenanceEvents";
import {
  buildProjections,
  LEASE_CONTEXT,
  computeMRAdequacy,
  type ComponentProjection,
} from "../portfolio/MaintenanceForecastTab";

// ─── Reverse lookup: leaseId → { msn, leaseEnd } ─────────────────────────────
const CONTEXT_BY_LEASE_ID: Record<string, { msn: string; leaseEnd: string }> =
  Object.fromEntries(
    Object.entries(LEASE_CONTEXT).map(([msn, ctx]) => [
      ctx.leaseId,
      { msn, leaseEnd: ctx.leaseEnd },
    ])
  );

// ─── Helpers (defined locally — same logic as in MaintenanceForecastTab.tsx) ──

function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function componentFlag(p: ComponentProjection): MRAdeqFlag {
  if (p.eolShortfall > 0)            return "red";
  if (p.distressedEOLShortfall > 0)  return "amber";
  return "green";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  adjustedLeases: AdjustedLease[];
}

export function MRPortfolioGrid({ adjustedLeases }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = useCallback((leaseId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(leaseId) ? next.delete(leaseId) : next.add(leaseId);
      return next;
    });
  }, []);

  const rows = useMemo(() => {
    return adjustedLeases
      .map(({ lease, utilOverride }) => {
        const ctx = CONTEXT_BY_LEASE_ID[lease.leaseId];
        const leaseEndDate = lease.leaseEnd
          ? parseDateLocal(lease.leaseEnd)
          : ctx
          ? parseDateLocal(ctx.leaseEnd)
          : new Date(2028, 0, 1); // last-resort fallback

        const projections = buildProjections(lease, lease.aircraft, leaseEndDate, utilOverride);
        const adequacy = computeMRAdequacy(projections);
        const baseEOLShortfall = adequacy.eolShortfall;
        const distressedEOLShortfall = adequacy.distressedEOLShortfall;
        const overallFlag: MRAdeqFlag = adequacy.flag;
        const msn = ctx?.msn ?? null;

        return {
          lease,
          projections,
          baseEOLShortfall,
          distressedEOLShortfall,
          overallFlag,
          msn,
        };
      })
      .sort((a, b) => b.distressedEOLShortfall - a.distressedEOLShortfall);
  }, [adjustedLeases]);

  if (adjustedLeases.length === 0) return null;

  const redCount   = rows.filter((r) => r.overallFlag === "red").length;
  const amberCount = rows.filter((r) => r.overallFlag === "amber").length;
  const greenCount = rows.filter((r) => r.overallFlag === "green").length;

  return (
    <div>
      <Card noPadding>
        <div style={{ padding: "1.25rem 1.5rem" }}>
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Portfolio MR Overview
            </span>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              {(
                [
                  ["red",   "#B91C1C", redCount],
                  ["amber", "#B45309", amberCount],
                  ["green", "#15803D", greenCount],
                ] as const
              ).map(([key, color, count]) => (
                <div
                  key={key}
                  style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: color,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#0F172A",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── All-clear banner ────────────────────────────────────────── */}
          {redCount === 0 && amberCount === 0 && (
            <div
              style={{
                color: "#15803D",
                fontSize: "0.8125rem",
                fontWeight: 500,
                padding: "0.25rem 0 0.75rem",
              }}
            >
              All aircraft MR adequacy on track
            </div>
          )}

          {/* ── Table ───────────────────────────────────────────────────── */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
                <th style={{ width: "2rem", padding: "0.5rem 0.5rem" }} />
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    textAlign: "left",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Aircraft / MSN
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    textAlign: "left",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Lessee
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    textAlign: "left",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Flag
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    textAlign: "right",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Base EOL Shortfall
                </th>
                <th
                  style={{
                    padding: "0.5rem 1rem",
                    textAlign: "right",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: "#94A3B8",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Distressed EOL Shortfall
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.lease.leaseId}>
                  {/* ── Summary row ──────────────────────────────────── */}
                  <tr
                    onClick={() => toggle(row.lease.leaseId)}
                    style={{ cursor: "pointer", borderBottom: "1px solid #F1F5F9" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#F8FAFC")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "")
                    }
                  >
                    <td style={{ padding: "0.75rem 0.5rem", width: "2rem" }}>
                      <ChevronRight
                        size={14}
                        style={{
                          color: "#CBD5E1",
                          transform: expanded.has(row.lease.leaseId)
                            ? "rotate(90deg)"
                            : "rotate(0deg)",
                          transition: "transform 160ms ease",
                          display: "block",
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        color: "#0F172A",
                      }}
                    >
                      {row.lease.aircraft}
                      {row.msn && (
                        <span
                          style={{
                            marginLeft: "0.375rem",
                            fontSize: "0.75rem",
                            color: "#94A3B8",
                            fontFamily: "monospace",
                          }}
                        >
                          · {row.msn}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.8125rem",
                        color: "#475569",
                      }}
                    >
                      {row.lease.lessee}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: mrFlagColor(row.overallFlag),
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.8125rem",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                      }}
                    >
                      {row.baseEOLShortfall <= 0 ? (
                        <span style={{ color: "#15803D", fontWeight: 500 }}>✓</span>
                      ) : (
                        <span
                          style={{
                            color:
                              row.overallFlag === "red" ? "#B91C1C" : "#B45309",
                            fontWeight: 600,
                          }}
                        >
                          -{`$${(row.baseEOLShortfall / 1_000_000).toFixed(1)}m`}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        fontSize: "0.8125rem",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                      }}
                    >
                      {row.distressedEOLShortfall <= 0 ? (
                        <span style={{ color: "#15803D", fontWeight: 500 }}>✓</span>
                      ) : (
                        <span
                          style={{
                            color:
                              row.overallFlag === "red" ? "#B91C1C" : "#B45309",
                            fontWeight: 600,
                          }}
                        >
                          -{`$${(row.distressedEOLShortfall / 1_000_000).toFixed(1)}m`}
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* ── Expanded component rows ───────────────────────── */}
                  {expanded.has(row.lease.leaseId) && (
                    <>
                      {/* Sub-header */}
                      <tr
                        style={{
                          background: "#F8FAFC",
                          borderBottom: "1px solid #F1F5F9",
                        }}
                      >
                        <td />
                        <td
                          style={{
                            padding: "0.375rem 1rem 0.375rem 2.5rem",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            color: "#94A3B8",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Component
                        </td>
                        <td
                          style={{
                            padding: "0.375rem 1rem",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            color: "#94A3B8",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Balance
                        </td>
                        <td
                          style={{
                            padding: "0.375rem 1rem",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            color: "#94A3B8",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Flag
                        </td>
                        <td
                          style={{
                            padding: "0.375rem 1rem",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            color: "#94A3B8",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            textAlign: "right",
                          }}
                        >
                          Base EOL
                        </td>
                        <td
                          style={{
                            padding: "0.375rem 1rem",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            color: "#94A3B8",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            textAlign: "right",
                          }}
                        >
                          Distressed EOL
                        </td>
                      </tr>

                      {/* Component data rows */}
                      {row.projections.map((p) => {
                        const flag     = componentFlag(p);
                        const flagColor = mrFlagColor(flag);
                        const flagBg   = mrFlagBg(flag);
                        return (
                          <tr
                            key={p.component}
                            style={{
                              background: flagBg,
                              borderBottom: "1px solid #F1F5F9",
                            }}
                          >
                            <td />
                            <td
                              style={{
                                padding: "0.5rem 1rem 0.5rem 2.5rem",
                                fontSize: "0.75rem",
                                color: "#475569",
                              }}
                            >
                              {p.component}
                            </td>
                            <td
                              style={{
                                padding: "0.5rem 1rem",
                                fontSize: "0.75rem",
                                color: "#475569",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              ${(p.currentBalance / 1_000_000).toFixed(2)}m
                            </td>
                            <td style={{ padding: "0.5rem 1rem" }}>
                              <div
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: flagColor,
                                }}
                              />
                            </td>
                            <td
                              style={{
                                padding: "0.5rem 1rem",
                                fontSize: "0.75rem",
                                fontVariantNumeric: "tabular-nums",
                                textAlign: "right",
                              }}
                            >
                              {p.eolShortfall <= 0 ? (
                                <span style={{ color: "#15803D" }}>✓</span>
                              ) : (
                                <span style={{ color: "#B91C1C" }}>
                                  -${(p.eolShortfall / 1_000_000).toFixed(2)}m
                                </span>
                              )}
                            </td>
                            <td
                              style={{
                                padding: "0.5rem 1rem",
                                fontSize: "0.75rem",
                                fontVariantNumeric: "tabular-nums",
                                textAlign: "right",
                              }}
                            >
                              {p.distressedEOLShortfall <= 0 ? (
                                <span style={{ color: "#15803D" }}>✓</span>
                              ) : (
                                <span style={{ color: flagColor }}>
                                  -${(p.distressedEOLShortfall / 1_000_000).toFixed(2)}m
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
