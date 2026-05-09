// src/app/components/upload/ColumnMapStep.tsx
import * as React from "react";
import { OUR_FIELDS, REQUIRED_FIELDS, type FieldDef } from "../../lib/columnMapper";

interface ColumnMapStepProps {
  detectedHeaders: string[];
  initialMapping: Record<string, string | null>; // field id → detected header or null
  sampleRows: Record<string, string>[];           // first 3 rows for preview
  onChange: (mapping: Record<string, string | null>) => void;
}

export function ColumnMapStep({
  detectedHeaders,
  initialMapping,
  sampleRows,
  onChange,
}: ColumnMapStepProps) {
  const [mapping, setMapping] = React.useState<Record<string, string | null>>(initialMapping);

  function update(fieldId: string, value: string | null) {
    const next = { ...mapping, [fieldId]: value };
    setMapping(next);
    onChange(next);
  }

  const headerOptions = ["(skip)", ...detectedHeaders];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#475569", marginBottom: "4px" }}>
        Match your file's columns to our fields. Required fields are marked <span style={{ color: "#B91C1C" }}>*</span>.
        We've pre-filled suggestions — correct any that look wrong.
      </p>

      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
          padding: "6px 10px",
          background: "#F8FAFC",
          borderRadius: "6px",
          fontSize: "0.6875rem",
          fontWeight: 700,
          color: "#64748B",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        <span>Our field</span>
        <span>Your column</span>
        <span>Sample value</span>
      </div>

      {/* Field rows */}
      {OUR_FIELDS.map((field: FieldDef) => {
        const selected = mapping[field.id];
        const sample = selected && selected !== "(skip)"
          ? (sampleRows[0]?.[selected] ?? "—")
          : "—";
        const isRequired = REQUIRED_FIELDS.includes(field.id);
        const isMissing = isRequired && (!selected || selected === "(skip)");

        return (
          <div
            key={field.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px",
              padding: "8px 10px",
              border: `1px solid ${isMissing ? "#FECACA" : "#E2E8F0"}`,
              borderRadius: "6px",
              background: isMissing ? "#FEF2F2" : "#FFFFFF",
              alignItems: "center",
            }}
          >
            <div>
              <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#0F172A" }}>
                {field.label}
              </span>
              {isRequired && <span style={{ color: "#B91C1C", marginLeft: "3px" }}>*</span>}
              <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "1px" }}>
                {field.description}
              </div>
            </div>

            <select
              value={selected ?? "(skip)"}
              onChange={(e) => update(field.id, e.target.value === "(skip)" ? null : e.target.value)}
              style={{
                padding: "6px 8px",
                border: `1px solid ${isMissing ? "#FECACA" : "#E2E8F0"}`,
                borderRadius: "6px",
                fontSize: "0.8125rem",
                color: "#0F172A",
                background: "#FFFFFF",
                cursor: "pointer",
                width: "100%",
              }}
            >
              {headerOptions.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            <span
              style={{
                fontSize: "0.75rem",
                color: sample === "—" ? "#CBD5E1" : "#475569",
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {sample}
            </span>
          </div>
        );
      })}
    </div>
  );
}
