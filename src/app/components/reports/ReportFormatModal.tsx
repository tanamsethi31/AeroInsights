// src/app/components/reports/ReportFormatModal.tsx
import * as React from "react";
import { X, FileText, Table, FileType } from "lucide-react";
import { useCurrency } from "../../contexts/CurrencyContext";
import { generateReportPDF, generateReportXLSX } from "../../services/exportService";
import { generateReportDOCX } from "../../services/reportGenerators";

type Format = "pdf" | "xlsx" | "docx";

interface ReportFormatModalProps {
  reportId: string;
  reportName: string;
  onClose: () => void;
}

const FORMATS: {
  id: Format;
  label: string;
  ext: string;
  desc: string;
  Icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
}[] = [
  { id: "pdf",  label: "PDF",   ext: ".pdf",  desc: "Formatted, print-ready. Opens in any PDF viewer.", Icon: FileText },
  { id: "xlsx", label: "Excel", ext: ".xlsx", desc: "Editable spreadsheet. Opens in Excel or Google Sheets.", Icon: Table },
  { id: "docx", label: "Word",  ext: ".docx", desc: "Editable document. Opens in Word or Google Docs.", Icon: FileType },
];

export function ReportFormatModal({ reportId, reportName, onClose }: ReportFormatModalProps) {
  const { currency } = useCurrency();
  const [selected, setSelected] = React.useState<Format>("pdf");
  const [downloading, setDownloading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      if (selected === "pdf")  generateReportPDF(reportId, currency);
      if (selected === "xlsx") generateReportXLSX(reportId, currency);
      if (selected === "docx") await generateReportDOCX(reportId, currency);
      setDone(true);
      setTimeout(onClose, 1200);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#FFFFFF", borderRadius: "12px", width: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.20)", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E2E8F0", borderLeft: "3px solid #002147" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A" }}>Download Report</div>
            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>{reportName}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Currency notice */}
        <div style={{ padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#475569" }}>
          Figures will be formatted in <strong style={{ color: "#002147" }}>{currency}</strong>. Change currency via the header selector.
        </div>

        {/* Format selector */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {FORMATS.map(f => (
            <div
              key={f.id}
              onClick={() => setSelected(f.id)}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 14px",
                border: selected === f.id ? "1.5px solid #002147" : "1px solid #E2E8F0",
                borderRadius: "8px",
                cursor: "pointer",
                background: selected === f.id ? "rgba(0,33,71,0.04)" : "#FFFFFF",
                transition: "all 150ms",
              }}
            >
              <f.Icon size={20} style={{ color: selected === f.id ? "#002147" : "#64748B", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>
                  {f.label} <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "#94A3B8" }}>{f.ext}</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "1px" }}>{f.desc}</div>
              </div>
              <div style={{
                width: "16px", height: "16px", borderRadius: "50%",
                border: `2px solid ${selected === f.id ? "#002147" : "#CBD5E1"}`,
                background: selected === f.id ? "#002147" : "transparent",
                flexShrink: 0,
              }} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", background: "transparent", color: "#475569", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "0.875rem", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || done}
            style={{
              padding: "8px 20px",
              background: done ? "#15803D" : downloading ? "#94A3B8" : "#002147",
              color: "#FFFFFF", border: "none", borderRadius: "8px",
              fontWeight: 600, fontSize: "0.875rem",
              cursor: downloading || done ? "not-allowed" : "pointer",
              minWidth: "110px",
            }}
          >
            {done ? "Downloaded!" : downloading ? "Building…" : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
