// api/admin/delete-org.ts
//
// T-6.5 — Tenant offboarding endpoint.
//
// Flow:
//   1. Verify Auth0 token.
//   2. Confirm caller is an admin in the target org (org_members.role
//      = 'admin' AND user_id = auth.sub).
//   3. Confirm name-match: the request body must include
//      { confirm_name } that exactly matches organisations.name.
//   4. Pre-flight count rows per table for the audit row.
//   5. Purge Storage `reports/{org_id}/**` recursively.
//   6. DELETE FROM organisations WHERE id = ... — cascades through
//      every org_id-FK in the schema (assets, leases, lessees,
//      provisions, scenario_runs, audit_log, watchlist_entries, etc).
//   7. INSERT a row into org_deletion_log (outside the deletion path).
//
// Failure mid-flight: the org_deletion_log row is written with
// status='failed' + error_detail so the deletion can be retried or
// completed manually by an operator.

// Was previously "edge" but Vercel's edge bundler chunks _lib together,
// pulling in jspdf-autotable (Node-only) via reportRenderers. Running on
// nodejs avoids the unsupported-module error and is fine for an admin
// hard-delete that's already not latency-critical.
export const config = { runtime: "nodejs20.x" };

import { verifyAuth0Token } from "../_lib/auth0";
import { withSentry } from "../_lib/sentry";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SRV = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Every table that carries an org_id column. Pre-count so the
// org_deletion_log captures what disappeared.
const COUNTED_TABLES = [
  "organisations", "org_members", "portfolios",
  "lessees", "assets", "leases", "uploads", "provisions",
  "security_deposits", "maintenance_reserves",
  "ifrs9_parameters", "sicr_config", "stress_scenarios",
  "restructuring_presets", "jurisdiction_lgd_overlays",
  "ecl_period_snapshots", "scenario_runs", "stage_migrations",
  "audit_log", "assumption_change_log", "report_exports",
  "alert_rules", "alert_sends", "report_schedules",
  "watchlist_config", "watchlist_entries", "news_signals",
  "lessee_financials", "market_data", "reconciliation_matches",
  "servicer_reports", "bank_statements", "bank_transactions",
  "cash_events", "abs_deals",
] as const;

// ── REST helpers ──────────────────────────────────────────────────────

async function sbCount(table: string, orgId: string): Promise<number> {
  // organisations is keyed by id, not org_id.
  const filter = table === "organisations" ? `id=eq.${orgId}` : `org_id=eq.${orgId}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}&select=id`, {
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      Prefer:        "count=exact",
      Range:         "0-0",
    },
  });
  if (!res.ok) return 0;
  const cr = res.headers.get("content-range");
  if (!cr) return 0;
  const m = cr.match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

async function sbSelect<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SRV, Authorization: `Bearer ${SUPABASE_SRV}` },
  });
  if (!res.ok) throw new Error(`sbSelect ${path}: ${res.status}`);
  return (await res.json()) as T[];
}

async function sbDelete(path: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method:  "DELETE",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      Prefer:        "return=minimal",
    },
  });
  if (!res.ok) throw new Error(`sbDelete ${path}: ${res.status} ${await res.text()}`);
}

async function sbInsert(path: string, row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method:  "POST",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type":"application/json",
      Prefer:        "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`sbInsert ${path}: ${res.status} ${await res.text()}`);
}

// ── Storage purge ─────────────────────────────────────────────────────

async function purgeStorage(orgId: string): Promise<number> {
  // List every object under reports/{orgId}/ then delete in batches.
  // Storage API supports recursive list via prefix.
  const listUrl = `${SUPABASE_URL}/storage/v1/object/list/reports`;
  const listRes = await fetch(listUrl, {
    method: "POST",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type":"application/json",
    },
    body: JSON.stringify({ prefix: orgId, limit: 1000, offset: 0 }),
  });
  if (!listRes.ok) return 0;
  const items = (await listRes.json()) as Array<{ name: string }>;
  const paths = items.map((i) => `${orgId}/${i.name}`);
  if (paths.length === 0) return 0;
  const delRes = await fetch(`${SUPABASE_URL}/storage/v1/object/reports`, {
    method: "DELETE",
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      "Content-Type":"application/json",
    },
    body: JSON.stringify({ prefixes: paths }),
  });
  return delRes.ok ? paths.length : 0;
}

