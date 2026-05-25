// src/app/components/reports/ExportHistoryPanel.tsx
//
// T-3.3 — Export History panel.
//
// Lists every report exported by this org/portfolio. Click "Download" to
// mint a signed URL and re-download the persisted file from Supabase
// Storage (no need to regenerate). Failed uploads are labelled "Local-only"
// since the row exists but no file lives in Storage.

import { useState } from "react";
import { Download, FileText, Table, FileType, AlertTriangle } from "lucide-react";
import { useReportExports, type ReportFormat } from "../../hooks/useReportExports";

const FORMAT_ICON: Record<ReportFormat, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  pdf:  FileText,
  xlsx: Table,
  docx: FileType,
};

const FORMAT_COLOR: Record<ReportFormat, string> = {
  pdf:  "#B91C1C",
  xlsx: "#15803D",
  docx: "#1D4ED8",
};

function fmtBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function ExportHistoryPanel() {
  const { exports, loading, error, getDownloadUrl } = useReportExports();
  const [pending, setPending] = useState<string | null>(null);

  async function handleDownload(id: string, storagePath: string | null) {
    if (!storagePath) return;
    setPending(id);
    try {
      const url = await getDownloadUrl(storagePath);
      if (url) {
        const a = Object.assign(document.createElement("a"), { href: url, target: "_blank", rel: "noopener" });
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } finally {
      setPending(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
        Loading export history…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "1rem", background: "#FEE2E2", color: "#B91C1C", borderRadius: "0.5rem", fontSize: "0.8125rem" }}>
        Failed to load: {error}
      </div>
    );
  }

  if (exports.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
        No reports exported yet. Use any Download Report action to populate this list.
      </div>
    );
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
      <thead>
        <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
          {["Report", "Format", "Size", "Generated", "By", ""].map(h => (
            <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {exports.map((e, i) => {
          const Icon = FORMAT_ICON[e.format];
          const isPending = pending === e.id;
          const canDownload = e.storagePath !== null;
          return (
            <tr key={e.id} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
              <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>
                <div style={{ fontWeight: 600 }}>{e.reportName}</div>
                <div style={{ fontSize: "0.7rem", color: "#94A3B8" }}>{e.reportId}</div>
              </td>
              <td style={{ padding: "0.75rem 1rem" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: FORMAT_COLOR[e.format], fontWeight: 600, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                  <Icon size={12} />
                  {e.format}
                </div>
              </td>
              <td style={{ padding: "0.75rem 1rem", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                {fmtBytes(e.fileSizeBytes)}
              </td>
              <td style={{ padding: "0.75rem 1rem", color: "#475569", whiteSpace: "nowrap" }}>
                {fmtDate(e.generatedAt)}
              </td>
              <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>{e.generatedBy}</td>
              <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                {canDownload ? (
                  <button
                    onClick={() => handleDownload(e.id, e.storagePath)}
                    disabled={isPending}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "0.35rem",
                      padding: "0.4rem 0.85rem",
                      background: "#002147", color: "#FFFFFF",
                      border: "none", borderRadius: "9999px",
                      fontSize: "0.75rem", fontWeight: 600,
                      cursor: isPending ? "wait" : "pointer",
                      opacity: isPending ? 0.7 : 1,
                    }}
                  >
                    <Download size={11} />
                    {isPending ? "…" : "Download"}
                  </button>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: "#B45309", fontSize: "0.7rem", fontWeight: 600 }}>
                    <AlertTriangle size={11} />
                    Local-only
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
