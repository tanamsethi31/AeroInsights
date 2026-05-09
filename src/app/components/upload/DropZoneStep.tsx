// src/app/components/upload/DropZoneStep.tsx
import * as React from "react";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { OUR_FIELDS } from "../../lib/columnMapper";
import * as XLSX from "xlsx";

interface DropZoneStepProps {
  onFileParsed: (headers: string[], rows: Record<string, string>[], file: File) => void;
}

// Generate and download the Excel template
function downloadTemplate() {
  const headers = OUR_FIELDS.map(f => f.id);
  const exampleRow = OUR_FIELDS.reduce<Record<string, string>>((acc, f) => {
    acc[f.id] = f.example;
    return acc;
  }, {});
  const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Portfolio");
  XLSX.writeFile(wb, "aeroinsights-portfolio-template.xlsx");
}

// Parse uploaded file → headers + rows
function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { raw: false });
        if (raw.length === 0) { reject(new Error("File is empty")); return; }
        const headers = Object.keys(raw[0]);
        resolve({ headers, rows: raw });
      } catch {
        reject(new Error("Could not parse file. Please use .csv, .xlsx, or .xls"));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export function DropZoneStep({ onFileParsed }: DropZoneStepProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = "." + file.name.split(".").pop()!.toLowerCase();
    if (!allowed.includes(ext)) {
      setError("Please upload a .csv, .xlsx, or .xls file.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { headers, rows } = await parseFile(file);
      onFileParsed(headers, rows, file);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Template download */}
      <div
        style={{
          background: "#F0F9FF",
          border: "1px solid #BAE6FD",
          borderRadius: "8px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <FileSpreadsheet size={20} style={{ color: "#0284C7", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A" }}>
            Use our template for the easiest upload
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
            Download, fill in your data, then upload below. Column mapping is skipped.
          </div>
        </div>
        <button
          onClick={downloadTemplate}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            background: "#0284C7",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "0.8125rem",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Download size={14} />
          Template
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? "#002147" : "#CBD5E1"}`,
          borderRadius: "8px",
          padding: "40px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: isDragging ? "rgba(0,33,71,0.03)" : "#FAFAFA",
          transition: "all 150ms",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={onInputChange}
        />
        <Upload size={32} style={{ color: "#94A3B8", marginBottom: "12px" }} />
        <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#0F172A", marginBottom: "4px" }}>
          {isLoading ? "Parsing file…" : "Drop your file here"}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "#64748B" }}>
          or click to browse — .csv, .xlsx, .xls accepted
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "6px",
            padding: "10px 14px",
            fontSize: "0.8125rem",
            color: "#B91C1C",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
