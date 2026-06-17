# AeroInsights: Platform Portfolio

*A purpose-built decision-intelligence platform for aviation finance.*

**Author:** Tanam Sethi
**Status:** Public-facing portfolio document
**Web:** [aeroinsights.vercel.app](https://aeroinsights.vercel.app)
**Contact:** sethit@tcd.ie · [LinkedIn](https://www.linkedin.com/in/tanamsethi/) · [Book a 30-min call](https://cal.com/tanam-sethi/30min)

---

## Foreword

This document exists for one reason: when somebody who actually works in lessor risk asks "what is this, what's behind the screen, and where does it sit next to what already exists?", I want to be able to send them something that respects their time.

A few things up front:

- **AeroInsights is not built to displace any incumbent on day one.** Aerlytix has a decade of distribution and around 50 people; I'm one recent quantitative-finance graduate with a code editor and a deeply uncomfortable amount of conviction. Telling a lessor with $5B in assets that they should rip out an audited system is not a credible pitch.
- **What this document is** is a detailed walkthrough of the methodology, architecture and product surface I have built and continue to refine, module by module, sub-tab by sub-tab, so that an aviation finance practitioner can quickly map what's here against what they use today, and form a real view on whether the angle is interesting.
- **Where it sits.** AeroInsights is built around four convictions: methodology has to be transparent (no black boxes), configurability matters more than feature count, AI belongs in the signal layer not the chat box, and Excel is part of the workflow whether vendors like it or not. Each of these is treated as a first-class architectural commitment, not a slide.

I'd rather show you the engine than the brochure. The rest of this document is the engine.

---

## Table of Contents

### Part I: Positioning
1. The state of the lessor decisioning stack today
2. Where the existing stack falls short
3. The thesis behind AeroInsights

### Part II: Architecture
4. Platform architecture (frontend, backend, database, AI)
5. The data model: what the platform actually understands
6. Audit trail and immutability

### Part III: Module walkthrough (tab by tab, sub-tab by sub-tab)
7. Portfolios (org and onboarding)
8. Portfolio (the asset book)
9. Scenarios
10. Risk & ECL
11. Deals
12. Maintenance
13. Cash Flow & Reconciliation
14. Intelligence (the AI signal layer)
15. Reports
16. Settings
17. Excel Add-In

### Part IV: Integration
18. How every module connects to every other
19. The audit and assumption pipeline

### Part V: Differentiation
20. The honest comparison vs. Aerlytix
21. The honest comparison vs. in-house Excel stacks
22. The honest comparison vs. point tools

### Part VI: Roadmap
23. Where this goes next

### Part VII: About the builder

### Appendix: Methodology notes

---

# Part I: Positioning

## 1. The state of the lessor decisioning stack today

Across roughly 50 active aircraft lessors managing around $450B in leased aircraft assets, the way risk gets quantified, reported and acted on today is a patchwork of four distinct layers:

| Layer | What it does | What's used today |
|---|---|---|
| **Portfolio book of record** | Lease register, rent ledger, lessee/aircraft master data | Excel + back-office accounting system (mostly bespoke), plus a CRM-style overlay |
| **IFRS 9 ECL engine** | PD/LGD/EAD calculation, staging, waterfall, disclosures | Aerlytix LIQ (the only platform with real market traction), in-house Excel/Python at top-5 lessors, sometimes outsourced to a Big-4 advisory |
| **Asset and market data** | Aircraft values, market lease rates, transaction comparables | Cirium / IBA / Ascend, Avitas, AeroAnalysis (paid data, not platforms) |
| **Counterparty and jurisdiction signals** | News, sovereign risk, sanctions, operational signals | Manual reading, Bloomberg/Reuters, occasional ad-hoc OFAC checks |

The honest picture: **the only piece that has a real software platform behind it is IFRS 9 ECL**, and even there the platform leader has been at it for years with a substantial team and is still iterating. Everything else is either Excel, paid data feeds, or human attention.

This is not a market with no software in it. It's a market where every category except ECL is still under-built, and ECL itself is treated as a settled problem when, in practice, lessors I have demoed to consistently describe it as the single most painful workflow they touch.

## 2. Where the existing stack falls short

The pattern I have observed across all nine review sessions I have run with leadership at Aerfin, Grant Thornton, ELFC, KPMG, TGIS Aviation, Ishka Airglobal Finance, Skyworks, EY and Cloudcards is consistent. Five gaps come up almost every time.

**2.1 Methodology opacity.** Most current ECL engines treat the PD curve, the LGD curve, the SICR threshold and the jurisdiction overlay as inputs the vendor configures. The user sees the output, not the engine. Auditors increasingly expect the inverse: every assumption visible, every change tracked. The audit committee question is no longer *"what did the model produce"*, it is *"who changed which assumption, when, why, and how did that move the number"*. Most platforms answer the first question well and the second question with a screenshot.

**2.2 Configurability lock-in.** A lessor's workflow is a function of its size, jurisdiction, capital structure, and origination model. A boutique Irish lessor with 18 aircraft does not run risk like Avolon. Existing platforms, because they were built to serve a specific segment first, tend to expect their segment's workflow. Adapting them to a tradeable-asset desk or a financing-side workflow requires a vendor services engagement.

**2.3 Excel hostility.** Analysts live in Excel. Every platform vendor knows this and every platform vendor's strategy is to slowly move the work out of Excel. This is correct in theory and almost universally wrong in practice. The platforms that have customer love tend to be the ones that meet the analyst inside the model they already built, rather than ask them to rebuild it.

**2.4 Narrow specialisation.** Cirium tells you what an aircraft is worth. IBA tells you what a lease should rent for. Aerlytix tells you what the ECL is. Bloomberg tells you what the macro is doing. Nobody joins these. The analyst joins them, in Excel, on Sunday night, before the credit committee meeting on Monday morning.

**2.5 No integrated AI signal layer.** The current state of "AI in aviation finance" is one of two things: a chatbot that answers questions about the platform, or a news scraper that surfaces headlines. Neither of these is signal. Real signal is "given my portfolio, what changed today that moves my ECL". That requires the AI to understand the portfolio, the methodology, and the news, and to correlate all three. No incumbent does this today.

## 3. The thesis behind AeroInsights

AeroInsights does not try to be Aerlytix-plus-one-feature. It is built around four architectural commitments, each of which deliberately diverges from the incumbent approach:

**3.1 Methodology transparency.** Every PD curve, every LGD curve, every jurisdiction overlay, every SICR threshold is a first-class object in the database, not a hidden engine parameter. Every change to those objects is logged with the user, timestamp, and reason. The audit trail is the product, not a feature of it.

**3.2 Configurability over feature-completeness.** The platform is architected so the same engine can serve a lessor, a financier, an advisor, a technical team, a trader, or a manufacturer with parameter changes, not code changes. This is why a single solo build can credibly cover the surface area it does: most of the variation between use cases lives in configuration, not in distinct features.

**3.3 AI as a portfolio-aware signal layer.** The intelligence module is built around the question *"what moved today that moves my ECL"*, not *"answer my question"*. News, macro and jurisdictional signals are scored by direct portfolio relevance and routed into the watchlist. The AI is a background process, not a foreground chat.

**3.4 Excel-native at every layer.** A first-party Office.js add-in exposes the live portfolio, ECL outputs and scenario results as Excel custom functions (`=AI.Portfolio(...)`, `=AI.ECL(...)`). Analysts get live data inside their existing models. The platform does not try to replace the model: it feeds it.

The rest of this document is the platform built against those four commitments.

---

# Part II: Architecture

## 4. Platform architecture

| Layer | Stack | Notes |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite 6, Tailwind v4, Radix UI, Framer Motion, React Router 7 | Single-page application, fully client-rendered. Persistent shells for heavy app pages so cross-tab navigation does not re-mount the Dashboard / Portfolio / Scenarios / Deals workspaces. |
| **Backend** | TypeScript serverless functions on Vercel (Fluid Compute), organised by domain under `api/*`: `auth/`, `ai/`, `signals/`, `excel/`, `risk-engine/`, `scenarios/`, `admin/`, `cron/` | No long-running server. Functions warm via Fluid Compute. AI calls go through the Vercel AI Gateway, with provider fallback and observability. |
| **Database** | Supabase (managed Postgres) with Row-Level Security | 39 timestamped SQL migrations to date. RLS enforces per-organisation isolation on every query. SECURITY DEFINER RPCs handle bootstrap flows (e.g. resolving the user's active organisation before the client has a full session). |
| **Auth** | Auth0 (JWT, JWKS) | JWT verified server-side using Web Crypto; exchanged for a short-lived Supabase token at `/api/auth/supabase-token` so RLS can read organisation membership directly off the token. |
| **Scheduled jobs** | Vercel cron, declared in `vercel.json` | Daily jobs: alert evaluation, watchlist refresh, FX rates, news signal ingest, scheduled report rendering. |
| **Observability** | Sentry React + Sentry Vercel Edge, Vercel Analytics, Speed Insights | Errors traced from client through the function tier. |
| **Deployment** | Vercel (frontend + functions + cron + edge sentry) | Production: `aeroinsights.vercel.app`. Deploys on push to `main`, with explicit prod promotion via CLI. |

The deliberate choice here is to push as much logic as possible into Postgres (RLS, RPCs, immutable snapshot tables, audit log) and use the function tier only for things Postgres genuinely cannot do well: external API calls, AI orchestration, scheduled jobs, Excel custom-function endpoints. The result is a stack a single engineer can maintain without the operational drag of running a backend server.

## 5. The data model: what the platform actually understands

Below is the durable shape of the data model, organised by the entities the platform reasons about. Each block maps to one or more database migrations.

**5.1 Organisations and portfolios:** `portfolios_table`, `create_organisation_with_member_rpc`, `get_my_latest_org_id_rpc`. Multi-tenant from day one. An organisation can own multiple portfolios (e.g. owned book vs. managed book vs. ABS-segregated trust). Every query is scoped via RLS on `organisation_id`.

**5.2 The lease register and asset register:** `aircraft_register_ingest`, `lessee_profiles_ingest`. Aircraft are first-class objects (registration, MSN, type, age, maintenance status). Lessees are first-class objects (jurisdiction, credit rating, parent group). Leases connect them with rent, term, escalation, security deposits, maintenance reserves.

**5.3 Security deposits and maintenance reserves:** `sd_mr_ingest`. SD/MR balances tracked at the lease level, with adequacy assessment feeding directly into LGD.

**5.4 ABS and securitised structures:** `abs_deals`, `servicer_reports`. ABS structures modelled with their own scope, with servicer report ingest for portfolios managed inside a structured deal.

**5.5 Cash and reconciliation:** `bank_statements`, `reconciliation_matches`, `cash_events`, `cash_events_unique_txn`. Bank statements ingested, auto-matched to expected lease payments, with manual override; reconciled events written to a unique-transaction-keyed cash event ledger.

**5.6 Maintenance events:** `maintenance_events`. Major maintenance events (C-check, engine shop visit) recorded against airframe/engine identifiers, with forecast next-event dates.

**5.7 IFRS 9 parameters:** `ifrs9_parameters`, `sicr_config`. Reporting-cycle parameters (period start, period end, base rate set), and the Significant Increase in Credit Risk configuration (per-segment SICR thresholds).

**5.8 PD, LGD, and jurisdiction LGD overlays:** `aviation_pd_curves`, `lgd_curves`, `jurisdiction_lgd_overlays`. Aviation-specific PD curves (cohort, vintage, by rating bucket) and LGD curves (by asset class, by aircraft generation), with jurisdiction-level overlays that adjust LGD for repossession complexity, CTC adoption, and insolvency regime.

**5.9 Scenarios:** `stress_scenarios`, `scenario_runs`. Pre-built scenarios stored as parameter sets (macro overlays, counterparty downgrade matrices, lessee-level overrides). Every scenario run logged with full inputs and snapshot output, so any run is reproducible months later.

**5.10 ECL snapshots:** `ecl_period_snapshots`, `ecl_period_snapshots_immutable`, `ecl_snapshots_portfolio_scope`. ECL outputs are written to period snapshots; once a period is closed, the snapshot is locked (immutable trigger) and any restated number requires an explicit restatement entry. This is the audit-trail backbone.

**5.11 Stage migrations:** `stage_migrations`. Per-lessee stage transition logged at each period close, with the rationale (rule triggered, manual override, restoration).

**5.12 Assumption change log:** `assumption_change_log`. Every change to PD/LGD/SICR/jurisdiction overlay parameters logged with user, timestamp, before/after, and reason. This is the database object that turns "auditable" from an adjective into a SQL query.

**5.13 Alerts and watchlist:** `alert_rules`, `alert_rules_extend_kinds`, `watchlist`. User-configurable alert rules across portfolio events, market signals, jurisdiction changes, and counterparty signals. Watchlist tracks specific lessees, jurisdictions, or aircraft tail numbers under active monitoring.

**5.14 News and macro signals:** `news_signals`, `fx_rates`. Daily news ingest, deduplicated and scored against the active watchlist. FX rates updated daily from central-bank sources, feeding currency translation across the portfolio.

**5.15 Reports:** `report_schedules`, `report_exports`. Scheduled reports configured per organisation; every export written to an immutable export log with re-download capability.

**5.16 Audit log:** `audit_log`. Every user action that mutates state is logged with actor, organisation, resource, action, and a JSON payload of the change.

**5.17 Security lockdown:** `phase4_rls_lockdown`, `phase4_storage_lockdown`, `security_audit_rls_lockdown`. Three iterations of RLS hardening; the current state is that no table is accessible without an organisation-scoped policy, and no storage object is accessible without a per-object signed URL.

## 6. Audit trail and immutability

Three properties differentiate an auditable system from a tool:

1. **Every assumption change is logged with reason.** `assumption_change_log` enforces this at the database level via a trigger; the application cannot bypass it.
2. **Period snapshots are immutable after close.** `ecl_period_snapshots_immutable` is a row-level trigger that prevents update or delete after the `period_closed_at` column is non-null. Restated numbers require a new entry, not an overwrite.
3. **Every report export is logged and re-downloadable.** `report_exports` keeps the rendered artifact, the inputs that produced it, and the user who exported it. Audit teams can reproduce any historical report bit-for-bit.

These three properties are why the platform can plausibly survive an external IFRS 9 audit, not just produce an IFRS 9 number.

---

# Part III: Module walkthrough

The application is organised as ten primary modules. The walkthrough below follows the navigation order, with each sub-tab covered separately. For every sub-tab, the format is:
- **Purpose:** what the user does here
- **What it shows:** surface
- **Methodology underneath:** the data model and computation
- **Where it differs:** the specific way this surface diverges from how the same job is done today

## 7. Portfolios (entry point)

Before a user is in the application proper, they enter through the Portfolios screen.

**7.1 Portfolio Hub.** The hub lists every portfolio the user can access (multi-org and multi-portfolio-per-org). Each card shows headline metrics: assets under management, fleet size, current ECL, last update. Selecting a portfolio sets the active context for every other screen.

**7.2 Onboarding Wizard.** First-time users are routed through an onboarding flow that creates the organisation, registers the first portfolio, and ingests an initial dataset (Excel template, CSV bulk import, or starter dataset). The wizard captures the bare minimum to make Risk & ECL functional: lease register, lessee directory, aircraft register, and the initial IFRS 9 parameters.

**Where it differs.** Multi-portfolio scoping is built in from day one. Most platforms assume one balance sheet per tenant; AeroInsights assumes a lessor may need to model an owned book separately from a managed book or an ABS-segregated trust, with separate ECL closes per portfolio.

## 8. Portfolio (the asset book)

This is the spine of the platform. Every other module reads from here.

### 8.1 Lease Register

**Purpose.** The live, authoritative lease book.

**What it shows.** Sortable, filterable table: aircraft, lessee, jurisdiction, lease start, lease maturity, monthly rent, security deposit balance, maintenance reserve balance, escalation profile, current stage. One-click XLSX export of the filtered view.

**Methodology underneath.** Lease records are joined to aircraft and lessee tables on every load; the register is a view, not a copy. Edits to lease records emit a row into `audit_log`. Filters are URL-encoded so a particular view can be shared via link.

**Where it differs.** The register is the spine, not the report. Every other module (Risk & ECL, Scenarios, Deals, Reports) reads from the same table the user is looking at on this screen. There is no separate "ECL portfolio" that lives in a different store. This sounds obvious; in practice it is not how legacy platforms are typically structured.

### 8.2 Analytics

**Purpose.** Portfolio-level concentration and risk decomposition.

**What it shows.** Five views by default: lessee concentration (top-N exposure, Herfindahl), jurisdiction concentration, aircraft-type concentration, lease maturity profile (annualised rent by expiry year), and re-lease pipeline (aircraft coming off-lease by quarter).

**Methodology underneath.** Aggregations computed on read; for portfolios above a configurable size, materialised views refresh nightly. Currency translation handled via the daily FX rate snapshot.

**Where it differs.** The concentration views are wired to the live filter state on the Lease Register: change the filter, and the analytics views recompute for the filtered slice. Most platforms keep "the portfolio dashboard" and "the lease register" as separate screens. AeroInsights treats them as the same screen at two zoom levels.

### 8.3 Aircraft Mix

**Purpose.** Fleet composition view.

**What it shows.** Narrowbody / widebody / regional / freighter split. By manufacturer (Boeing / Airbus / Embraer / others). By generation (current-tech vs. previous-gen). By age band. By engine type. Each view drillable to the underlying aircraft list.

**Methodology underneath.** Aircraft classification taxonomy stored as a versioned reference table; the platform supports overriding the default taxonomy per organisation (e.g. a freighter conversion shop may want to classify by conversion programme).

**Where it differs.** The taxonomy is editable per organisation. Most platforms hard-code the classification. This sounds minor; for organisations that run unusual fleets (regional conversion, government leasing, military), it is the difference between the platform working out of the box and not.

### 8.4 Performance

**Purpose.** Portfolio yield, leverage, and credit quality over time.

**What it shows.** Yield (rent / asset value), DSC, LTV, ECL ratio (ECL / portfolio value), provision coverage. All shown as time-series with selectable period (last 4 quarters, last 8 quarters, full history).

**Methodology underneath.** Snapshots written nightly; performance series reads from the snapshot table, not the live register, so period-over-period comparisons remain valid even after intra-period restatements.

**Where it differs.** ECL ratio is on the performance dashboard, not buried inside the ECL module. This is the metric senior leadership actually reads; surfacing it next to yield and LTV makes the relationship between risk pricing and risk reality visible.

## 9. Scenarios

Stress testing is treated as a first-class workflow, not a sub-feature of ECL.

### 9.1 Library

**Purpose.** Browse and run pre-built scenarios.

**What it shows.** A grid of scenario cards: base, mild stress, severe stress, upside, IFRS 9 reference scenarios (ECB-aligned), aviation-specific historical replays (post-9/11 demand shock, post-pandemic recovery delay, regional default cluster), and custom scenarios saved by the organisation.

**Methodology underneath.** Each scenario is a parameter set: macro overlays (GDP delta, fuel price delta, RPK growth curve), counterparty overlays (downgrade matrix by current rating), per-aircraft/per-lessee overrides. Stored in `stress_scenarios`. Running a scenario reads from the live portfolio, applies the parameter set, recomputes ECL across the portfolio, and writes a `scenario_runs` row with the full input/output snapshot.

**Where it differs.** Aviation-specific historical replays come pre-built. Most platforms ship with macro scenarios; AeroInsights ships with sector-specific replays because aircraft credit responds to different shocks than corporate credit.

### 9.2 Run History

**Purpose.** Every scenario run, ever, with full reproducibility.

**What it shows.** Run history table: timestamp, run name, scenario, inputs hash, output ECL, run-by, run duration. Click any run to see the full input/output diff.

**Methodology underneath.** Each row in `scenario_runs` contains the complete parameter snapshot (not just the scenario ID), so a scenario edited after a run still leaves the historical run reproducible. Run outputs are versioned, and outputs can be diff'd against any other run.

**Where it differs.** This is where reproducibility lives. In an Excel-based workflow, the "scenario I ran six months ago" is gone the moment the workbook is saved. In AeroInsights, it is a database row. This matters for audit, for board materials, and for any conversation that starts with *"remember that severe stress we ran in Q1?"*.

### 9.3 Custom Builder (`/build`)

**Purpose.** Build a scenario from scratch.

**What it shows.** Six configuration panels: (1) macro overlays: GDP growth path, fuel price path, FX paths; (2) traffic recovery curve: by region; (3) counterparty overlays: downgrade matrix, default cluster triggers; (4) jurisdiction overlays: bump LGD by jurisdiction; (5) per-aircraft / per-lessee overrides; (6) portfolio scope: full portfolio or filtered subset. Live preview of the impact on ECL as parameters change.

**Methodology underneath.** Form state persisted in local storage (so analysts can refine over multiple sittings without losing work). Submitting a scenario writes the parameter set to `stress_scenarios` and triggers a run, which writes to `scenario_runs`. The clone affordance bridges via session storage so an analyst can fork an existing scenario without re-entering every parameter.

**Where it differs.** Most platforms ship a scenario library and let you pick one. AeroInsights treats the custom builder as the primary surface and the library as a starting point. The implicit assumption is that the firm's house view on scenarios is more useful than the vendor's.

## 10. Risk & ECL

The IFRS 9 module. The deepest module in the platform and the one most aligned with how an auditor reads the system.

### 10.1 Summary

**Purpose.** Portfolio-level ECL state, period-over-period.

**What it shows.** Headline ECL by stage (S1 / S2 / S3), total provision coverage ratio, movement vs. prior period, materiality flags (any single-position contributing >5% of total ECL).

**Methodology underneath.** Reads from the most recent `ecl_period_snapshots` row for the active portfolio. Movement decomposition pulled from the waterfall computation (see 10.3). Stage classification driven by the per-position record in `stage_migrations` for the period.

**Where it differs.** Materiality flagging is built in. Most platforms surface the total ECL number; AeroInsights surfaces the total ECL number *and* the three positions driving most of it, so the analyst lands directly on the rows that matter.

### 10.2 Staging Migration

**Purpose.** Track how the portfolio moves between IFRS 9 stages over time.

**What it shows.** Rolling 12-month transition matrix: stage-to-stage migration probabilities observed in-portfolio, segmented by lessee credit tier, by jurisdiction, by aircraft type. Per-lessee migration trace: every stage change for a counterparty with the trigger that caused it.

**Methodology underneath.** Transition matrix computed from `stage_migrations` table. Each migration row carries the trigger: SICR breach (PD multiple exceeded), 30+ days past due, restructure, manual override (with required reason), restoration after cure period. SICR threshold configurable per segment via `sicr_config`.

**Where it differs.** Per-lessee migration trace with trigger reasons is the answer to the most common audit question: *"why did this counterparty move from S1 to S2 in March?"*. Most platforms can tell you the position migrated; AeroInsights can tell you what the system thought at the time, what the user did about it, and why.

### 10.3 Waterfall

**Purpose.** IFRS 9 disclosure-aligned ECL movement breakdown.

**What it shows.** Period-over-period ECL movement broken down by: new origination, runoff, stage migration impact, PD change impact, LGD change impact, EAD change impact, model parameter change, FX impact. Total reconciles to opening ECL → closing ECL exactly. Drillable to lessee level.

**Methodology underneath.** Two-period decomposition: hold portfolio composition constant, vary one driver at a time, sum the deltas. Order matters: the platform uses the standard sequential allocation (composition → PD → LGD → EAD → model) and surfaces the FX impact separately. Computed once per period close and snapshotted; subsequent reads serve the snapshot.

**Where it differs.** Audit teams expect this format and most platforms produce something that resembles it. The differentiator here is the drill-down: every bar in the waterfall can be expanded to the per-position contribution. The model-change line in particular is high-trust because every parameter change has an audit-logged reason in `assumption_change_log`.

### 10.4 Rating & PD

**Purpose.** Manage the credit rating model and PD/LGD/EAD parameter tables.

**What it shows.** Four views: (1) Rating distribution across the portfolio; (2) PD curve catalogue: aviation-specific PD curves by rating bucket, asset class, vintage; (3) LGD curve catalogue: base LGD by asset class and aircraft generation; (4) Jurisdiction LGD overlay matrix: per-country adjustment to base LGD reflecting repossession complexity, CTC adoption status, insolvency law regime.

**Methodology underneath.** PD curves stored in `aviation_pd_curves`, with cohort/vintage structure so curves can be refreshed with new history without invalidating historical snapshots. LGD curves in `lgd_curves`. Jurisdiction overlays in `jurisdiction_lgd_overlays`, with the overlay applied as a multiplier on base LGD. Every change to a curve or overlay logged in `assumption_change_log` with required reason, before-state, after-state, and effective date.

**Where it differs.** This is the deepest single point of methodological transparency in the platform. In a typical incumbent setup, the PD and LGD curves are vendor-managed; the user sees the output. AeroInsights treats them as user-managed first-class objects with full audit. The jurisdiction LGD overlay in particular, adjusting LGD for whether the lessee's country has ratified Cape Town, whether the local insolvency regime is creditor-friendly, whether sanctions risk affects asset retrieval, is the kind of methodology adjustment that lessors absolutely make in practice but typically have to make outside their ECL system. Here it is inside the system and audit-logged.

## 11. Deals

The deal origination side. Where a new lease or a structure gets modelled before it goes on the book.

### 11.1 Generator

**Purpose.** Model a new lease structure from scratch.

**What it shows.** Lease structure form: aircraft type and condition, lessee credit profile, lease term, monthly rent, security deposit, maintenance reserve profile, end-of-lease return conditions, residual value assumption. Outputs: implied yield, IRR, NPV, capital at risk, expected ECL under base and stress.

**Methodology underneath.** Cash flow projection at lease level; discount rate set by the firm's cost-of-capital configuration. ECL computed using the same engine and parameter tables as Risk & ECL, so the implied ECL on a new deal is methodologically consistent with the portfolio ECL.

**Where it differs.** Deal modelling uses the same engine as portfolio risk. Most workflows today have a deal-pricing spreadsheet and a portfolio-risk system that do not agree on PD/LGD. New deals get priced with one set of assumptions and provisioned with another. AeroInsights collapses these into one model.

### 11.2 Rack-Stack

**Purpose.** Compare multiple deal opportunities side by side.

**What it shows.** Configurable comparison table across deals: implied yield, IRR, capital usage, risk-adjusted return (yield – expected loss), portfolio concentration impact (does this deal push any concentration limit), sensitivity to one or two analyst-selected stresses.

**Methodology underneath.** Each candidate deal is a hypothetical entry into the live portfolio. Concentration impact computed as if the deal were added. Risk-adjusted return uses the same ECL engine as the rest of the platform.

**Where it differs.** Concentration impact is computed against the live portfolio, not a static snapshot. If two deals would individually pass concentration limits but together breach them, the rack-stack shows that.

### 11.3 Exit NPV

**Purpose.** Model exit strategies on existing positions.

**What it shows.** For a selected lease or aircraft: NPV of holding to lease maturity, NPV of mid-lease sale, NPV of sale-leaseback, NPV of part-out (for older aircraft). Tax / jurisdiction sensitivities. Comparable-transaction reference points pulled from Deal Feed (see 14.5).

**Methodology underneath.** Future cash flow projected under each exit path; residual value at each exit point pulled from the platform's value curves or analyst override. Tax treatment configurable per jurisdiction.

**Where it differs.** Comparable transactions are surfaced live from the Deal Feed (Intelligence module). The valuation case for a sale or sale-leaseback is anchored to recent comparables in the platform, not to a separate paid feed.

## 12. Maintenance

Maintenance reserve adequacy is one of the most important LGD inputs for aircraft leases. Treating it as a separate module is a feature.

### 12.1 Aircraft (asset view)

**Purpose.** Per-aircraft maintenance status.

**What it shows.** For each aircraft: current MR balance by component (airframe, engines, APU, landing gear, life-limited parts), forecast next event date for each major check, projected MR adequacy at each future event (does the accrued reserve cover the projected event cost), recent maintenance events logged.

**Methodology underneath.** Maintenance events stored in `maintenance_events`. Next-event date forecast by extrapolating flight hour / flight cycle utilisation from servicer reports against the OEM maintenance programme. MR adequacy = projected accrued balance at event date / projected event cost. Below-1.0 ratios flagged for analyst review.

**Where it differs.** MR adequacy feeds directly into LGD assumption. If a lessee defaults with an under-reserved aircraft, recovery is meaningfully lower. AeroInsights ties this back to the credit module: under-reserved aircraft for stressed lessees show up as a flagged item in Risk & ECL.

### 12.2 Scenarios (maintenance cost forecasting)

**Purpose.** Project fleet-wide maintenance cost over time.

**What it shows.** Aggregate MRO cost forecast by quarter, segmented by airframe, by engine type, by component. Stress overlays for unscheduled event rates.

**Methodology underneath.** Fleet-level Monte Carlo over individual aircraft event schedules; cost per event drawn from market reference cost curves with analyst-adjustable overlays.

**Where it differs.** Maintenance scenarios are a separate workflow from credit scenarios because the underlying drivers are different. Most platforms either skip maintenance entirely or fold it into a single scenario engine that does both poorly.

## 13. Cash Flow & Reconciliation

The reality check. Where modelled cash flow gets compared to actual bank activity.

### 13.1 Transactions

**Purpose.** The lease payment ledger.

**What it shows.** Expected payments table: lessee, lease, due date, expected amount, actual amount, variance, payment status (received, late, partial, missed). Late payment flagging configurable by tolerance window.

**Methodology underneath.** Expected payments derived from the lease register and escalation schedule. Actual payments populated from the Reconciliation module (13.2).

**Where it differs.** Late payment flagging triggers can be tied directly to SICR rules. A configurable rule: "lessee 30+ days past due on any obligation → migrate to S2" runs against this data automatically. This is the kind of automation that turns IFRS 9 from a quarterly chore into a live monitoring layer.

### 13.2 Reconciliation

**Purpose.** Match bank statement activity to expected lease payments.

**What it shows.** Bank statements ingested from configured accounts. Auto-match table: bank transaction → expected lease payment, with confidence score. Manual override workflow for low-confidence matches and outliers.

**Methodology underneath.** Auto-match algorithm uses amount, date proximity, payment reference matching, and counterparty disambiguation. Match confidence stored alongside the match. Matched events written to `cash_events` with `cash_events_unique_txn` enforcing no double-counting.

**Where it differs.** Cash recon is wired into the credit module. Reconciled payment activity is the most direct evidence of counterparty health a lessor has. Surfacing recon directly to Stage Migration means stage moves are evidence-backed, not date-rule-only.

### 13.3 Cash Flow

**Purpose.** Projected vs. actual cash flow over time.

**What it shows.** Stacked cash flow chart by period: expected rent in, actual rent in, MR drawdowns, SD applications, ABS waterfall distributions. Variance analysis. Forward projection with overlay of scheduled payments and modelled receipts.

**Methodology underneath.** Projection from lease register; actuals from reconciled cash events. For ABS structures, servicer reports ingested into `servicer_reports` provide the waterfall view.

**Where it differs.** ABS-segregated portfolios get the right cash flow view. Most platforms either model an owned book or model an ABS book; AeroInsights does both inside one tenant, with separate portfolio scoping.

## 14. Intelligence: the AI signal layer

The AI layer. Treated as a background process that produces watchable signal, not a chatbot.

### 14.1 Counterparties

**Purpose.** Per-lessee profile aggregation.

**What it shows.** For each lessee in the portfolio: aggregate exposure, current rating, stage, jurisdiction, parent group, recent news, recent rating actions, recent operational signals (load factor, fleet age, schedule stability), watchlist status.

**Methodology underneath.** Counterparty profile assembled on read from the lease register (for exposure) and the news signal store (for news/operational signals). Rating history versioned with effective dates.

**Where it differs.** Exposure, news, and methodology are joined in one view. Most workflows today require the analyst to assemble this from three or four screens.

### 14.2 Jurisdictions

**Purpose.** Per-country risk profile.

**What it shows.** Country-by-country table: sovereign rating, CTC adoption status (Cape Town Convention ratification and protocol participation), insolvency regime classification (creditor-friendly / mixed / debtor-friendly), recent sanctions changes, current LGD overlay applied.

**Methodology underneath.** Jurisdiction data stored as a managed reference table with editable per-organisation overlays. LGD overlay drawn from `jurisdiction_lgd_overlays`. CTC status maintained against the UNIDROIT registry.

**Where it differs.** This is the operational version of jurisdiction risk. Most platforms surface sovereign rating; AeroInsights surfaces sovereign rating *and* the things that actually move recovery in this asset class: CTC ratification, the IDERA registration status, the actual track record of repossessions out of that jurisdiction.

### 14.3 Signals

**Purpose.** Macro and operational signal feed.

**What it shows.** Daily signal cards: FX moves above threshold, fuel price moves above threshold, regional RPK series, central bank rate decisions, sovereign rating actions. Each signal scored for portfolio relevance.

**Methodology underneath.** Macro data pulled from IMF / ECB / EIA / NewsData on daily schedule via Vercel cron (`cron/news-signals`, `cron/fx-refresh`). Signal scoring runs the signal against the portfolio composition (exposure by jurisdiction, currency, fuel-sensitivity).

**Where it differs.** Signals are scored against the portfolio, not surfaced raw. A 5% fuel move matters more if 40% of your lessees are budget carriers; the platform tells you that.

### 14.4 Lessee Radar

**Purpose.** Counterparty news monitoring with portfolio relevance.

**What it shows.** Per-counterparty news feed: financial news, operational news (route changes, fleet announcements), regulatory news. Each item scored for portfolio relevance (exposure size × event severity).

**Methodology underneath.** News ingested from multiple providers (NewsData, TheNewsAPI), deduplicated, entity-resolved to portfolio lessees, scored by an LLM running through the Vercel AI Gateway. Scored news written to `news_signals` with portfolio-relevance and severity.

**Where it differs.** Pre-filings signal detection. The platform routinely surfaces operational news (a regional carrier suspending half its schedule, a parent group selling a stake) days or weeks before the same information lands in financial filings. The output of the radar is a triage queue, not a news reader.

### 14.5 Deal Feed

**Purpose.** Recent comparable transactions.

**What it shows.** Recent transactions feed: aircraft type, lessee, structure, implied yield (where disclosable). Sortable by aircraft type and lessee tier.

**Methodology underneath.** Aggregated from public deal announcements; analyst-input deals supported for proprietary intel. Used as a reference layer by the Deal Generator and Exit NPV.

**Where it differs.** Sits inside the same platform as the deal modelling. Pricing a new deal against current comparables is one screen away, not one phone call away.

### 14.6 Jurisdiction Watch

**Purpose.** Sovereign and regulatory event tracking.

**What it shows.** Real-time alerts for events that move jurisdiction risk: sovereign rating action, sanctions list change, CTC accession change, major court decision on aircraft repossession in a relevant jurisdiction.

**Methodology underneath.** Subscribed sources (rating agency releases, OFAC, UNIDROIT) ingested daily; events scored against portfolio jurisdiction exposure. Significant events trigger an alert on the watchlist.

**Where it differs.** Direct propagation to ECL. A sanctions change that affects a portfolio jurisdiction surfaces as a recommended jurisdiction LGD overlay adjustment, with one-click apply (and audit log).

### 14.7 Rate Outlook

**Purpose.** Forward funding curves and rent reset modelling.

**What it shows.** Forward curves for major funding currencies (USD, EUR), aligned to lease maturity profile so the analyst sees funding cost evolution against rent receipt evolution. Rent reset modelling for floating-rate leases.

**Methodology underneath.** Curves pulled from central bank releases (`cron/fx-refresh` for spot, separate fetch for forward points). Rent reset uses the lease's defined reset formula.

**Where it differs.** Funding cost evolution displayed alongside the lease maturity profile from the Portfolio module. The two screens that should always be looked at together (the asset side and the liability side) actually live next to each other.

## 15. Reports

Reporting is treated as a distinct workflow, not a "share" button.

### 15.1 Templates

**Purpose.** Pre-built report templates.

**What it shows.** Template library: IFRS 9 disclosure pack (IFRS 7.35 and IFRS 7.35I-K), audit committee pack, quarterly portfolio review, board pack, investor deck, credit memo, regulator submission templates.

**Methodology underneath.** Each template is a defined data-source-and-layout specification. Generates PDF and XLSX outputs. Generation is server-side via the cron-rendered pipeline (`cron/scheduled-reports`) for scheduled jobs and inline for ad-hoc renders.

**Where it differs.** Templates are versioned. A regulator submission rendered against version 2.3 of the template stays renderable against that version even after the template is updated.

### 15.2 Scheduled

**Purpose.** Recurring report jobs.

**What it shows.** Schedule list: report template, frequency (daily/weekly/monthly/quarterly), recipients, last run, next run. Configurable per-organisation.

**Methodology underneath.** Scheduled report definitions in `report_schedules`. Vercel cron job runs daily, picks up due reports, renders them, emails to recipients, and writes a `report_exports` row.

**Where it differs.** The scheduled reports run as audit-quality artifacts (with full input snapshot) rather than as throwaway summaries. Every scheduled run is reproducible.

### 15.3 Export Log

**Purpose.** Immutable export history.

**What it shows.** Every export, ever: timestamp, template, parameters, user, file. Re-downloadable. Click-through to the period snapshot that produced it.

**Methodology underneath.** `report_exports` table with file references stored in object storage (signed URLs only). Snapshot pointer ensures the export can be re-rendered from source if the original file is lost.

**Where it differs.** Re-downloadability of historical exports is the audit committee's favourite feature. The system is the system of record for the report, not the email it was attached to.

## 16. Settings

Configuration. The reason the platform can be adapted across user segments.

### 16.1 Firm

**Purpose.** Organisation-level defaults.

**What it shows.** Firm name, base currency, FX policy (consistent or daily mark), default fiscal year-end, organisation logo, period close cadence.

**Methodology underneath.** Stored on the organisation record. Most other settings reference this for defaults.

### 16.2 Users

**Purpose.** Membership and role management.

**What it shows.** Member list: name, email, role (admin / analyst / viewer), last seen, status. Invitation flow for new members.

**Methodology underneath.** Backed by Auth0 with role assignment in the application database. RLS policies on every table read role from the Auth0 JWT exchanged for a Supabase token.

**Where it differs.** Role enforcement is at the database, not at the UI. A viewer cannot mutate state even via direct SQL, because the RLS policy denies write.

### 16.3 Data Sources

**Purpose.** Configure data ingest.

**What it shows.** Three sub-views: Excel/CSV templates (download templates, upload data), API integrations (connect to servicer report feeds, accounting systems), data quality reports (failed ingests, validation errors).

**Methodology underneath.** Each data source has a defined schema and validation pipeline. Failed validations surfaced as actionable errors; partial ingests supported (commit valid rows, surface invalid rows for correction).

### 16.4 ECL Settings

**Purpose.** Configure the IFRS 9 engine.

**What it shows.** IFRS 9 parameters (`ifrs9_parameters`): period definition, discount rate base, currency translation policy. SICR config (`sicr_config`): per-segment SICR thresholds. PD/LGD curve assignment by segment. Jurisdiction LGD overlay table. Period close action: lock the current period to immutable snapshot.

**Methodology underneath.** Every change here writes to `assumption_change_log` with required reason field. The period close action triggers `ecl_period_snapshots_immutable` enforcement: the current snapshot is sealed and restatement requires a separate restatement entry.

**Where it differs.** This is where the methodology lives, and every change is audited at the database level. Most platforms make these vendor-configured (the user does not see them); AeroInsights makes them user-configured with full audit.

### 16.5 Excel Settings

**Purpose.** Configure the Excel add-in.

**What it shows.** Add-in installation status, token management (issue/revoke), allowed worksheets, refresh frequency configuration.

**Methodology underneath.** Add-in authenticates with the same Auth0 token as the web client. Token scoped to specific portfolios. All add-in queries hit the same authorised endpoints as the web client; RLS enforced identically.

## 17. Excel Add-In

A separate first-class surface.

**Purpose.** Live platform data inside Excel.

**What it shows.** Excel sidebar with: portfolio selector, function reference, recent calls log. In-cell: custom functions exposing live data.

**Available functions (partial list):**
- `=AI.Portfolio(metric)`: live portfolio metrics (fleet size, AuM, ECL ratio, average yield)
- `=AI.Lessee(lessee_id, field)`: lessee-level fields (rating, stage, exposure, jurisdiction)
- `=AI.Lease(lease_id, field)`: lease-level fields (rent, term remaining, MR balance, SD balance)
- `=AI.Aircraft(msn, field)`: aircraft-level fields (current value, MR adequacy, next major event)
- `=AI.ECL(scope, parameter)`: ECL outputs by scope (portfolio, segment, lessee) and breakdown (stage 1/2/3, total, coverage ratio)
- `=AI.Scenario(scenario_id, scope, metric)`: scenario run outputs
- `=AI.FX(currency_pair, date)`: FX rates (matches platform's daily snapshot)

**Methodology underneath.** Office.js add-in published as an XML manifest (`public/manifest.xml`). Custom functions backed by `api/excel/[fn].ts` serverless endpoints. Authentication via Auth0 token persisted in the add-in.

**Where it differs.** Live data, no copy-paste. The most consistent moment of analyst reaction across every demo I have run has been the moment a `=AI.Portfolio("ecl_ratio")` cell ticks up because the underlying data refreshed. The implicit assumption that drives this feature is that analysts will keep doing analysis in Excel for the next decade; the platform should make their Excel better, not try to evict them from it.

---

# Part IV: Integration

## 18. How every module connects to every other

The platform is built on the principle that everything reads from the same source of truth. The lease register is the spine, and the data flows are deterministic.

```
                            ┌─────────────────────────────┐
                            │   PORTFOLIO (lease register)│
                            │  aircraft × lessee × lease  │
                            └──────────────┬──────────────┘
                                           │
       ┌───────────────────────┬───────────┼───────────┬────────────────────────┐
       │                       │           │           │                        │
       ▼                       ▼           ▼           ▼                        ▼
┌──────────────┐    ┌────────────────┐ ┌────────┐  ┌────────────┐    ┌──────────────────┐
│  ANALYTICS   │    │   RISK & ECL   │ │ DEALS  │  │ MAINTENANCE│    │   INTELLIGENCE   │
│ concentration│    │ S1/S2/S3, PD,  │ │ pricing│  │ MR, events │    │ news, signals,   │
│ maturity,    │    │ LGD overlays,  │ │ NPV,   │  │ forecasts  │    │ jurisdictions    │
│ aircraft mix │    │ waterfall,     │ │ comps  │  │            │    │                  │
│              │    │ snapshots      │ │        │  │            │    │                  │
└──────────────┘    └───────┬────────┘ └────┬───┘  └──────┬─────┘    └─────────┬────────┘
                            │               │              │                    │
                            ▼               ▼              ▼                    ▼
                       ┌─────────────────────────────────────────────────────────────┐
                       │                          SCENARIOS                          │
                       │  parameter sets, custom builder, runs (reproducible)        │
                       └─────────────────────────┬───────────────────────────────────┘
                                                 │
                                                 ▼
                                       ┌──────────────────┐
                                       │    REPORTS       │
                                       │ IFRS 9 packs,    │
                                       │ board materials, │
                                       │ regulator output │
                                       └──────────────────┘
                                                 ▲
                                                 │
                              ┌──────────────────┴──────────────────┐
                              │      CASH FLOW & RECONCILIATION     │
                              │ bank ingest, auto-match, cash events│
                              └──────────────────┬──────────────────┘
                                                 │
                            (reality feedback into stage migration & PD calibration)
                                                 │
                                                 ▼
                                          [Risk & ECL]
```

**The integration story in plain prose:**

1. **The lease register is the source of truth.** Every other module reads from it.
2. **Analytics is a live view of the register.** Change the filter on the register, the analytics adapt.
3. **Risk & ECL reads the register, applies the methodology layer (PD / LGD / SICR / jurisdiction overlays), writes the period snapshot.** The snapshot is the audit-grade record.
4. **Scenarios reads the register, applies a parameter overlay, recomputes ECL, writes a scenario run.** Same engine as Risk & ECL, so methodologically consistent.
5. **Deals reads the register for portfolio context, models a hypothetical addition, runs the same ECL engine, surfaces concentration impact.** Deal pricing and portfolio provisioning agree by construction.
6. **Maintenance reads the asset register, projects MR adequacy, feeds LGD assumption into Risk & ECL.** A stressed lessee with an under-reserved aircraft shows up as a flagged item.
7. **Cash Flow & Reconciliation ties reality back.** Reconciled payments populate the late-payment signal that drives stage migration. Real data, not date rules.
8. **Intelligence overlays signals onto everything.** News scored against portfolio relevance. Jurisdiction events propose LGD overlay adjustments. Macro signals scored for impact on existing exposure.
9. **Reports consume final outputs.** Templates assemble from the period snapshots and the scenario runs.
10. **The Excel add-in exposes every layer.** Analysts read from any of the above into their existing models.

The point of this architecture is not novelty; it is that every workflow runs against the same model with the same assumptions. The platform is engineered so that the deal-pricing exercise on Monday and the IFRS 9 close on Friday use the same PD curves, the same LGD overlays, and the same jurisdiction framework. In practice today, these are different spreadsheets owned by different people. That is the inconsistency AeroInsights is designed to eliminate.

## 19. The audit and assumption pipeline

The second integration story is the audit trail. Every mutation to the system flows through a defined audit pipeline:

| Event | Logged in | Immutable | Reason field required |
|---|---|---|---|
| Parameter change (PD curve, LGD curve, SICR threshold, jurisdiction overlay) | `assumption_change_log` | Yes, after period close | Yes |
| Scenario run | `scenario_runs` | Yes (input/output snapshot) | No (run name only) |
| Period close | `ecl_period_snapshots`, locked by `ecl_period_snapshots_immutable` | Yes | N/A |
| Stage migration | `stage_migrations` | Yes | Yes for manual overrides |
| Report export | `report_exports` | Yes | No |
| Any user action affecting state | `audit_log` | Yes | No (action type stored) |
| RLS policy state | `security_audit_rls_lockdown` | Versioned via migration | N/A |

This is the layer that makes the platform plausibly audit-grade. An auditor can ask "show me every change to the South-East Asia LGD overlay in 2025 with the rationale", and the answer is a single SQL query. That is the bar this product is built against: not "produces a number" but "shows its work".

---

# Part V: Differentiation

## 20. The honest comparison vs. Aerlytix

Aerlytix is the only platform with real distribution in this space. The honest framing:

**What Aerlytix does well.**
- Mature ECL methodology, refined across many customer deployments.
- Customer-base credibility: 30+ lessors using LIQ means the methodology has been audited many times.
- Established consulting/services arm for implementation.
- Team scale (around 50 people, per industry observers) means feature breadth and depth Aerlytix has built up over years.

**Where AeroInsights diverges.**
- **Methodology transparency is the default, not the upgrade.** PD/LGD/SICR/jurisdiction parameters are first-class, user-configurable, fully audit-logged objects. The user is the methodology owner.
- **Configurability across user segments.** AeroInsights is architected to serve a lessor, a financier, an advisor, a technical team, a trader, and a manufacturer with parameter changes, not code changes. The same engine runs across the chain.
- **AI signal layer integrated as a background process.** Lessee Radar and Jurisdiction Watch route portfolio-relevant signals into the watchlist, scored by exposure. Not a chatbot.
- **Excel-native by default.** Office.js add-in with live custom functions is a Day-1 capability, not a roadmap item.
- **Modern stack, modern velocity.** Single-engineer iteration cycle measured in days, not quarters. Trade-off: less mature, but absorbs feedback fast.

**Where AeroInsights does not credibly claim to be ahead.**
- Customer-base validation: zero live customers vs. 30+ at Aerlytix.
- Methodology maturity: AeroInsights' curves and overlays are calibrated against published reference points and demo conversations, not against five years of in-customer audit cycles.
- Implementation services: there is no AeroInsights professional services arm.
- Documentation depth: Aerlytix has a decade of internal documentation; AeroInsights has this document.

**The honest framing for a prospect.** AeroInsights is not the safe choice for the lessor that needs to close FY26 audit on Aerlytix tomorrow. It is the interesting choice for the lessor, or the advisor, or the financier, or the trading desk, that finds the methodology black-boxing of incumbents frustrating, wants to own the parameter layer, wants the AI signal layer, and wants to keep working in Excel.

## 21. The honest comparison vs. in-house Excel stacks

Excel still does most of the work at most lessors below the top 5. The comparison is worth doing honestly:

**What Excel still does well.**
- Total flexibility: any methodology, any layout, any custom view.
- Zero learning curve for analysts.
- No vendor dependency.
- Auditable if someone disciplines the workbook (named ranges, version control, locked sheets).

**What Excel fails at.**
- Reproducibility: the workbook I ran in March is not the workbook I have today.
- Multi-portfolio: each portfolio is a separate workbook, each refresh is manual.
- Multi-user concurrency: two analysts editing the same workbook simultaneously is broken by design.
- Time-series integrity: snapshot tables degrade as anyone editing the workbook overwrites them.
- Audit trail: in practice, none.
- Scenarios: branching, saving, and comparing scenarios is brittle; reproducing a scenario six months later is rarely possible.

**Where AeroInsights extends Excel rather than replacing it.** The Excel add-in is the bridge. Analysts keep their models, custom views, and analytical flexibility; AeroInsights provides the live data, the methodology layer, the audit trail, and the cross-portfolio aggregation. The implicit thesis is that the best version of this workflow is not "kill Excel", it is "keep Excel but back it with a platform".

## 22. The honest comparison vs. point tools

Cirium / IBA / Ascend (aircraft valuations and market data), Bloomberg (macro), specialist news scrapers, OFAC screening tools, generic credit systems: none of these are competitors. They are complements:

| Point tool | What it does | AeroInsights position |
|---|---|---|
| Cirium / IBA valuations | Aircraft market values | AeroInsights consumes; analyst override supported |
| Bloomberg / Reuters | Macro data feeds | AeroInsights ingests selected series; signal layer scores for relevance |
| Generic credit systems | Corporate credit modelling | Not built for aviation specifics (jurisdiction LGD, CTC, MR adequacy); AeroInsights complements |
| OFAC / sanctions screening | Counterparty sanctions check | AeroInsights surfaces sanctions list changes via Jurisdiction Watch; full screening still owned by compliance |
| News scrapers | Raw news feeds | AeroInsights filters and scores against portfolio; raw feed is upstream input |

The honest framing: AeroInsights is the aggregation, methodology, and decision layer. Specialist data tools remain best of breed for their domain and are wired in as inputs.

---

# Part VI: Roadmap

## 23. Where this goes next

The 12–24 month roadmap is structured around five priorities. Each is grounded in feedback from the demo conversations rather than speculative feature-building.

**23.1 Methodology deepening (ongoing).** The PD curves, LGD curves, and jurisdiction overlays are the spine. Continued refinement against external auditor feedback and additional historical default data. Specific work in flight: expanding the jurisdiction overlay coverage from current G20 + key aviation jurisdictions to comprehensive global coverage, and adding a second LGD framework for narrowbody-vs-widebody recovery dynamics.

**23.2 Multi-portfolio at scale.** Multi-portfolio scoping is built but the consolidation views (group-level rollups across portfolios owned, managed, securitised) are early. Building out the consolidation surface is a Q1 priority.

**23.3 Configurability deepening.** The platform is architected for configurability but specific surfaces (the Custom Builder, the report templates, the Excel function library) need their configuration surfaces matured. Treating configuration UX as a first-class design problem rather than a settings page.

**23.4 Excel add-in expansion.** The current function library covers portfolio, lessee, lease, aircraft, ECL, scenario, and FX. Expansion targets: maintenance metrics, cash recon outputs, signal feed (so analysts can write `=AI.NewsCount("Pegasus", 30)` and get the last-30-day news signal count), and the ability to write back to scenarios from Excel.

**23.5 AI signals deepening.** Current implementation: news ingest, entity resolution, portfolio-relevance scoring, watchlist routing. Targets: operational signal extraction (parsing schedule data for capacity reductions), pre-distress pattern detection (flagging the cluster of operational and financial signals that historically precede default), and counterfactual analysis (run the same scenarios against a hypothetical portfolio with this counterparty downgraded one notch).

**23.6 Customer engagements.** Three to five paid pilots within twelve months, designed as deep methodology engagements rather than light "try the trial" deployments. The first pilot is the one that turns this document into a case study.

**Honest gaps acknowledged.**
- No regulator-engagement track record. The platform is built to regulator-grade standards but has not been through a regulatory audit. Until it has, regulatory acceptance is unproven, not asserted.
- No customer-funded methodology calibration. The PD/LGD curves are calibrated against reference points; in-customer calibration against a real default history sharpens them.
- No integration with the major aviation accounting systems (LeasePro, Lessor Plus). Wired-in integrations are a serious investment; current strategy is Excel ingest until the volume justifies bespoke integrations.

---

# Part VII: About the builder

**Hi, I'm Tanam Sethi.**

I built AeroInsights single-handedly from scratch: a complete aviation finance intelligence platform purpose-built for the workflow lessors, financiers, and advisors actually use every day.

## Why I built this

### Aviation finance deserved better than a stack of spreadsheets.

I started AeroInsights after spending time inside aviation finance teams and noticing the same pattern everywhere: brilliant analysts spending the bulk of their week fighting fragmented spreadsheets, version-control nightmares, and disconnected models, instead of doing real analytical work.

The industry runs on aircraft worth tens of millions, leases that span decades, and credit decisions that move billions, yet the tooling underneath was, in most firms, brittle and bespoke. It didn't take long to convince myself a purpose-built decision-intelligence platform would change how the work feels day to day.

So I built it. From the IFRS 9 ECL engine to the scenario builder, the deal generator, the AI lessee radar, and the live Excel add-in: every module is written from scratch around how aviation finance teams actually operate, not grafted onto a generic SaaS shell.

Along the way, I've been lucky to sit with executives at **Aerfin**, **ELFC**, and **Grant Thornton's aviation team**, whose feedback shaped the risk frameworks and assumptions baked into the platform today. The demo conversations were long, often 30–60 minutes of whiteboarding edge cases, and every one of them sharpened the product.

If any part of this is useful to talk through, contact details are at the top of this document.

---

# Appendix: Methodology notes

The platform's methodology is documented in code (`api/risk-engine/`, `supabase/migrations/`) and in the in-app methodology surfaces. The notes below are a compact reference for evaluators.

## A. IFRS 9 staging

The three-stage classification model:

- **Stage 1 (S1):** Performing, no significant increase in credit risk since origination. 12-month ECL.
- **Stage 2 (S2):** Significant increase in credit risk since origination, not yet credit-impaired. Lifetime ECL.
- **Stage 3 (S3):** Credit-impaired. Lifetime ECL, with interest revenue on net carrying amount.

**SICR triggers** (configurable per segment via `sicr_config`):
- PD multiple breach: current 12-month PD exceeds origination 12-month PD by configured multiple (default 2x).
- 30+ days past due (rebuttable presumption per IFRS 9 5.5.11).
- Restructure indicator: any forbearance or restructuring activity in trailing 12 months.
- Manual override: analyst-initiated migration with required reason captured in `stage_migrations.reason`.

**Cure / restoration logic.** Restoration from S2 to S1 requires the original SICR trigger to no longer be active for a configurable cure period (default 6 months). S3 to S2 requires explicit analyst review.

## B. PD curve construction

Aviation PD curves (`aviation_pd_curves`) are organised by:
- **Rating bucket:** internal rating mapped to the standard scale.
- **Cohort year:** origination cohort, so vintage effects are observable.
- **Asset class:** narrowbody / widebody / regional / freighter.

**Calibration method.** Curves calibrated against published aviation default and recovery data (rating agency studies, IATA financial disclosures, public lessor disclosures), with adjustment for the calibrating cohort's macro context. Re-calibration is a deliberate event with a logged rationale.

**Lifetime PD.** Lifetime PD for S2 positions is computed by running the marginal PD path out to lease maturity, with macro overlays from the active scenario applied at each future period.

## C. LGD framework

Base LGD (`lgd_curves`) is asset-class and aircraft-generation specific:
- **Recovery component:** projected asset value at default × marketability factor × repossession cost factor.
- **Security component:** SD balance + MR adequacy contribution.
- **Time-to-recovery:** jurisdiction-dependent.

**Jurisdiction LGD overlay** (`jurisdiction_lgd_overlays`) is a multiplier on base LGD reflecting:
- CTC adoption and protocol participation.
- Insolvency regime classification.
- Historical repossession track record.
- Sanctions / political risk.
- IDERA enforceability.

Overlays managed as user-editable reference data with full audit. Default overlays seeded from public jurisdiction analyses; user override expected.

## D. Scenario engine

A scenario is a parameter set. The parameter dimensions:
- Macro overlays: GDP path, fuel price path, FX paths, interest rate paths.
- Counterparty overlays: downgrade matrix by current rating, cluster default triggers.
- Per-lessee overrides: manual stage, manual PD multiplier.
- Per-aircraft overrides: value haircut, MR write-down.
- Jurisdiction LGD overlay deltas.

**Run.** A scenario run snapshots the live portfolio, applies the parameter set, runs the ECL engine, and writes the full input + output to `scenario_runs`. Runs are immutable; re-running with the same scenario produces a new run row (with the same scenario reference but a new snapshot).

## E. ECL waterfall computation

Period-over-period ECL movement decomposed by sequential allocation. Order of attribution (this matters):
1. **Composition:** change driven purely by new origination and runoff, holding methodology constant.
2. **Stage migration:** change driven by S1↔S2↔S3 movement.
3. **PD change:** change driven by PD curve recalibration or per-position PD update.
4. **LGD change:** change driven by base LGD update or jurisdiction overlay update.
5. **EAD change:** change driven by exposure change (drawdowns, prepayments, rent escalation).
6. **Model parameter change:** discount rate, period definition, scope changes.
7. **FX impact:** currency translation effect.

The sum of these reconciles exactly to opening ECL → closing ECL. Each component is drill-down-able to the per-position contribution. Computed once at period close and snapshotted; subsequent reads serve the snapshot.

---

*End of document.*

*This portfolio is a living artefact. Errors, inaccuracies, methodology critiques, and feature gap callouts are explicitly welcome: please send them to sethit@tcd.ie. The platform improves on the strength of those messages.*
