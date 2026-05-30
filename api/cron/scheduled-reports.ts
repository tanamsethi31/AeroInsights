// api/cron/scheduled-reports.ts
//
// T-5.2 — Vercel cron entry. Runs hourly:
//   1. Fetch enabled report_schedules whose next_run_at <= now().
//   2. For each due row: generate the report (CSV portfolio snapshot
//      for v1 — pure-string output so the edge runtime has no Node
//      dep), upload to Supabase Storage under
//      reports/{org_id}/{portfolio_id}/{ymd}/{ts}-{filename}.csv,
//      email recipients via Resend with a 7-day signed URL, insert
//      a report_exports row + audit_log "export" event.
//   3. Advance next_run_at by `frequency`. Update last_run_at + last_status.
//
// Generation is intentionally minimal — a portfolio CSV containing
// (lease, lessee, ead, ecl_12m, ecl_lifetime, stage). Future formats
// (PDF / DOCX) will follow once a headless rendering path is set up
// for them.

// nodejs runtime because reportRenderers uses jspdf-autotable which is
// Node-only. Acceptable for a cron job that doesn't need edge latency.
export const config = { runtime: "nodejs" };

import {
  renderSnapshotCsv, renderSnapshotPdf, renderSnapshotDocx, renderSnapshotXlsx,
  type SnapshotRow, type RenderedReport,
} from "./_reportRenderers";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SRV = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const RESEND_KEY   = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM  = process.env.RESEND_FROM_EMAIL ?? "reports@aeroinsights.io";
const CRON_SECRET  = process.env.CRON_SECRET ?? "";

const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days — recipient grace

// ── Supabase REST helpers ─────────────────────────────────────────────

async function sbSelect<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      Accept:        "application/json",
    },
  });
  if (!res.ok) throw new Error(`sbSelect ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

async function sbInsert(path: string, row: Record<string, unknown>): Promise<unknown | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type":"application/json",
      Prefer:        "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`sbInsert ${path}: ${res.status} ${await res.text()}`);
  const arr = (await res.json()) as unknown[];
  return arr[0] ?? null;
}

async function sbPatch(path: string, row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type":"application/json",
      Prefer:        "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`sbPatch ${path}: ${res.status} ${await res.text()}`);
}

// ── Storage upload + signed URL ───────────────────────────────────────

async function uploadToStorage(path: string, body: Uint8Array, contentType: string): Promise<string | null> {
  const url = `${SUPABASE_URL}/storage/v1/object/reports/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type": contentType,
      "x-upsert":    "false",
    },
    body,
  });
  if (!res.ok) return null;
  return path;
}