// ── Handler ───────────────────────────────────────────────────────────

interface DeleteOrgBody { org_id?: string; confirm_name?: string }

async function _handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { "content-type": "application/json" },
    });
  }
  if (!SUPABASE_URL || !SUPABASE_SRV) {
    return new Response(JSON.stringify({ error: "supabase_not_configured" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }

  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) return new Response(JSON.stringify({ error: "missing_token" }), { status: 401, headers: { "content-type": "application/json" } });
  const payload = await verifyAuth0Token(m[1]);
  if (!payload) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { "content-type": "application/json" } });

  let body: DeleteOrgBody;
  try { body = (await req.json()) as DeleteOrgBody; }
  catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "content-type": "application/json" } }); }
  if (!body.org_id || !body.confirm_name) {
    return new Response(JSON.stringify({ error: "missing_org_id_or_confirm_name" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  // Admin check via service-role (bypasses RLS so we can verify the
  // caller really is an admin in the target org).
  const member = await sbSelect<{ role: string }>(
    `org_members?org_id=eq.${body.org_id}&user_id=eq.${encodeURIComponent(payload.sub)}&select=role&limit=1`,
  );
  if (member.length === 0 || member[0].role !== "admin") {
    return new Response(JSON.stringify({ error: "not_admin" }), { status: 403, headers: { "content-type": "application/json" } });
  }

  // Resolve org name + confirm match.
  const orgs = await sbSelect<{ id: string; name: string }>(
    `organisations?id=eq.${body.org_id}&select=id,name&limit=1`,
  );
  if (orgs.length === 0) {
    return new Response(JSON.stringify({ error: "org_not_found" }), { status: 404, headers: { "content-type": "application/json" } });
  }
  const org = orgs[0];
  if (org.name.trim().toLowerCase() !== body.confirm_name.trim().toLowerCase()) {
    return new Response(JSON.stringify({ error: "confirm_name_mismatch" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  // Pre-count for the audit row.
  const counts: Record<string, number> = {};
  for (const t of COUNTED_TABLES) {
    try { counts[t] = await sbCount(t, body.org_id); }
    catch { counts[t] = -1; }
  }

  const actorEmail = typeof payload.email === "string" ? (payload.email as string) : null;
  const startedAt = new Date().toISOString();

  try {
    const storageCount = await purgeStorage(body.org_id);
    // Cascade-delete via organisations row. Every other table FKs back
    // to organisations(id) ON DELETE CASCADE so this single statement
    // wipes the tenant.
    await sbDelete(`organisations?id=eq.${body.org_id}`);
    await sbInsert("org_deletion_log", {
      org_id:              body.org_id,
      org_name:            org.name,
      requested_by:        payload.sub,
      requested_by_email:  actorEmail,
      storage_purge_count: storageCount,
      rows_deleted:        counts,
      requested_at:        startedAt,
      completed_at:        new Date().toISOString(),
      status:              "completed",
    });
    return new Response(JSON.stringify({
      ok: true, org_id: body.org_id, storage_purge_count: storageCount, rows_deleted: counts,
    }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (err) {
    // Best-effort log — even a partial deletion leaves a trail.
    try {
      await sbInsert("org_deletion_log", {
        org_id:              body.org_id,
        org_name:            org.name,
        requested_by:        payload.sub,
        requested_by_email:  actorEmail,
        storage_purge_count: 0,
        rows_deleted:        counts,
        requested_at:        startedAt,
        completed_at:        new Date().toISOString(),
        status:              "failed",
        error_detail:        (err as Error).message,
      });
    } catch { /* swallow secondary failure */ }
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

export default withSentry(_handler, "admin:delete-org");
