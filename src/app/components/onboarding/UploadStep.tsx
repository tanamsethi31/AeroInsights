// src/app/components/onboarding/UploadStep.tsx
import * as React from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { DropZoneStep } from "../upload/DropZoneStep";
import { ColumnMapStep } from "../upload/ColumnMapStep";
import { ReviewImportStep } from "../upload/ReviewImportStep";
import { suggestMapping, OUR_FIELDS } from "../../lib/columnMapper";

interface UploadStepProps {
  orgId: string;
  /** When true (Upload Your Portfolio card), shows a required-columns
   *  reference panel beside the drop zone. */
  templateMode?: boolean;
  onComplete: (uploadId: string, count: number) => void;
  onSkip: () => void;
}

type SubStep = "drop" | "map" | "review";

// ─── Sidebar: required-columns reference ──────────────────────────────────────

function ColumnReferenceSidebar() {
  const [showOptional, setShowOptional] = React.useState(false);
  const requiredFields = OUR_FIELDS.filter(f => f.required);
  const optionalFields = OUR_FIELDS.filter(f => !f.required);

  return (
    // The sidebar uses a fixed outer height with a scrollable inner area so
    // that expanding "optional columns" scrolls inside the box rather than
    // pushing other content out of view.
    <div
      style={{
        background: "#F8FAFC",
        border: "1px solid #E2E8F0",
        borderRadius: "10px",
        padding: "16px",
        height: "440px",
        boxSizing: "border-box",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#0F172A" }}>
          Required columns
        </div>
        <span style={{
          fontSize: "0.625rem", fontWeight: 600,
          background: "#FEF3C7", color: "#B45309",
          padding: "1px 6px", borderRadius: "9999px",
        }}>
          {requiredFields.length}
        </span>
      </div>
      <div style={{ fontSize: "0.6875rem", color: "#64748B", marginBottom: "12px" }}>
        Use these exact headers in your spreadsheet.
      </div>

      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden", marginBottom: "12px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <tbody>
            {requiredFields.map((f, i) => (
              <tr key={f.id} style={{ borderBottom: i < requiredFields.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#0F172A", fontWeight: 600, width: "44%" }}>
                  {f.id}
                </td>
                <td style={{ padding: "6px 10px", color: "#64748B" }}>
                  {f.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setShowOptional(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: "5px",
          background: "none", border: "none", padding: 0,
          color: "#475569", fontSize: "0.75rem", fontWeight: 500,
          cursor: "pointer", textAlign: "left",
          marginBottom: showOptional ? "10px" : "0",
        }}
      >
        <ChevronDown
          size={12}
          style={{
            transform: showOptional ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms cubic-bezier(0.23,1,0.32,1)",
          }}
        />
        {showOptional ? "Hide" : "Show"} {optionalFields.length} optional columns
      </button>

      <AnimatePresence initial={false}>
        {showOptional && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                <tbody>
                  {optionalFields.map((f, i) => (
                    <tr key={f.id} style={{ borderBottom: i < optionalFields.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#0F172A", fontWeight: 600, width: "44%" }}>
                        {f.id}
                      </td>
                      <td style={{ padding: "6px 10px", color: "#64748B" }}>
                        {f.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UploadStep({ orgId, templateMode = false, onComplete, onSkip }: UploadStepProps) {
  const [subStep, setSubStep] = useState<SubStep>("drop");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [importError, setImportError] = useState<string | null>(null);

  function handleFileParsed(h: string[], r: Record<string, string>[], file: File) {
    setHeaders(h);
    setRows(r);
    setFilename(file.name);
    setMapping(suggestMapping(h));
    setSubStep("map");
  }

  // Show the columns-reference sidebar only in template mode AND only on the
  // drop sub-step (other sub-steps use the modal's full width for clarity).
  const showSidebar = templateMode && subStep === "drop";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {subStep === "drop" && (
        <>
          <div
            style={
              showSidebar
                ? { display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px", alignItems: "start" }
                : { display: "flex", flexDirection: "column" }
            }
          >
            <DropZoneStep onFileParsed={handleFileParsed} />
            {showSidebar && <ColumnReferenceSidebar />}
          </div>
          <div style={{ textAlign: "center" }}>
            <button
              onClick={onSkip}
              style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "0.875rem", cursor: "pointer" }}
            >
              Skip — I'll upload later
            </button>
          </div>
        </>
      )}
      {subStep === "map" && (
        <>
          <ColumnMapStep detectedHeaders={headers} initialMapping={mapping} sampleRows={rows.slice(0, 3)} onChange={setMapping} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setSubStep("drop")} style={{ padding: "8px 16px", background: "transparent", color: "#475569", border: "1px solid #E2E8F0", borderRadius: "8px", fontWeight: 500, fontSize: "0.875rem", cursor: "pointer" }}>
              Back
            </button>
            <button onClick={() => setSubStep("review")} style={{ padding: "8px 20px", background: "#002147", color: "#FFFFFF", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}>
              Review Import →
            </button>
          </div>
        </>
      )}
      {subStep === "review" && (
        <>
          {importError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "10px 14px", fontSize: "0.8125rem", color: "#B91C1C" }}>
              {importError}
            </div>
          )}
          <ReviewImportStep orgId={orgId} filename={filename} mapping={mapping} rows={rows} columnMap={mapping} onComplete={onComplete} onError={setImportError} />
          <button onClick={() => setSubStep("map")} style={{ alignSelf: "flex-start", padding: "8px 16px", background: "transparent", color: "#475569", border: "1px solid #E2E8F0", borderRadius: "8px", fontWeight: 500, fontSize: "0.875rem", cursor: "pointer" }}>
            Back
          </button>
        </>
      )}
    </div>
  );
}
