# Incident response runbook

## Severity ladder

| Severity | Meaning | Examples | Response SLA |
|---|---|---|---|
| **SEV-1** | Production outage. Customer data at risk OR all writes failing. | RLS bypass, audit-log corruption, cron jobs all failing, mass-delete via UI. | 15 min ack, all-hands until mitigated. |
| **SEV-2** | A major feature is broken for one or more tenants. No data risk. | Alerts cron sending duplicates, watchlist not updating, Excel add-in 5xx. | 1 hour ack, primary on-call. |
| **SEV-3** | Degraded experience. Workarounds exist. | Slow report generation, FX rates stale > 24 h, single endpoint flaky. | Next business day. |
| **SEV-4** | Cosmetic / non-blocking. | Sentry tag noise, typos, layout glitch in one panel. | Triage during sprint planning. |

## Detection sources

1. **Sentry** — DSN `SENTRY_DSN_EDGE` (server) and `VITE_SENTRY_DSN_FRONTEND`
   (browser). Issue triage: search by tag `fn` (cron name) or
   `surface=auditLog`. Frontend issues carry the React component
   stack from `Sentry.ErrorBoundary`.
2. **Vercel function logs** — every cron logs a JSON summary. Tail
   with `vercel logs --follow --filter /api/cron/`.
3. **Supabase advisors** — `mcp__plugin_supabase_supabase__get_advisors`
   surfaces RLS gaps + slow queries. Run weekly; investigate any
   new finding.
4. **User reports** — `support@aeroinsights.io`. Forwarded to Slack
   `#incidents`.

## Response flow

```
                        ┌──────────────────┐
  Alert / report ─────► │ On-call ack (15m)│
                        └────────┬─────────┘
                                 │
                                 ▼
              ┌────────────────────────────────────┐
              │  Triage: SEV-1/2/3/4 + create      │
              │  Linear ticket (label: incident)   │
              └────────┬───────────────────────────┘
                       │
       SEV-1/2 ────────┼──────── SEV-3/4
              ▼                          ▼
   Open #incident channel        Add to backlog
   Status page update            Resolve in normal flow
              │
              ▼
       Mitigate → resolve
              │
              ▼
       Postmortem within 5 business days (SEV-1)
       or as part of sprint review (SEV-2)
```

## Comms template

```
**[SEV-1] Aeroinsights — <one-line summary>**

*Started:* <UTC timestamp>
*Status:* Investigating | Identified | Monitoring | Resolved
*Impact:* <tenants / features affected>

**Timeline (UTC)**
- HH:MM Detection
- HH:MM Initial response
- HH:MM <update>

**Mitigations applied**
- ...

**Next update:** <UTC timestamp>
```

Post in `#incidents` Slack; mirror to status page for SEV-1/2.

## Triage checklist

1. **Confirm scope.** Single tenant? All tenants? One endpoint?
2. **Check Sentry.** Search by the obvious tag — `fn:cron:alerts`,
   `surface:auditLog`, etc. Note the first-seen timestamp.
3. **Check recent deploys.** `vercel ls --prod` — if the issue
   started after a deploy, roll back: `vercel rollback`.
4. **Check Supabase.** `supabase status` (or via MCP):
   - `get_advisors` for new security findings.
   - `get_logs` for the affected table.
5. **Reproduce locally** if possible. The vitest + Playwright suites
   are the fastest signal.
6. **Mitigate.** Prefer rollback > feature-flag off > hotfix.
7. **Resolve.** Update the comms thread, close the Linear ticket.

## Postmortem template

```
# Incident <YYYY-MM-DD>: <summary>

**Severity:** SEV-?
**Duration:** <start> → <resolved> (UTC, total min)
**Author:** <name>

## Summary
Two-paragraph description: what happened, who was affected, how it
was resolved.

## Timeline
- HH:MM Detection
- HH:MM Triage
- HH:MM Mitigation applied
- HH:MM Resolved

## Root cause
What broke and why.

## Impact
Tenants, requests, $ if applicable.

## What went well
- ...

## What didn't
- ...

## Action items
- [ ] <owner> — <description> — by <date>
```

Save in `docs/POSTMORTEMS/<YYYY-MM-DD>-<slug>.md`.

## Escalation contacts

| Role | Person | Channel |
|---|---|---|
| Primary on-call | Rotating weekly | Slack `@on-call` |
| Engineering lead | TBD | Slack `#eng-leads` |
| Compliance | TBD | `compliance@aeroinsights.io` |
| Supabase support | — | https://supabase.com/dashboard/support |
| Vercel support | — | https://vercel.com/help |
| Auth0 support | — | https://support.auth0.com |
