// api/cron/alerts.ts
//
// T-5.1 — Vercel cron entry. Runs every 30 min (see vercel.json):
//   1. CRON_SECRET gates the endpoint so external callers can't trigger
//      a flood of sends.
//   2. For every org with at least one enabled alert_rule:
//        a. Snapshot lessees + recent stage_migrations + sanctions map.
//        b. evaluateRules() returns one AlertFire per breach.
//        c. For each fire + each recipient, check alert_sends within
//           cooldown_minutes — skip when already sent recently.
//        d. Send via Resend, write alert_sends row.
//   3. Returns a JSON summary for observability via the Vercel logs.
//
// Storage / Supabase calls use the service-role key + REST endpoint
// directly so the edge runtime doesn't need @supabase/supabase-js. All
// row-level filtering happens via explicit org_id parameters because we
// bypass RLS with the service-role token.

export const config = { runtime: "edge" };

import { evaluateRules,
         type AlertRuleInput,
         type LesseeSnapshot,
         type StageMigrationSnapshot,
         type LesseeAggregateSnapshot,
         type AlertFire } from "../_lib/alertEvaluator";
import { withSentry } from "../_lib/sentry";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SRV = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const RESEND_KEY   = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM  = process.env.RESEND_FROM_EMAIL ?? "alerts@aeroinsights.io";
const CRON_SECRET  = process.env.CRON_SECRET ?? "";

// ── Tiny Supabase REST wrapper ─────────────────────────────────────────

async function sbSelect<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:        SUPABASE_SRV,
      Authorization: `Bearer ${SUPABASE_SRV}`,
      Accept:        "application/json",
    },
  });
  if (!res.ok) throw new Error(`sbSelect ${path}: ${res.status}`);
  return (await res.json()) as T[];
}

