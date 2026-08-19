// src/app/components/upload/DropZoneStep.tsx
import * as React from "react";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { OUR_FIELDS, SAMPLE_ROWS } from "../../lib/columnMapper";
import ExcelJS from "exceljs";
import { loadXlsx, xlsxDownload } from "../../utils/excelHelpers";
import { parseCsv } from "../../utils/csvParser";

interface DropZoneStepProps {
  onFileParsed: (headers: string[], rows: Record<string, string>[], file: File) => void;
}

// Generate and download the Excel template (two pre-filled sample rows so
// users see the schema with concrete contrasting examples before filling in
// their own data).
async function downloadTemplate() {
  const headers = OUR_FIELDS.map((f) => f.id);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Portfolio");
  ws.addRow(headers);
  SAMPLE_ROWS.forEach((row) =>
    ws.addRow(headers.map((h) => (row as Record<string, unknown>)[h] ?? "")),
  );
  ws.columns = headers.map((h) => ({ width: Math.max(h.length + 4, 14) }));
  await xlsxDownload(wb, "aeroinsights-portfolio-template.xlsx");
}

// Parse uploaded file → headers + rows
async function parseFile(
  file: File,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const lowerName = file.name.toLowerCase();

  let allRows: string[][];
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const wb     = await loadXlsx(buffer);
    const ws     = wb.worksheets[0];
    if (!ws) throw new Error("File is empty");
    const raw: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      for (let c = 1; c <= Math.max(ws.columnCount, row.cellCount); c++) {
        vals.push(row.getCell(c).text ?? "");
      }
      raw.push(vals);
    });
    allRows = raw;
  } else {
    const text = await file.text();
    allRows = parseCsv(text);
  }

  if (allRows.length === 0) throw new Error("File is empty");
  const headers = allRows[0].map(String);
  const rows    = allRows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return obj;
  });
  if (rows.length === 0) throw new Error("File is empty");
  return { headers, rows };
}

export function DropZoneStep({ onFileParsed }: DropZoneStepProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const allowed = [".csv", ".xlsx", ".xls"];
    const dotIndex = file.name.lastIndexOf(".");
    const ext = dotIndex === -1 ? "" : file.name.slice(dotIndex).toLowerCase();
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
    if (file) void handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
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
          onClick={() => { void downloadTemplate(); }}
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
        <Upload size={32} style={{ color: "#94A3B8", display: "block", margin: "0 auto 12px" }} />
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
