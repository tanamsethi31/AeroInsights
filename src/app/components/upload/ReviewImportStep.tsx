// src/app/components/upload/ReviewImportStep.tsx
import * as React from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface ReviewImportStepProps {
  orgId: string;
  /** ADR-002: if absent, the importer creates a new portfolio named after the file. */
  portfolioId?: string;
  filename: string;
  mapping: Record<string, string | null>;
  rows: Record<string, string>[];
  columnMap: Record<string, string | null>;
  onComplete: (uploadId: string, importedCount: number, portfolioId: string) => void;
  onError: (message: string) => void;
}

interface ParsedRow {
  registration: string;
  msn: string;
  aircraft_type: string;
  lessee_name: string;
  start_date: string;
  end_date: string;
  manufacturer: string | null;
  vintage: number | null;
  current_operator: string | null;
  iata_code: string | null;
  country: string | null;
  credit_rating: string | null;
  pd_estimate: number | null;
  watchlist_status: string | null;
  monthly_rental: number | null;
  currency: string;
  stage: number | null;
  ecl_amount: number | null;
  pd: number | null;
  lgd: number | null;
  ead: number | null;
  _rowIndex: number;
  _errors: string[];
}

function extractValue(row: Record<string, string>, mapping: Record<string, string | null>, fieldId: string): string | null {
  const header = mapping[fieldId];
  if (!header) return null;
  return row[header]?.trim() ?? null;
}

function parseRows(rows: Record<string, string>[], mapping: Record<string, string | null>): ParsedRow[] {
  return rows.map((row, i) => {
    const errors: string[] = [];
    const get = (id: string) => extractValue(row, mapping, id);

    const registration = get("registration") ?? "";
    const msn = get("msn") ?? "";
    const aircraft_type = get("aircraft_type") ?? "";
    const lessee_name = get("lessee_name") ?? "";
    const start_date = get("start_date") ?? "";
    const end_date = get("end_date") ?? "";

    if (!registration) errors.push("Missing Registration");
    if (!msn) errors.push("Missing MSN");
    if (!aircraft_type) errors.push("Missing Aircraft Type");
    if (!lessee_name) errors.push("Missing Lessee Name");
    if (!start_date) errors.push("Missing Lease Start");
    if (!end_date) errors.push("Missing Lease End");

    const vintageStr = get("vintage");
    const vintage = vintageStr ? parseInt(vintageStr, 10) : null;
    if (vintage !== null && isNaN(vintage)) errors.push("Invalid Vintage (must be a year)");

    const rentalStr = get("monthly_rental");
    const monthly_rental = rentalStr ? parseFloat(rentalStr.replace(/,/g, "")) : null;
    const pdEstStr = get("pd_estimate");
    const pd_estimate = pdEstStr ? parseFloat(pdEstStr) : null;
    const stageStr = get("stage");
    const stage = stageStr ? parseInt(stageStr, 10) : null;
    if (stage !== null && ![1, 2, 3].includes(stage)) errors.push("Stage must be 1, 2, or 3");
    const eclStr = get("ecl_amount");
    const ecl_amount = eclStr ? parseFloat(eclStr.replace(/,/g, "")) : null;
    const pdStr = get("pd");
    const pd_val = pdStr ? parseFloat(pdStr) : null;
    const lgdStr = get("lgd");
    const lgd = lgdStr ? parseFloat(lgdStr) : null;
    const eadStr = get("ead");
    const ead = eadStr ? parseFloat(eadStr.replace(/,/g, "")) : null;

    return {
      registration, msn, aircraft_type, lessee_name, start_date, end_date,
      manufacturer: get("manufacturer"),
      vintage: vintage !== null && !isNaN(vintage) ? vintage : null,
      current_operator: get("current_operator"),
      iata_code: get("iata_code"),
      country: get("country"),
      credit_rating: get("credit_rating"),
      pd_estimate: pd_estimate !== null && !isNaN(pd_estimate) ? pd_estimate : null,
      watchlist_status: get("watchlist_status"),
      monthly_rental: monthly_rental !== null && !isNaN(monthly_rental) ? monthly_rental : null,
      currency: get("currency") ?? "EUR",
      stage: stage !== null && !isNaN(stage) && [1, 2, 3].includes(stage) ? stage : null,
      ecl_amount: ecl_amount !== null && !isNaN(ecl_amount) ? ecl_amount : null,
      pd: pd_val !== null && !isNaN(pd_val) ? pd_val : null,
      lgd: lgd !== null && !isNaN(lgd) ? lgd : null,
      ead: ead !== null && !isNaN(ead) ? ead : null,
      _rowIndex: i + 2, // +2 for 1-based + header row
      _errors: errors,
    };
  });
}