async function signUrl(path: string): Promise<string | null> {
  const url = `${SUPABASE_URL}/storage/v1/object/sign/reports/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type":"application/json",
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL ?? data.signedUrl ?? null;
  return signed ? `${SUPABASE_URL}/storage/v1${signed}` : null;
}

// ── Resend ────────────────────────────────────────────────────────────

async function sendResendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_KEY) return { ok: false, error: "RESEND_API_KEY not set" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
    });
    if (!res.ok) return { ok: false, error: `${res.status} ${await res.text()}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ── Snapshot data fetch (shared across all formats) ───────────────────

async function fetchSnapshotRows(orgId: string, portfolioId: string | null): Promise<SnapshotRow[]> {
  const portfolioClause = portfolioId ? `&portfolio_id=eq.${portfolioId}` : "";
  const leases   = await sbSelect<{ id: string; external_id: string | null; lessee_id: string; asset_id: string; stage: number | null }>(
    `leases?org_id=eq.${orgId}${portfolioClause}&select=id,external_id,lessee_id,asset_id,stage`,
  );
  const lessees  = await sbSelect<{ id: string; name: string }>(
    `lessees?org_id=eq.${orgId}${portfolioClause}&select=id,name`,
  );
  const provs    = await sbSelect<{ asset_id: string; ead: number | null; ecl_12m: number | null; ecl_lifetime: number | null }>(
    `provisions?org_id=eq.${orgId}${portfolioClause}&select=asset_id,ead,ecl_12m,ecl_lifetime`,
  );
  const lesseeById  = new Map(lessees.map((l) => [l.id, l.name]));
  const provByAsset = new Map(provs.map((p) => [p.asset_id, p]));
  return leases.map((l) => {
    const prov = provByAsset.get(l.asset_id);
    return {
      lease_external_id: l.external_id,
      lessee_name:       lesseeById.get(l.lessee_id) ?? "—",
      ead:               prov?.ead          ?? null,
      ecl_12m:           prov?.ecl_12m      ?? null,
      ecl_lifetime:      prov?.ecl_lifetime ?? null,
      stage:             l.stage,
    };
  });
}

// ── Format dispatch ───────────────────────────────────────────────────

async function renderSnapshot(format: "csv" | "pdf" | "docx" | "xlsx", rows: SnapshotRow[], reportName: string): Promise<RenderedReport> {
  switch (format) {
    case "csv":  return renderSnapshotCsv(rows);
    case "pdf":  return renderSnapshotPdf(rows, reportName);
    case "docx": return await renderSnapshotDocx(rows, reportName);
    case "xlsx": return renderSnapshotXlsx(rows);
  }
}

// ── Frequency arithmetic ──────────────────────────────────────────────

function advanceNext(currentISO: string, frequency: "daily" | "weekly" | "monthly"): string {
  const d = new Date(currentISO);
  if (frequency === "daily")   d.setUTCDate(d.getUTCDate() + 1);
  if (frequency === "weekly")  d.setUTCDate(d.getUTCDate() + 7);
  if (frequency === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

// ── Per-schedule processing ───────────────────────────────────────────

interface ScheduleRow {
  id:           string;
  org_id:       string;
  portfolio_id: string | null;
  report_id:    string;
  name:         string;
  format:       "csv" | "pdf" | "docx" | "xlsx";
  frequency:    "daily" | "weekly" | "monthly";
  recipients:   string[];
  next_run_at:  string;
}

async function processSchedule(s: ScheduleRow): Promise<{ status: "sent" | "failed" | "skipped"; detail?: string }> {
  // 1. Fetch rows + render to the requested format.
  let rendered: RenderedReport;
  try {
    const rows = await fetchSnapshotRows(s.org_id, s.portfolio_id);
    rendered   = await renderSnapshot(s.format, rows, s.name);
  } catch (err) {
    await sbPatch(`report_schedules?id=eq.${s.id}`, {
      next_run_at: advanceNext(s.next_run_at, s.frequency),
      last_run_at: new Date().toISOString(),
      last_status: "failed",
      last_error:  `render ${s.format}: ${(err as Error).message}`,
      updated_at:  new Date().toISOString(),
    });
    return { status: "failed", detail: (err as Error).message };
  }
  const bytes = rendered.bytes;
  const date  = new Date();
  const ymd   = date.toISOString().slice(0, 10);
  const filename = `${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${ymd}.${rendered.ext}`;
  const portfolioSeg = s.portfolio_id ?? "org-wide";
  const path = `${s.org_id}/${portfolioSeg}/${ymd}/${date.getTime()}-${filename}`;

  // 2. Upload to Storage. Failed upload still records the row with no path.
  const uploadedPath = await uploadToStorage(path, bytes, rendered.contentType);

  // 3. Sign URL for the email body.
  const url = uploadedPath ? await signUrl(uploadedPath) : null;

  // 4. Send emails.
  let sentAny = false;
  let firstErr: string | undefined;
  for (const recipient of s.recipients) {
    const subject = `[Aeroinsights] ${s.name} — ${ymd}`;
    const body = url
      ? `<p>Your scheduled report <strong>${s.name}</strong> is ready.</p>
         <p><a href="${url}">Download CSV</a> (link expires in 7 days)</p>`
      : `<p>Your scheduled report <strong>${s.name}</strong> failed to upload. Contact support.</p>`;
    const send = await sendResendEmail(recipient, subject, body);
    if (send.ok) sentAny = true;
    else if (!firstErr) firstErr = send.error;
  }

  // 5. Log to report_exports for the Export History panel.
  await sbInsert("report_exports", {
    org_id:           s.org_id,
    portfolio_id:     s.portfolio_id,
    report_id:        s.report_id,
    report_name:      s.name,
    format:           rendered.ext,
    params:           { scheduled: true, schedule_id: s.id, frequency: s.frequency },
    storage_path:     uploadedPath,
    file_size_bytes:  bytes.length,
    generated_by:     `cron:scheduled-reports`,
  });

  // 6. Audit event.
  await sbInsert("audit_log", {
    org_id:       s.org_id,
    portfolio_id: s.portfolio_id,
    entity_type:  "report_export",
    entity_id:    s.id,
    action:       "export",
    after: {
      reportId:   s.report_id,
      reportName: s.name,
      format:     rendered.ext,
      filename,
      fileSize:   bytes.length,
      scheduled:  true,
    },
    actor: "cron:scheduled-reports",
  });

  // 7. Advance the schedule.
  const next = advanceNext(s.next_run_at, s.frequency);
  await sbPatch(`report_schedules?id=eq.${s.id}`, {
    next_run_at: next,
    last_run_at: new Date().toISOString(),
    last_status: sentAny ? "sent" : "failed",
    last_error:  sentAny ? null : (firstErr ?? "no recipients"),
    updated_at:  new Date().toISOString(),
  });

  return sentAny
    ? { status: "sent",   detail: `${s.recipients.length} recipient(s)` }
    : { status: "failed", detail: firstErr ?? "no recipients" };
}

// ── Handler ───────────────────────────────────────────────────────────

async function _handler(req: Request): Promise<Response> {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: "unauthorised" }), {
        status: 401, headers: { "content-type": "application/json" },
      });
    }
  }
  if (!SUPABASE_URL || !SUPABASE_SRV) {
    return new Response(JSON.stringify({ error: "supabase_not_configured" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }

  try {
    const nowIso = new Date().toISOString();
    const due = await sbSelect<ScheduleRow>(
      `report_schedules?enabled=eq.true&next_run_at=lte.${encodeURIComponent(nowIso)}` +
        `&select=id,org_id,portfolio_id,report_id,name,format,frequency,recipients,next_run_at&limit=50`,
    );
    const summary: Array<Record<string, unknown>> = [];
    for (const s of due) {
      try {
        const r = await processSchedule(s);
        summary.push({ id: s.id, name: s.name, ...r });
      } catch (err) {
        summary.push({ id: s.id, name: s.name, status: "error", detail: (err as Error).message });
      }
    }
    return new Response(JSON.stringify({ due: due.length, results: summary }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

import { withSentry as _ws_sr } from "../_lib/sentry";
export default _ws_sr(_handler, "cron:scheduled-reports");
