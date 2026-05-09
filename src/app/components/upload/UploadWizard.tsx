// src/app/components/upload/UploadWizard.tsx
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { DropZoneStep } from "./DropZoneStep";
import { ColumnMapStep } from "./ColumnMapStep";
import { ReviewImportStep } from "./ReviewImportStep";
import { suggestMapping } from "../../lib/columnMapper";

interface UploadWizardProps {
  orgId: string;
  onClose: () => void;
  onComplete: (uploadId: string, importedCount: number) => void;
}

type Step = "drop" | "map" | "review";

export function UploadWizard({ orgId, onClose, onComplete }: UploadWizardProps) {
  const [step, setStep] = React.useState<Step>("drop");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [filename, setFilename] = React.useState("");
  const [mapping, setMapping] = React.useState<Record<string, string | null>>({});
  const [importError, setImportError] = React.useState<string | null>(null);

  function handleFileParsed(h: string[], r: Record<string, string>[], file: File) {
    setHeaders(h);
    setRows(r);
    setFilename(file.name);
    setMapping(suggestMapping(h));
    setStep("map");
  }

  const STEP_LABELS: Record<Step, string> = {
    drop: "Upload File",
    map: "Map Columns",
    review: "Review & Import",
  };

  const STEPS: Step[] = ["drop", "map", "review"];
  const currentIndex = STEPS.indexOf(step);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        style={{
          background: "#FFFFFF", borderRadius: "12px", width: "640px",
          maxHeight: "88vh", overflow: "hidden", display: "flex",
          flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", background: "#002147", display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#FFFFFF" }}>Upload Portfolio Data</div>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "2px" }}>{STEP_LABELS[step]}</div>
          </div>
          {/* Step indicators */}
          <div style={{ display: "flex", gap: "6px", marginRight: "16px" }}>
            {STEPS.map((s, i) => (
              <div
                key={s}
                style={{
                  width: "24px", height: "4px", borderRadius: "2px",
                  background: i <= currentIndex ? "#FFFFFF" : "rgba(255,255,255,0.25)",
                  transition: "background 250ms",
                }}
              />
            ))}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.70)", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "24px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {step === "drop" && (
                <DropZoneStep onFileParsed={handleFileParsed} />
              )}
              {step === "map" && (
                <ColumnMapStep
                  detectedHeaders={headers}
                  initialMapping={mapping}
                  sampleRows={rows.slice(0, 3)}
                  onChange={setMapping}
                />
              )}
              {step === "review" && (
                <>
                  {importError && (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "10px 14px", fontSize: "0.8125rem", color: "#B91C1C", marginBottom: "16px" }}>
                      {importError}
                    </div>
                  )}
                  <ReviewImportStep
                    orgId={orgId}
                    filename={filename}
                    mapping={mapping}
                    rows={rows}
                    columnMap={mapping}
                    onComplete={onComplete}
                    onError={setImportError}
                  />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        {step !== "review" && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between" }}>
            <button
              onClick={() => setStep("drop")}
              style={{
                padding: "8px 16px", background: "transparent", color: "#475569",
                border: "1px solid #E2E8F0", borderRadius: "8px", fontWeight: 500,
                fontSize: "0.875rem", cursor: "pointer",
                visibility: step === "drop" ? "hidden" : "visible",
              }}
            >
              Back
            </button>
            {step === "map" && (
              <button
                onClick={() => setStep("review")}
                style={{
                  padding: "8px 20px", background: "#002147", color: "#FFFFFF",
                  border: "none", borderRadius: "8px", fontWeight: 600,
                  fontSize: "0.875rem", cursor: "pointer",
                }}
              >
                Review Import →
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