export function ReviewImportStep({
  orgId,
  portfolioId,
  filename,
  mapping,
  rows,
  columnMap,
  onComplete,
  onError,
}: ReviewImportStepProps) {
  const parsed = React.useMemo(() => parseRows(rows, mapping), [rows, mapping]);
  const valid = parsed.filter(r => r._errors.length === 0);
  const invalid = parsed.filter(r => r._errors.length > 0);
  const [isImporting, setIsImporting] = React.useState(false);

  const previewRows = valid.slice(0, 5);

  async function handleImport() {
    if (valid.length === 0) return;
    setIsImporting(true);

    try {
      // 0. Resolve portfolio (ADR-002). If the caller didn't pass one, create a
      // new portfolio named after the file. Slug is the timestamp so collisions
      // are impossible within an org. Caller (PortfolioHub) will set this as
      // the active portfolio after onComplete fires.
      let effectivePortfolioId: string;
      if (portfolioId) {
        effectivePortfolioId = portfolioId;
      } else {
        const baseName = filename.replace(/\.[^.]+$/, "").trim() || "Imported portfolio";
        const slug = `import-${Date.now().toString(36)}`;
        const { data: newPortfolio, error: portfolioError } = await supabase
          .from("portfolios")
          .insert({ org_id: orgId, name: baseName, kind: "live", slug })
          .select("id")
          .single();
        if (portfolioError || !newPortfolio) {
          throw new Error(portfolioError?.message ?? "Failed to create portfolio");
        }
        effectivePortfolioId = newPortfolio.id;
      }

      // 1. Create upload record (now portfolio-scoped)
      const { data: upload, error: uploadError } = await supabase
        .from("uploads")
        .insert({
          org_id: orgId,
          portfolio_id: effectivePortfolioId,
          filename,
          status: "processing",
          column_map: columnMap,
          row_count: valid.length,
        })
        .select("id")
        .single();

      if (uploadError || !upload) throw new Error(uploadError?.message ?? "Failed to create upload record");

      const uploadId = upload.id;

      // 2. Insert lessees (deduplicate by name within org)
      const uniqueLessees = [...new Map(valid.map(r => [r.lessee_name, r])).values()];
      const { data: lesseeRows, error: lesseeError } = await supabase
        .from("lessees")
        .insert(
          uniqueLessees.map(r => ({
            org_id: orgId,
            name: r.lessee_name,
            iata_code: r.iata_code,
            country: r.country,
            credit_rating: r.credit_rating,
            pd_estimate: r.pd_estimate,
            watchlist_status: r.watchlist_status,
          }))
        )
        .select("id, name");

      if (lesseeError) throw new Error("Failed to insert lessees: " + lesseeError.message);
      const lesseeMap = new Map<string, string>((lesseeRows ?? []).map(l => [l.name, l.id]));

      // 3. Insert assets
      const { data: assetRows, error: assetError } = await supabase
        .from("assets")
        .insert(
          valid.map(r => ({
            org_id: orgId,
            upload_id: uploadId,
            registration: r.registration,
            msn: r.msn,
            aircraft_type: r.aircraft_type,
            manufacturer: r.manufacturer,
            vintage: r.vintage,
            current_operator: r.current_operator,
          }))
        )
        .select("id, msn");

      if (assetError) throw new Error("Failed to insert assets: " + assetError.message);
      const assetMap = new Map<string, string>((assetRows ?? []).map(a => [a.msn, a.id]));

      // 4. Insert leases
      const leaseInserts = valid.map(r => ({
        org_id: orgId,
        asset_id: assetMap.get(r.msn)!,
        lessee_id: lesseeMap.get(r.lessee_name)!,
        start_date: r.start_date,
        end_date: r.end_date,
        monthly_rental: r.monthly_rental,
        currency: r.currency,
        stage: r.stage,
      })).filter(l => l.asset_id && l.lessee_id);

      const { error: leaseError } = await supabase.from("leases").insert(leaseInserts);
      if (leaseError) throw new Error("Failed to insert leases: " + leaseError.message);

      // 5. Insert provisions (only rows with ECL data)
      const provisionInserts = valid
        .filter(r => r.ecl_amount !== null || r.pd !== null)
        .map(r => ({
          org_id: orgId,
          asset_id: assetMap.get(r.msn)!,
          stage: r.stage,
          ecl_amount: r.ecl_amount,
          pd: r.pd,
          lgd: r.lgd,
          ead: r.ead,
        }))
        .filter(p => p.asset_id);

      if (provisionInserts.length > 0) {
        const { error: provError } = await supabase.from("provisions").insert(provisionInserts);
        if (provError) throw new Error("Failed to insert provisions: " + provError.message);
      }

      // 6. Mark upload complete
      await supabase.from("uploads").update({ status: "complete" }).eq("id", uploadId);

      onComplete(uploadId, valid.length, effectivePortfolioId);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Summary */}
      <div style={{ display: "flex", gap: "12px" }}>
        <div
          style={{
            flex: 1, padding: "12px 16px", background: "#F0FDF4",
            border: "1px solid #BBF7D0", borderRadius: "8px", textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#15803D" }}>{valid.length}</div>
          <div style={{ fontSize: "0.75rem", color: "#15803D", fontWeight: 500 }}>Rows ready to import</div>
        </div>
        {invalid.length > 0 && (
          <div
            style={{
              flex: 1, padding: "12px 16px", background: "#FEF2F2",
              border: "1px solid #FECACA", borderRadius: "8px", textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#B91C1C" }}>{invalid.length}</div>
            <div style={{ fontSize: "0.75rem", color: "#B91C1C", fontWeight: 500 }}>Rows with errors (will be skipped)</div>
          </div>
        )}
      </div>

      {/* Preview table */}
      {previewRows.length > 0 && (
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Preview (first {previewRows.length} rows)
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Registration", "MSN", "Aircraft Type", "Lessee", "Start", "End"].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "6px 10px", color: "#0F172A" }}>{r.registration}</td>
                    <td style={{ padding: "6px 10px", color: "#0F172A" }}>{r.msn}</td>
                    <td style={{ padding: "6px 10px", color: "#0F172A" }}>{r.aircraft_type}</td>
                    <td style={{ padding: "6px 10px", color: "#0F172A" }}>{r.lessee_name}</td>
                    <td style={{ padding: "6px 10px", color: "#64748B" }}>{r.start_date}</td>
                    <td style={{ padding: "6px 10px", color: "#64748B" }}>{r.end_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error rows */}
      {invalid.length > 0 && (
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#B91C1C", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Skipped rows
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "120px", overflowY: "auto" }}>
            {invalid.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "0.75rem", color: "#B91C1C" }}>
                <AlertCircle size={12} style={{ flexShrink: 0, marginTop: "1px" }} />
                <span>Row {r._rowIndex}: {r._errors.join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={valid.length === 0 || isImporting}
        style={{
          padding: "10px 24px",
          background: valid.length === 0 ? "#CBD5E1" : "#002147",
          color: "#FFFFFF",
          border: "none",
          borderRadius: "8px",
          fontWeight: 700,
          fontSize: "0.9375rem",
          cursor: valid.length === 0 ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          alignSelf: "flex-end",
        }}
      >
        {isImporting ? (
          <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Importing…</>
        ) : (
          <><CheckCircle2 size={16} /> Import {valid.length} row{valid.length !== 1 ? "s" : ""}</>
        )}
      </button>
    </div>
  );
}