async function sbInsert(path: string, row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
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

// ── Resend send ────────────────────────────────────────────────────────

async function sendResendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_KEY) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    RESEND_FROM,
        to:      [to],
        subject,
        text:    body,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `${res.status} ${await res.text()}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ── Per-org processing ────────────────────────────────────────────────

async function processOrg(orgId: string): Promise<{ fired: number; sent: number; skipped: number; failed: number }> {
  const rules = await sbSelect<AlertRuleInput>(
    `alert_rules?org_id=eq.${orgId}&enabled=eq.true&select=*`,
  );
  if (rules.length === 0) return { fired: 0, sent: 0, skipped: 0, failed: 0 };

  // ── Snapshot the signal tables for THIS org ────────────────────────
  const lessees = await sbSelect<LesseeSnapshot>(
    `lessees?org_id=eq.${orgId}&select=id,name,country,watchlist_status,dpd_days,insolvency_filed`,
  );

  // Stage migrations in the last 24 h, capped to 200.
  const sinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const migrations = await sbSelect<StageMigrationSnapshot>(
    `stage_migrations?org_id=eq.${orgId}&occurred_at=gte.${encodeURIComponent(sinceISO)}` +
      `&select=id,lease_external_id,from_stage,to_stage,direction,reason,occurred_at&order=occurred_at.desc&limit=200`,
  );

  // lease external_id → lessee name lookup, used by stage_downgrade body.
  const leaseRows = await sbSelect<{ external_id: string | null; lessee_id: string }>(
    `leases?org_id=eq.${orgId}&select=external_id,lessee_id`,
  );
  const lesseeById = new Map(lessees.map((l) => [l.id, l.name]));
  const leaseToLessee = new Map<string, { id: string; name: string }>();
  for (const lr of leaseRows) {
    if (lr.external_id && lesseeById.has(lr.lessee_id)) {
      leaseToLessee.set(lr.external_id, { id: lr.lessee_id, name: lesseeById.get(lr.lessee_id)! });
    }
  }

  // Sanctions map — derived from jurisdiction_lgd_overlays would be nicer
  // but that table doesn't track sanctions yet. For now we read from the
  // hardcoded list used elsewhere by importing it inline.
  const sanctionedCountries = ["Russia", "Iran", "North Korea", "Syria"];
  const sanctions = new Map<string, "active" | "watch" | "none">(
    sanctionedCountries.map((c) => [c, "active" as const]),
  );

  // Aggregates per lessee for mr_shortfall + concentration kinds. Only
  // fetched once per org so cron stays cheap; empty for orgs with no
  // matching rule type but no harm.
  const leaseRowsAll = await sbSelect<{ id: string; lessee_id: string; asset_id: string }>(
    `leases?org_id=eq.${orgId}&select=id,lessee_id,asset_id`,
  );
  const provisionRows = await sbSelect<{ asset_id: string; ead: number | null }>(
    `provisions?org_id=eq.${orgId}&select=asset_id,ead`,
  );
  const mrRows = await sbSelect<{ lease_id: string; balance_usd: number | null }>(
    `maintenance_reserves?org_id=eq.${orgId}&select=lease_id,balance_usd`,
  );
  const eadByAsset = new Map<string, number>();
  for (const p of provisionRows) eadByAsset.set(p.asset_id, Number(p.ead ?? 0));
  const aggByLessee = new Map<string, { ead_usd: number; mr_balance_usd: number }>();
  for (const l of leaseRowsAll) {
    const cur = aggByLessee.get(l.lessee_id) ?? { ead_usd: 0, mr_balance_usd: 0 };
    cur.ead_usd += eadByAsset.get(l.asset_id) ?? 0;
    aggByLessee.set(l.lessee_id, cur);
  }
  const mrByLease = new Map<string, number>();
  for (const m of mrRows) {
    mrByLease.set(m.lease_id, (mrByLease.get(m.lease_id) ?? 0) + Number(m.balance_usd ?? 0));
  }
  for (const l of leaseRowsAll) {
    const cur = aggByLessee.get(l.lessee_id);
    if (!cur) continue;
    cur.mr_balance_usd += mrByLease.get(l.id) ?? 0;
  }
  const aggregates: LesseeAggregateSnapshot[] = lessees.map((l) => ({
    lessee_id:     l.id,
    lessee_name:   l.name,
    ead_usd:       aggByLessee.get(l.id)?.ead_usd ?? 0,
    mr_balance_usd:aggByLessee.get(l.id)?.mr_balance_usd ?? 0,
  }));

  const fires = evaluateRules({ rules, lessees, migrations, leaseToLessee, sanctions, aggregates });

  let sent = 0, skipped = 0, failed = 0;
  for (const fire of fires) {
    const rule = rules.find((r) => r.id === fire.ruleId)!;
    for (const recipient of fire.recipients) {
      // Cooldown check: most-recent successful send for (rule, entity, recipient).
      const cutoff = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000).toISOString();
      const recent = await sbSelect<{ id: string }>(
        `alert_sends?org_id=eq.${orgId}&rule_id=eq.${rule.id}` +
          `&entity_id=eq.${encodeURIComponent(fire.entityId)}` +
          `&recipient=eq.${encodeURIComponent(recipient)}` +
          `&status=eq.sent&sent_at=gte.${encodeURIComponent(cutoff)}&select=id&limit=1`,
      );
      if (recent.length > 0) {
        await sbInsert("alert_sends", {
          org_id:        orgId,
          rule_id:       rule.id,
          entity_id:     fire.entityId,
          entity_label:  fire.entityLabel,
          recipient,
          status:        "skipped_cooldown",
          payload:       fire.payload,
        });
        skipped++;
        continue;
      }
      const send = await sendResendEmail(recipient, fire.subject, fire.body);
      await sbInsert("alert_sends", {
        org_id:        orgId,
        rule_id:       rule.id,
        entity_id:     fire.entityId,
        entity_label:  fire.entityLabel,
        recipient,
        status:        send.ok ? "sent" : "failed",
        payload:       fire.payload,
        error_detail:  send.error ?? null,
      });
      if (send.ok) sent++; else failed++;
    }
  }
  return { fired: fires.length, sent, skipped, failed };
}

// ── Handler ────────────────────────────────────────────────────────────

async function alertsHandler(req: Request): Promise<Response> {
  // Vercel cron requests are POST. Allow GET for manual smoke testing too.
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  // CRON_SECRET gates the endpoint. Vercel injects the secret as a Bearer
  // header on every cron invocation.
  if (!CRON_SECRET) {
    return new Response(JSON.stringify({ error: "cron_secret_not_configured" }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
  {
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
    // Distinct list of orgs with at least one enabled rule. Fetch via REST.
    const ruleOrgs = await sbSelect<{ org_id: string }>(
      `alert_rules?enabled=eq.true&select=org_id`,
    );
    const orgIds = Array.from(new Set(ruleOrgs.map((r) => r.org_id)));
    const summary: Record<string, unknown> = { orgs: orgIds.length, results: [] as unknown[] };

    for (const orgId of orgIds) {
      try {
        const result = await processOrg(orgId);
        (summary.results as unknown[]).push({ orgId, ...result });
      } catch (err) {
        (summary.results as unknown[]).push({ orgId, error: (err as Error).message });
      }
    }
    return new Response(JSON.stringify(summary), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

export default withSentry(alertsHandler, "cron:alerts");
