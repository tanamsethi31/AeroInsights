import { useState, useMemo, Fragment } from "react";
import { ExternalLink } from "lucide-react";
import { Card } from "../ui/Card";
import { StatusPill } from "../ui/StatusPill";
import { useSortable, sortIcon, sortIconStyle } from "../ui/useSortable";
import type { Precedent, Jurisdiction } from "./jurisdictionData";

interface PrecedentTableProps {
  precedents: Precedent[];
  jurisdictions: Jurisdiction[];
}

export function PrecedentTable({ precedents, jurisdictions }: PrecedentTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState("All");

  // Store country codes in state; derive display names only for labels.
  // This avoids the fragile code→name→code roundtrip and prevents silent
  // collisions if two codes ever resolve to the same display name.
  const precedentCountryCodes = useMemo(
    () => Array.from(new Set(precedents.map((p) => p.country))).sort(),
    [precedents]
  );

  const filteredPrecedents = useMemo(
    () =>
      countryFilter === "All"
        ? precedents
        : precedents.filter((p) => p.country === countryFilter),
    [precedents, countryFilter]
  );

  const precedentAccessors = useMemo(
    () => ({
      year: (p: Precedent) => p.year,
      lessor: (p: Precedent) => p.lessor,
      airline: (p: Precedent) => p.airline,
      aircraft: (p: Precedent) => p.aircraft,
      outcome: (p: Precedent) => p.outcome,
    }),
    []
  );

  const {
    sorted: sortedPrecedents,
    sortState: precedentSortState,
    toggleSort: togglePrecedentSort,
  } = useSortable(filteredPrecedents, precedentAccessors);

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <Card
      title={`Repossession Precedent Database (${filteredPrecedents.length})`}
      subtitle="Public and AWG-sourced cases"
      noPadding
      headerRight={
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          style={{
            fontSize: "0.8125rem",
            color: "#475569",
            border: "1px solid #E2E8F0",
            borderRadius: "0.5rem",
            padding: "0.375rem 0.625rem",
            background: "#FFFFFF",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="All">All countries</option>
          {precedentCountryCodes.map((code) => (
            <option key={code} value={code}>
              {jurisdictions.find((j) => j.code === code)?.country ?? code}
            </option>
          ))}
        </select>
      }
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {(
                [
                  { label: "Case ID", key: null },
                  { label: "Year", key: "year" },
                  { label: "Lessor", key: "lessor" },
                  { label: "Airline", key: "airline" },
                  { label: "Country", key: null },
                  { label: "Aircraft", key: "aircraft" },
                  { label: "Timeline", key: null },
                  { label: "Outcome", key: "outcome" },
                  { label: "Source", key: null },
                ] as { label: string; key: string | null }[]
              ).map(({ label, key }) => (
                <th
                  key={label}
                  onClick={key ? () => togglePrecedentSort(key) : undefined}
                  style={{
                    padding: "0.625rem 1rem",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#64748B",
                    fontSize: "0.6875rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                    cursor: key ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {label}
                  {key && (
                    <span style={sortIconStyle(key, precedentSortState)}>
                      {sortIcon(key, precedentSortState)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPrecedents.map((p, i) => {
              const jur = jurisdictions.find((j) => j.code === p.country);
              const isExpanded = expandedId === p.id;
              const rowBg = i % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
              return (
                <Fragment key={p.id}>
                  <tr
                    onClick={() => toggleRow(p.id)}
                    style={{
                      borderBottom: isExpanded ? "none" : "1px solid #F1F5F9",
                      background: rowBg,
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ padding: "0.625rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#94A3B8" }}>
                      {p.id}
                    </td>
                    <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{p.year}</td>
                    <td style={{ padding: "0.625rem 1rem", fontWeight: 600, color: "#0F172A" }}>{p.lessor}</td>
                    <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{p.airline}</td>
                    <td style={{ padding: "0.625rem 1rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <span>{jur?.flag ?? ""}</span>
                        <span style={{ color: "#475569" }}>{jur?.country ?? p.country}</span>
                      </span>
                    </td>
                    <td style={{ padding: "0.625rem 1rem", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                      {p.aircraft}
                    </td>
                    <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{p.timeline}</td>
                    <td style={{ padding: "0.625rem 1rem" }}>
                      <StatusPill
                        stage={
                          p.outcome === "Returned"
                            ? "green"
                            : p.outcome === "Detained"
                            ? "red"
                            : "amber"
                        }
                        label={p.outcome}
                      />
                    </td>
                    <td style={{ padding: "0.625rem 1rem" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748B",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {p.source}
                      </span>
                      {p.sourceUrl && (
                        <a
                          href={p.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ lineHeight: 0 }}
                        >
                          <ExternalLink
                            size={11}
                            style={{ marginLeft: 4, color: "#002147", verticalAlign: "middle" }}
                          />
                        </a>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        background: rowBg,
                      }}
                    >
                      <td
                        colSpan={9}
                        style={{
                          padding: "0.75rem 1rem 1rem 1rem",
                          background: "#F8FAFC",
                          borderLeft: "3px solid #002147",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.8125rem",
                            color: "#0F172A",
                            lineHeight: 1.6,
                            marginBottom: "0.5rem",
                          }}
                        >
                          {p.notes}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "0.125rem 0.5rem",
                              borderRadius: "9999px",
                              fontSize: "0.6875rem",
                              fontWeight: 600,
                              background: p.ctcInvoked ? "#DCFCE7" : "#F1F5F9",
                              color: p.ctcInvoked ? "#15803D" : "#94A3B8",
                            }}
                          >
                            CTC Invoked: {p.ctcInvoked ? "Yes" : "No"}
                          </span>
                          {p.sourceUrl && (
                            <a
                              href={p.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: "0.8125rem",
                                color: "#002147",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                            >
                              View Source →
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
