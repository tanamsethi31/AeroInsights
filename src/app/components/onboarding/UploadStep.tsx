// src/app/components/onboarding/UploadStep.tsx
import * as React from "react";
import { useState } from "react";
import { DropZoneStep } from "../upload/DropZoneStep";
import { ColumnMapStep } from "../upload/ColumnMapStep";
import { ReviewImportStep } from "../upload/ReviewImportStep";
import { suggestMapping } from "../../lib/columnMapper";

interface UploadStepProps {
  orgId: string;
  onComplete: (uploadId: string, count: number) => void;
  onSkip: () => void;
}

type SubStep = "drop" | "map" | "review";

export function UploadStep({ orgId, onComplete, onSkip }: UploadStepProps) {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {subStep === "drop" && (
        <>
          <DropZoneStep onFileParsed={handleFileParsed} />
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
