# Product Requirements Document
## Aerinsights — Aviation Lessor Decision Platform

> A decision-support analytics webapp for small-to-medium Irish aircraft lessors covering scenario modelling, IFRS-9 expected credit loss, jurisdictional repossession analysis, and lease-restructuring simulation.

---

### 0. Document Control

| Field | Value |
|---|---|
| Product name | Aerinsights |
| Document version | v0.3 (pricing minimum revised; AppFlow companion document drafted) |
| Status | DRAFT — pending sample gate (§15.1) |
| Date | 29 April 2026 |
| Owner | Product Manager (TBD) |
| Approvers | CEO, Engineering Lead, Aviation SME advisor |
| Companion documents | (to be created in this order) AppFlow.md → TechStack.md → BackendSchema.md → ImplementationPlan.md → ModelGovernance.md → AuditTrailSpec.md → RegulatoryMapping.md → DataLicensingRegister.md |
| Source research | `Fleet_Analytics_Research_Report_v1.md` (this PRD references that document — does not duplicate it) |
| Change log | §18 |

**Reading guide.** Sections 1–6 are strategic; sections 7–12 are the binding requirements engineering will build against; sections 13–18 are governance and admin. Anything marked **[BINDING]** is a hard requirement. Anything marked **[GUIDING]** is a strong default that may be revised with sign-off.

---

### 1. Executive Summary

Aerinsights is a SaaS analytics platform for Irish-domiciled small-to-medium aircraft lessors (10–150 aircraft fleets). It answers four questions that no incumbent vendor (Ishka, IBA, Cirium, Avitas, ICF) integrates today:

1. **What is my expected loss under stress?** — IFRS 9 ECL with multi-scenario probability weighting and IAS 36 recoverable-amount impairment, exportable as an auditor-defensible evidence pack.
2. **What happens if I have to take the aircraft back?** — Jurisdiction-specific repossession timelines and costs, fed by the AWG Cape Town Compliance Index and a curated precedent database.
3. **What's the best response if a lessee asks for relief?** — Side-by-side simulation of restructuring options (PBH conversion, deferral, term extension, forgiveness) versus termination.
4. **Which lessees should I be worrying about right now?** — Watchlist combining payment behaviour, schedule cancellations, ratings drift, and sovereign signals.

**MVP scope.** 12 features delivered in 6–7 months by a 5-FTE team (~€600k–€900k to pilot-ready). Free/open data feeds at MVP; clean adapter layer for Cirium/IBA/Avitas at Phase 2. Synthetic demo dataset at MVP — not a constraint, a deliberate choice that lets us ship before paid data contracts close.

**Strategic positioning.** "Ishka tells you what *is*. Aerinsights tells you what *could happen*, what it *costs*, and how to *defend the number to your auditor.*"

**Pricing model.** Tiered enterprise pricing: a base platform fee covering 3 seats plus per-additional-seat overage. No free tier; selective 30-day trials offered to qualified prospects. Specific price points to be determined from pilot data — internal target band: base platform €25–50k/yr (includes 3 seats), additional seats €4–8k/yr each.

**Methodology stance.** Modelling methodology released under Apache-2.0 license once stable (Phase 2). Outputs and product remain proprietary; methodology transparency accelerates auditor and regulator trust.

---

### 2. Vision and Strategic Context

**Vision.** Become the default decision-support layer for the SME aviation lessor segment — the tool that every Head of Risk opens before a covenant test, every Controller opens at month-end close, and every Commercial Lead opens before a restructuring negotiation.

**Problem statement.** Small-to-medium Irish lessors operate in a market that demands quantitative answers to "what if" questions (auditors under IFRS 9 multi-scenario guidance; boards post-Russia 2022 and Go First 2023; lenders requiring stressed cashflows). They cannot afford a full Cirium + IBA + Ishka stack (€150k–€500k+ per year combined), and even those tools deliver *data*, not *modelled decisions*. The current state is Excel models maintained by one or two senior staff, with no audit trail, no consistency between teams, and no ability to re-run yesterday's analysis under today's data.

**Solution thesis.** Build a focused decision engine — not another data terminal — that consumes the lessor's own lease data plus free public macro/legal/sanctions feeds, runs deterministic and stochastic scenarios against it, and produces accounting-grade, auditor-defensible outputs. Ship the modelling integration that incumbents don't offer; consume their data via adapters once economically viable.

**Why now.**
- IFRS 9 multi-scenario probability-weighted ECL is now established practice; auditors increasingly reject single-point estimates.
- Cape Town enforceability is *quantified* (AWG Compliance Index live; Enforceability Index launched 2025).
- Recent shocks (Russia 2022, Go First 2023, NAC 2021–22, Avianca/LATAM/Aeroméxico Chapter 11s, Azul 2025) have made boards demand modelled, not narrative, risk views.
- Cloud + open macro data + modern Python quant libraries make the build cost ~10× lower than five years ago.

**Strategic non-goals.** We are not building (a) another fleet/values data terminal — incumbents win on data depth; (b) airline-side analytics; (c) ABS structuring tools (Phase 3 at earliest); (d) a sustainability platform.

---

### 3. Target Users and Personas

**Customer profile.** Irish-domiciled aircraft operating lessors with 10–150 aircraft, typically 8–60 staff, often bank-owned subsidiaries or PE-backed platforms. Examples of the segment shape: ABL Aviation, ACIA Aero Leasing, Sky Leasing, Falko Regional, Merx Aviation, ELFC, Stratos, AviaAM, ORIX Aviation. Out-of-scope at MVP but TAM-relevant: top-tier lessors (AerCap, SMBC AC, Avolon — they build in-house), banks doing aviation lending, ABS issuers.

#### 3.1 Personas (six)

**P1 — CEO / Owner-Manager.** Cares about portfolio NPV, capital deployment, covenant headroom, lender reporting. Logs in weekly. Top JTBD: "Show me my book under three scenarios in one screen so I can answer the board."

**P2 — Head of Risk.** Owns watchlist, ECL stage migrations, stress test pack, regulatory capital posture. Logs in daily. Top JTBD: "Tell me which 3 lessees moved this week and why" and "Run the COVID-mild scenario across the book before Friday's risk committee."

**P3 — Head of Accounting / Finance Controller.** Owns IFRS 9 ECL number, IAS 36 impairment, IFRS 16 lessor accounting outputs, audit defence. Logs in heavily at month/quarter/half-year close. Top JTBD: "Generate a reconcilable, auditor-defensible ECL number per lease, total to the portfolio, and export the evidence pack."

**P4 — Asset Manager / Technical.** Owns redelivery conditions, MR balances, tear-down vs. extension, technical fleet planning. Logs in 2–3× per week. Top JTBD: "What's my MR exposure if Lessee X defaults next quarter?" and "Should I extend, place, or part-out at lease end?"

**P5 — Commercial / Marketing Lead.** Owns lease pricing, restructuring negotiations, placement strategy. Logs in opportunistically (deal-driven). Top JTBD: "Compare 5 restructuring options against repossession in 10 minutes" and "What rate must I price to clear my IRR target?"

**P6 — Compliance & Legal.** Owns sanctions screening, CTC/IDERA filings, jurisdictional exposure, GDPR. Logs in monthly + on alerts. Top JTBD: "Tell me when CTC status changes in any country I'm exposed to" and "Confirm no lessee is sanctioned today."

#### 3.2 Anti-personas (explicitly not designing for, MVP)
- Auditors as direct users (they consume our output via lessor-exported packs, not log in).
- Investors / LPs (consume reports the lessor generates).
- Airline finance teams (different product entirely).

---

### 4. Goals and Success Metrics

#### 4.1 Business goals (12-month)
- **B1.** Sign 3 paying pilots within 8 months of build start.
- **B2.** Convert ≥50% of pilots to annual contracts.
- **B3.** Reach €500k ARR within 18 months of build start.
- **B4.** Validate adapter economics: ≥1 pilot uses Cirium adapter at GA.

#### 4.2 Product goals
- **P1.** Time from raw lease upload to first decision-grade output: P50 ≤ 15 minutes.
- **P2.** Re-run any historical scenario reproducibly to the cent (immutable run records).
- **P3.** ≥70% auditor-pack acceptance without follow-up data request in pilot dry runs.
- **P4.** Ship 12 MVP features with zero critical-severity defects at pilot start.

#### 4.3 North star metric
**Auditable Decisions Produced per Active Lessor per Month** (a "decision" = a scenario run, ECL run, or restructuring simulation that is exported or referenced in workflow). Target at GA: ≥30 per active customer per month.

#### 4.4 Tier-1 KPIs (tracked from week one of pilot)
- Activation: % of new tenants completing first scenario run within 7 days of onboarding.
- Time-to-insight: median minutes from portfolio upload to first scenario output.
- Weekly active lessors / paying lessors (engagement).
- Pilot-to-paid conversion rate.

#### 4.5 Tier-2 KPIs
- ECL model calibration error: realised loss vs. forecast on 24-month rolling window, target ±20% on aggregate.
- Watchlist precision ≥0.6, recall ≥0.7 vs. lessor's own internal flags.
- NPS (pilot users): ≥30 at GA.
- Auditor-pack acceptance rate (per §4.2 P3).

#### 4.6 Anti-metrics (we will *not* optimise for)
- Total data points ingested (vanity).
- Number of charts on the dashboard (more ≠ better).
- Scenario count run per user per day (could be gaming).
- Page views (irrelevant for analytics tools — depth of use is what matters).

---

### 5. Scope Definition

#### 5.1 MVP scope — 12 features
Reference: `Fleet_Analytics_Research_Report_v1.md` §3 backlog rows F01–F16. The MVP is exactly those rows scoring ≥68 on the rubric. Detailed functional requirements per feature in §7 of this PRD.

| ID | Feature | MoSCoW |
|---|---|---|
| F01 | Scenario Engine | Must |
| F02 | IFRS 9 ECL Module | Must |
| F03 | IAS 36 Impairment | Must |
| F04 | Repossession & Recovery Model | Must |
| F05 | Lessee Behaviour & Cultural Payment Scorer | Should |
| F06 | Lease Restructuring Simulator | Must |
| F07 | Security Deposit & Maintenance Reserve Logic | Must |
| F08 | Market Value & Tear-down Engine | Must |
| F09 | Risk Mitigation Action Simulator | Should |
| F10 | Bankruptcy Scenario Module | Must |
| F11 | Watchlist & Early Warning System | Should |
| F12 | Portfolio Aggregator & Concentration Monitor | Must |
| F13 | Auditor-Grade Explainability Pack | Should |
| F14 | Lease & Payment Database (foundation) | Must |
| F15 | Macro Data Ingestion (WB / IMF / ECB / EUROCONTROL) | Must |
| F16 | Cape Town / AWG Index Integration | Should |

(F13–F16 are infrastructure, not separate user-facing tabs; numbered for traceability.)

#### 5.2 Phase 2 scope (months 7–12 post-MVP)
- F17 Sanctions Screening (OFAC/EU/UK/UN)
- F20 What-if Lease Pricing (target-IRR reverse engineering)
- F21 Engine Tear-down Calculator
- F22 Counterparty Concentration Limits & Board-policy checks
- Cirium / IBA / Avitas adapter activation
- Multi-tenant SSO
- API access for downstream BI

#### 5.3 Phase 3 scope (months 13+)
- F18 Sustainability / CO₂ overlay
- F19 ABS / Capital Markets pack
- F23 Top-down 20-year Fleet Forecast Sandbox
- Mobile app (read-only watchlist + alerts)
- Collaborative deal-room features

#### 5.4 Explicitly out of scope (forever, or until strategic re-evaluation)
- Airline-side commercial analytics.
- Aircraft trading marketplace functionality.
- Real-time aircraft tracking (ADS-B).
- General-aviation / business-jet / helicopter analytics.
- Manufacturer-side production planning.
- Maintenance shop / MRO operations management.

#### 5.5 Geographic scope
- **Customer geography (MVP):** Irish-domiciled lessors. Pricing in EUR. Hosted in eu-west-1 (Dublin).
- **Lessee/airline geography (always):** Global. Modelling supports any ICAO state.
- **Phase 2 customer geography:** UK, Channel Islands, Singapore, Middle East lessors.

---

### 6. Design and User Experience Principles

#### 6.1 Visual language [BINDING — locked at v0.2]

The two design references (Knowvio, SkyLift) share useful DNA but differ in tone. Aerinsights extracts the common DNA and anchors in **institutional restraint**:

**Colour system (locked).**
- **Primary accent: Oxford Blue `#002147`** — used for primary actions, active navigation, key data emphasis.
- **Surface: White `#FFFFFF`** primary background; off-white `#FAFAFA` for elevated cards; pale grey `#F4F5F7` for inset/secondary panels.
- **Neutrals: Slate scale** — `#0F172A` (text primary), `#475569` (text secondary), `#94A3B8` (text tertiary), `#E2E8F0` (borders / dividers).
- **Semantic:** Green `#15803D` (OK / Stage 1 / improvement), Amber `#B45309` (watch / Stage 2 / caution), Red `#B91C1C` (Stage 3 / breach / sanctioned). Semantic colours used sparingly and never decoratively.
- **Charts:** Oxford blue as primary series; secondary palette in muted complements (slate, warm grey, deep teal `#0F4C5C`). No rainbow gradients. No neon.
- **Dark mode:** Phase 2, not MVP. Design tokens structured to enable later.

**Layout and elevation.**
- **Light theme primary**, structured around card-based modular layouts.
- **Subtle elevation only**: max 4px blur, 2px y-offset, 6% opacity shadows. No drop-shadows on hover unless interactive.
- **Generous whitespace** — information density via typography hierarchy, not by packing pixels.
- **8-point spacing grid**.

**Typography.**
- **Sans-serif**: Inter (or Manrope as fallback) at 14px base body, 13px tabular cells, 12px small/labels, 16/20/24/32px heading scale.
- **Numerics in tabular variants** for column alignment in financial tables — non-negotiable. Tabular figures across the entire product.
- **No italics for emphasis** — use weight (500/600) instead. Italics reserved for citations and metadata.

**Patterns inherited from the design references.**
- **KPI strip pattern** (top-of-screen 4–6 KPI tiles with sparkline + delta pill).
- **Status pills** for stage / watchlist / scenario / sanction status — small, semantic-coloured, never animated.
- **Card-based information density** — Knowvio's clean card grid is the right reference; SkyLift's hero 3D illustration is wrong for this audience.

**Explicitly rejected.**
- **No 3D illustrations**, no glassmorphism backgrounds, no hero images. The product is for people validating €100m+ accounting numbers; visual gimmicks erode trust.
- **No emoji in product UI**. (Allowed in marketing.)
- **No animated transitions over 200ms** on data screens — analytical tools shouldn't feel "fun."
- **No gamification**, badges, streaks, completion percentages.

#### 6.2 UX principles [BINDING]
- **Decision over data.** Every screen leads with the conclusion (number, recommendation, alert), with supporting data drillable underneath. Never a wall of tables as the primary view.
- **Reproducibility by default.** Every output is timestamped, scenario-stamped, and reproducible from stored inputs. No "live, ephemeral" calculations that can't be retrieved exactly tomorrow.
- **Show your work.** Every model output exposes the inputs, weights, and intermediate steps via a "Show calculation" affordance. Auditors and Heads of Risk both demand this; designing for it from day one is non-negotiable.
- **Two paths through every workflow.** A *guided* path (wizard, defaults, checklist) for occasional users, and a *power* path (forms, batch, API) for daily users. Same outputs.
- **No surprise costs.** If a feature triggers a paid data call (Phase 2+), the user is shown cost before commit.
- **Confidence visible everywhere.** No naked point estimates without a band, range, or stated assumption set. Single-number outputs are an audit failure mode.

#### 6.3 Information architecture (top-level navigation, MVP)
1. **Dashboard** — KPI strip + watchlist headlines + last 5 scenario runs.
2. **Portfolio** — leases / aircraft / lessees tables with filters and concentration views.
3. **Scenarios** — library, custom builder, run history.
4. **Risk & ECL** — staging matrix, ECL by lease, IAS 36 impairment workspace.
5. **Counterparties** — lessee profiles, behaviour scores, restructuring sim entry point.
6. **Jurisdictions** — country profiles, CTC scores, repossession models.
7. **Reports** — exports, auditor packs, board-pack templates.
8. **Settings** — tenant, users, data sources, model parameters, audit log.

#### 6.4 Accessibility [BINDING]
- WCAG 2.2 AA target at GA. AA audit of pilot screens before pilot start.
- Keyboard-navigable everywhere; no mouse-only interactions.
- Colour never the sole carrier of meaning (status pills always include text labels).
- Tabular numerics readable in 200% zoom.

#### 6.5 Internationalisation
- English-only at MVP and Phase 2. Strings still externalised to enable future localisation.
- Currency: USD as the modelling base currency (industry standard for lease economics); EUR for pricing/billing/contracts; lessee local currency captured but converted for analytics.
- Dates: ISO 8601 (YYYY-MM-DD) in all exports; locale-friendly display formatting in UI.

#### 6.6 Browser support [BINDING]
Latest 2 versions of Chrome, Edge, Safari, Firefox. No IE / no Chromium <100. Mobile browsers: read-only views render; full editing not supported at MVP.

---

### 7. Functional Requirements

Each requirement is numbered `FR-{Feature}-{nnn}` and categorised Must / Should / Could. Acceptance criteria are testable. References to research-deliverable feature specs (e.g., "see RR §4.1") to avoid duplication.

#### 7.1 F01 Scenario Engine — see Research Report §4.1

- **FR-F01-001 [Must]** The system shall provide a scenario library containing at minimum 6 pre-built templates: Baseline, COVID-Mild, COVID-Severe, Fuel Spike (Brent +60% sustained 18m), Sovereign Stress (single country), Currency Collapse (multi-country EM basket), Russia-Style Expropriation. *Acceptance:* All templates listed in `/scenarios/library` endpoint and runnable end-to-end on the synthetic demo portfolio.
- **FR-F01-002 [Must]** The system shall support custom scenario definition via JSON/YAML DSL covering shocks to GDP, traffic (RPK), fuel, FX, interest rates, asset values, lessee PD overrides, and jurisdiction-status overrides. *Acceptance:* A scenario submitted via API matching the published JSON Schema runs to completion; invalid scenarios return structured validation errors.
- **FR-F01-003 [Must]** The system shall support deterministic and Monte Carlo modes. Monte Carlo default: 10,000 antithetic paths; configurable to 100,000. *Acceptance:* Results from N=10,000 are stable to ±0.5% on portfolio ECL across re-runs with same seed.
- **FR-F01-004 [Must]** The system shall persist every run as immutable `ModelRun` records with stored seed, scenario hash, and portfolio snapshot ID. *Acceptance:* A historical run can be re-fetched by ID and reconciles to the cent against original output.
- **FR-F01-005 [Must]** Performance: deterministic mode <5 s per 100 leases; Monte Carlo (10,000 paths) <60 s per 100 leases on standard 8-vCPU/32GB worker. *Acceptance:* Benchmark CI test runs nightly, fails build on regression.
- **FR-F01-006 [Should]** The system shall expose per-driver Shapley contribution attribution on the run summary. *Acceptance:* For any run, top 5 drivers reported with relative contribution summing to 100% ±5%.
- **FR-F01-007 [Should]** Auto-generated narrative summary of run outcome (LLM-assisted) limited to factual restatement of numerics — never invents inputs. *Acceptance:* LLM prompts never include free-text fields from lessor data; outputs are validated against numerical run results before display.

#### 7.2 F02 IFRS 9 ECL Module — see Research Report §4.2

- **FR-F02-001 [Must]** The system shall compute three-stage IFRS 9 ECL per lease with configurable SICR triggers (default: 30 dpd backstop, ≥2-notch credit downgrade, country-watchlist event, lessee insolvency filing).
- **FR-F02-002 [Must]** ECL shall be probability-weighted across at least 3 scenarios per IFRS 9 ITG guidance. Weights tenant-configurable, default 60/25/15 (base/down/up).
- **FR-F02-003 [Must]** Stage migration matrix (period-on-period) shall be reportable at portfolio and segment level with reasons for each migration.
- **FR-F02-004 [Must]** Outputs shall include PD term structure, LGD, EAD, ECL 12-month, ECL lifetime, and journal-entry stub per lease.
- **FR-F02-005 [Must]** Recalculation shall be reproducible to the cent given identical inputs. *Acceptance:* Re-running the same as-of date with the same scenario set returns byte-identical numerical outputs.
- **FR-F02-006 [Should]** ASC 842 / ASC 326 (CECL) outputs shall be available for US-reporting customers. *MVP scope: Phase 2 unless first pilot demands.*
- **FR-F02-007 [Must]** Sensitivity tornado chart on top 5 inputs available per lease and per portfolio.

#### 7.3 F03 IAS 36 Impairment

- **FR-F03-001 [Must]** Recoverable amount = max(FVLCD, VIU) computed per aircraft on demand and at period-close.
- **FR-F03-002 [Must]** VIU calculation supports user-configurable discount rate (default lessee-risk-adjusted WACC), contractual cashflows from lease, and expected residual.
- **FR-F03-003 [Must]** Impairment loss recognised when carrying > recoverable; reversal logic supported within IAS 36 limits.
- **FR-F03-004 [Must]** Auditor evidence pack export (PDF + JSON) for any impairment calculation, including all inputs, formulas, and source data hashes.

#### 7.4 F04 Repossession & Recovery — see Research Report §4.3

- **FR-F04-001 [Must]** Per-jurisdiction profile shall include: CTC party flag, CTC compliance score, Alt-A in force flag, IDERA recognised flag, enforceability score, rule-of-law index, sanctions status, last update timestamp.
- **FR-F04-002 [Must]** Coverage at GA: ≥80 CTC contracting states + ≥30 non-CTC states + 6 hand-curated priority jurisdictions (Russia, Iran, Venezuela, Lebanon, Pakistan, Argentina).
- **FR-F04-003 [Must]** Per-jurisdiction model output: P50 and P90 timeline (months), P50 and P90 cost (% of asset value), success probability.
- **FR-F04-004 [Must]** Curated precedent database surfaceable per country with at minimum: case ID, year, lessor, airline, aircraft count, timeline, outcome, public source URL.
- **FR-F04-005 [Should]** Scenario-conditional override: model recognises that timelines lengthen materially under systemic stress and adjusts conditional on scenario.
- **FR-F04-006 [Must]** AWG CTC Index updated semi-annually + on event-driven watchlist notice; system shall alert tenants to material score changes affecting their portfolio.

#### 7.5 F05 Lessee Behaviour & Cultural Payment Scorer — see Research Report §4.4

- **FR-F05-001 [Should]** Each lessee shall receive a behaviour score 0–100 with sub-scores for: payment punctuality, restructuring cooperation, government-interference likelihood, litigation propensity.
- **FR-F05-002 [Should]** Score updated monthly from internal payment history; quarterly from precedent/macro data.
- **FR-F05-003 [Should]** Each sub-score shall be explainable with itemised evidence list.
- **FR-F05-004 [Must]** Modelling and language must be defensible and non-discriminatory: score framed as "observed contractual-performance indicator under stress" — country-level proxies must be empirical (e.g., government interference observed in restructurings), not cultural stereotypes. *Legal sign-off required before pilot.*

#### 7.6 F06 Lease Restructuring Simulator — see Research Report §4.5

- **FR-F06-001 [Must]** Built-in restructuring templates: Payment Holiday, Deferral with Catch-up, Forgiveness, PBH conversion, Term Extension, Rate Reduction, Hybrid.
- **FR-F06-002 [Must]** Side-by-side comparison shall produce: NPV-to-lessor, IRR, ECL, P95 downside, time-to-recovery for each option vs. termination scenario.
- **FR-F06-003 [Must]** Counterfactual ("what if lessee defaults anyway after we agree?") produced automatically for each option.
- **FR-F06-004 [Should]** Term-sheet draft (PDF/DOCX) generation from selected restructuring option.

#### 7.7 F07 Security Deposit & MR Logic — see Research Report §4.6

- **FR-F07-001 [Must]** Per-lease SD records: type (cash / LC), amount, currency, refund triggers, governing-law clause reference.
- **FR-F07-002 [Must]** Per-lease MR records by component (airframe HSI, engine PR, LLPs, landing gear, APU): rate basis ($/FH or $/cycle), refundability flag, cap rule, cumulative balance ledger.
- **FR-F07-003 [Must]** Refund cap enforcement: `refund_t = min(MR_paid_net_of_refunds, evidenced_maint_cost_t)` per IATA IAWG guidance.
- **FR-F07-004 [Must]** End-of-lease cash compensation logic configurable for half-life and full-life return conditions.
- **FR-F07-005 [Must]** SD and MR offsets feed correctly into LGD calculation in F02.

#### 7.8 F08 Market Value & Tear-down Engine — see Research Report §4.7

- **FR-F08-001 [Must]** Outputs per asset: half-life base value, current market value, maintenance-adjusted value, lease-encumbered value, part-out value.
- **FR-F08-002 [Must]** All values shall display source tag (heuristic / Avitas BlueBook desk-keyed / Cirium adapter / IBA adapter / user-overridden) and uncertainty band.
- **FR-F08-003 [Must]** Pluggable provider architecture: swapping data source from heuristic to Cirium/IBA is a configuration change, not a code change.
- **FR-F08-004 [Should]** Part-out value computed from component-value × recovery-factor minus tear-down cost.

#### 7.9 F09 Risk Mitigation Action Simulator — see Research Report §4.8
- **FR-F09-001 [Should]** Quantify marginal ECL reduction, marginal expected recovery, and capital cost of: parent guarantee, additional security, cross-default acceleration, step-in rights, sub-lease consent withholding, insurance trigger.
- **FR-F09-002 [Should]** Net-benefit comparison across mitigation options.

#### 7.10 F10 Bankruptcy Scenario Module — see Research Report §4.9

- **FR-F10-001 [Must]** Insolvency-regime templates for at minimum: US Chapter 11 (with §1110 / §365), India IBC (with new CTC Act 2025), Brazil RJ, Mexico Concurso, Indonesia PKPU, generic civil-law liquidation.
- **FR-F10-002 [Must]** Each regime template includes: typical stay duration, cure window for aircraft, executory-contract rejection rules, lessor priority, observed recovery timeline distribution, observed haircut distribution.
- **FR-F10-003 [Must]** Branching simulation: P(restructure | filing), P(lease assumed | restructure), P(rejected | restructure), conditional haircut distributions calibrated to precedent database.

#### 7.11 F11 Watchlist & Early Warning System — see Research Report §4.10

- **FR-F11-001 [Should]** Per-lessee status (Green / Amber / Red) computed daily from configurable rule-set.
- **FR-F11-002 [Should]** Default signals: payment-lateness trend, schedule cancellations, ratings changes, sovereign CDS widening (if licensed feed available), AWG CTC watchlist notices, news-keyword detector.
- **FR-F11-003 [Should]** Each status change generates an audit-logged event with evidence. Alerts configurable per user (in-app + email).

#### 7.12 F12 Portfolio Aggregator — see Research Report (backlog row F12)

- **FR-F12-001 [Must]** Concentration views by lessee, country, region, aircraft type, vintage, lessee currency.
- **FR-F12-002 [Must]** Aggregate KPIs: book value, encumbered value, expected loss, ECL, weighted-average lease term, weighted-average lessee credit.
- **FR-F12-003 [Should]** User-configurable concentration policy thresholds with breach indicators (Phase 2 enforcement workflow).

#### 7.13 Cross-cutting requirements (apply to all features)

- **FR-X-001 [Must]** Authentication via OAuth2 (Auth0 or equivalent). MFA mandatory for all user accounts.
- **FR-X-002 [Must]** Authorisation: role-based access control (RBAC) with at minimum 4 roles: Admin, Risk, Accounting, Read-only. Tenant-scoped row-level security in database.
- **FR-X-003 [Must]** Audit log: every read/write of lease data, scenario run, and ECL run logged with user, timestamp, action, before/after hash. Logs immutable for 7 years (Irish Companies Act / IFRS audit retention).
- **FR-X-004 [Must]** Data import via CSV/Excel template at MVP. Onboarding template covers Lessee, Lease, Aircraft, Payment, MR, SD entities.
- **FR-X-005 [Must]** Data export: CSV, XLSX, JSON, and per-feature PDF reports. All exports include source data hash and timestamp.
- **FR-X-006 [Should]** Scheduled reports (weekly / monthly / quarterly) per persona.
- **FR-X-007 [Must]** Email notifications for: scenario completion, watchlist status change, scheduled report delivery. No SMS at MVP.
- **FR-X-008 [Must]** Tenant data isolation: zero cross-tenant data access; verified by penetration test before pilot.
- **FR-X-009 [Should]** Public REST API with OpenAPI 3.1 spec for downstream integrations. Rate-limited, authenticated. *Phase 2 for general availability; pilot tenants get internal-use API.*
- **FR-X-010 [Must]** Search across portfolio: by aircraft MSN, registration, lessee name, lease ID. Sub-second response.

---

### 8. Non-Functional Requirements

- **NFR-001 Performance.** Page p95 load <2.5 s. Scenario run latency: see FR-F01-005. Dashboard initial paint <1.5 s.
- **NFR-002 Scalability.** Support 100 tenants × 200 leases each at MVP architecture without re-architecture. Burst: 50 concurrent scenario runs.
- **NFR-003 Availability.** 99.5% monthly uptime SLA at pilot; 99.9% at GA. Scheduled-maintenance windows excluded with ≥48 h notice.
- **NFR-004 Disaster recovery.** RPO ≤ 1 hour; RTO ≤ 4 hours. Backups encrypted, geo-redundant within EU.
- **NFR-005 Security.** Encryption at rest (AES-256, AWS KMS or equivalent); TLS 1.3 in transit. Annual penetration test from GA. SOC 2 Type II target by 18 months post-GA.
- **NFR-006 Privacy / GDPR.** EU-only data residency (eu-west-1 Dublin). DPIA completed before pilot. Sub-processor list maintained and notified to tenants on change. Right-to-erasure for personal contact data within lease records (lessee corporate data is *not* personal data; lessee employee contacts are).
- **NFR-007 Compliance — accounting.** Outputs aligned to IFRS 9, IAS 36, IFRS 16 (lessor); ASC 842 / 326 supported but Phase 2. Methodology white paper published per major version.
- **NFR-008 Compliance — Irish.** Operates within Section 110 / 12.5% trading-corp regime context but does not provide tax advice. Records retention 7 years.
- **NFR-009 Auditability.** All numerical outputs traceable to inputs via stored evidence packs. Model versioning explicit; downgraded models accessible for prior-period restatement.
- **NFR-010 Model governance.** Each model (PD, LGD, EAD, market value, repossession, behaviour) has a model card with: purpose, inputs, methodology, validation results, known limitations, owner, last-validated date. Quarterly back-test reports.
- **NFR-011 Explainability.** Every output reachable from a "Show calculation" affordance exposing inputs, weights, intermediate steps. LLM narrative auxiliary only — never source-of-truth.
- **NFR-012 Reproducibility.** Any historical model run reproducible to the cent given stored seed and inputs. CI test enforces.
- **NFR-013 Observability.** Application logging (structured JSON, no PII), metrics (Prometheus-compatible), distributed tracing (OpenTelemetry). On-call runbook per service.
- **NFR-014 Cost.** Infrastructure cost <€10k/month at MVP scale (50 tenants × 50 leases avg). Linear scaling thereafter.
- **NFR-015 Vendor lock-in.** No critical-path dependency on a single vendor that cannot be replaced within 90 days. Particularly: object storage, compute, identity, email — all behind abstraction layers.

---

### 9. Data Requirements

#### 9.1 Internal data (provided by tenant)
Lessees, Leases, Aircraft, Payment History, MR ledgers, SD records, manual lessee credit overrides. See Research Report §7.4 for SQL schema; companion `BackendSchema.md` will be the authoritative version.

#### 9.2 External data feeds
See Research Report §6 catalogue. MVP cadence summary:

| Feed | MVP source | Cadence | Phase 2 upgrade |
|---|---|---|---|
| Macro time series | World Bank WDI, IMF WEO/IFS, ECB SDW, FRED | Monthly | Bloomberg/Refinitiv if pilot demands |
| Air traffic | EUROCONTROL Performance Review, IATA public, BTS T-100 | Monthly | OAG |
| Fuel | EIA + ICE Brent | Daily | Platts Jet differential |
| Sovereign / governance | World Bank WGI, OECD risk classification | Annual | CDS via Refinitiv |
| Cape Town | AWG CTC Compliance Index + Enforceability Index | Semi-annual + watchlist | Same (no upgrade needed) |
| Sanctions | OFAC SDN, EU consolidated, UK OFSI, UN | Daily | Same |
| Aircraft values | Hand-keyed Avitas BlueBook for pilot portfolios + heuristic regression | One-time + monthly | Cirium / IBA / Avitas adapter |
| Aircraft technical | Planespotters / ch-aviation free tier | Daily | Cirium Fleets |
| Airline credit | Public press releases scraping (where licensed) + manual override | Ad-hoc | Cirium / IBA / Ishka adapter |

#### 9.3 Synthetic demo dataset (MVP requirement)
- 25 fictional lessees across 12 jurisdictions (mix of CTC-strong, CTC-weak, non-CTC).
- 50 fictional leases on 50 fictional aircraft (mix of A320/B737/A330/B787/A350/Q400).
- 36 months of synthetic payment history with realistic delinquency distributions.
- Realistic SD/MR balances per IATA IAWG component approach.
- Hand-crafted to exercise every modelling code path including edge cases.
- Versioned in a git repo; never mutates within a release.

#### 9.4 Data licensing register [BINDING — separate doc]
A `DataLicensingRegister.md` companion document shall enumerate every external data source with: licence type, redistribution rights, attribution requirements, cost band, renewal date, fallback provider. Updated on every new source addition.

---

### 10. Integration Requirements

- **INT-001** Data ingestion connectors built on Airbyte / Meltano (open-source) for free public sources. Custom adapters for paid feeds (Cirium, IBA, etc.) at Phase 2.
- **INT-002** Identity provider: Auth0 (or AWS Cognito) at MVP. SAML SSO at Phase 2 for enterprise pilots.
- **INT-003** Email: Postmark or SES; transactional only at MVP.
- **INT-004** Storage: AWS S3 (eu-west-1), with object-versioning enabled and lifecycle to Glacier for >18-month-old run blobs.
- **INT-005** Compute: AWS EKS for application services; AWS Batch / Fargate for scenario worker scaling.
- **INT-006** LLM provider for narrative summaries: **Azure OpenAI Service (EU region — West Europe)**. Region-locked. Microsoft accepted as sub-processor; pilot tenants notified at onboarding. Never used for numerical computation. Fallback provider: Anthropic Claude API (EU region) if Azure capacity / pricing diverges materially.
- **INT-007** Export integrations: PDF generation server-side (WeasyPrint / Chrome-headless); XLSX via openpyxl; DOCX via python-docx.
- **INT-008** Webhook-out for tenant integrations at Phase 2 (run completion, watchlist alerts).

---

### 11. Compliance and Regulatory Mapping

| Regulation / Standard | Relevance | MVP Posture | Companion artefact |
|---|---|---|---|
| IFRS 9 Financial Instruments | ECL methodology | Compliant outputs; ITG-aligned multi-scenario | ModelGovernance.md §ECL |
| IAS 36 Impairment | Recoverable-amount test | Compliant outputs | ModelGovernance.md §IAS36 |
| IFRS 16 Leases (lessor) | Maintenance reserve & SD treatment | IATA IAWG-aligned | ModelGovernance.md §MR_SD |
| ASC 842 / 326 | US-reporting customers | Phase 2 | ModelGovernance.md §ASC |
| Cape Town Convention / Aircraft Protocol | Repossession modelling foundation | Integrated via AWG indices | DataLicensingRegister.md |
| EU GDPR | Personal data of lessee employees | DPIA before pilot; EU-only hosting | PrivacyImpactAssessment.md |
| Irish Companies Act | Records retention 7 years | Audit log retention enforced | AuditTrailSpec.md |
| Section 110 (Ireland) | Tenant context only — we don't advise | No product impact; marketing alignment | n/a |
| Central Bank of Ireland (CBI) | Aerinsights itself is *not* a CBI-regulated entity (no regulated financial services provided). Some bank-owned pilot tenants *are* CBI-regulated and will subject Aerinsights to their third-party-risk-management process under the CBI outsourcing framework. | Confirm with Irish counsel in Phase 0; prepare standard third-party assurance pack | SecurityProgram.md + DataLicensingRegister.md |
| OFAC / EU / UK / UN sanctions | Sanctions screening (F17 — Phase 2) | Phase 2 | – |
| EASA airworthiness data | Indirect — feeds technical data | Consume via Cirium adapter Phase 2 | – |
| SOC 2 | Customer security expectation | Type II at +18m post-GA | SecurityProgram.md |

---

### 12. Constraints and Assumptions

#### 12.1 Constraints [BINDING]
- **C1** Team size capped at 5.5 FTE through pilot (per business plan).
- **C2** Time-to-pilotable: 6–7 months from kick-off.
- **C3** Budget to pilot-ready: €600k–€900k all-in.
- **C4** EU data residency mandatory.
- **C5** No proprietary data redistribution: any paid feed we resell requires explicit licence.

#### 12.2 Assumptions
- **A1** Cirium / IBA / Avitas pricing for SME-tier customers is achievable at €60–80k/yr — *to validate in Phase 0 outreach*.
- **A2** AWG CTC Compliance Index licensing accessible at <€25k/yr for our use-case — *to validate*.
- **A3** Pilot lessors will provide ≥24 months payment history per lease — *risk if not*.
- **A4** Big Four firm willing to engage as co-validator on ECL methodology in pilot phase — *to confirm with KPMG and PwC Irish lessor teams*.
- **A5** Synthetic data is acceptable to first pilots for proof — *high confidence given it is demo-only and supplemented by their real data*.

---

### 13. Dependencies

#### 13.1 External
- AWG (CTC Index) licence agreement.
- One Big-Four audit firm advisory engagement (paid, ~€30–50k for methodology blessing).
- One Irish aviation law firm partnership (e.g., A&L Goodbody, Matheson, Dillon Eustace) for jurisdictional updates.
- AWS account approval for eu-west-1 with appropriate quotas.
- Auth0 (or equivalent) commercial agreement.

#### 13.2 Internal
- Aviation SME advisor confirmed and contracted (fractional 0.5 FTE).
- Quant / data scientist hired.
- Data engineering capacity confirmed.

#### 13.3 Critical path
Onboarding flow → synthetic dataset → F14 + F15 (data foundation) → F08 (values) → F02 + F04 (ECL + repo) → F01 (scenario engine pulls them together) → F12 (portfolio rollup) → pilot.

---

### 14. Risks and Mitigation (summary)

Full register in Research Report §9. Top 5 product-level risks:

1. **ECL fails Big-Four challenge.** *Mitigation:* engage advisory pre-pilot; methodology white paper; auditor-pack design from day one.
2. **Cirium / IBA pricing makes adapter uneconomic.** *Mitigation:* MVP works without; tiered pricing passes licence cost through.
3. **Repossession-precedent dataset thin in some jurisdictions.** *Mitigation:* explicit uncertainty bands; user override; partner law firm.
4. **Behaviour-scorer misframed as "cultural", triggers legal/PR issue.** *Mitigation:* legal sign-off; framing as observed contractual-performance indicator (FR-F05-004).
5. **Small TAM (30–50 SME Irish lessors).** *Mitigation:* expand to UK / Singapore / ME in Phase 2; pricing flexibility.

---

### 15. Release Criteria and Acceptance Gates

#### 15.1 Sample Gate (week 6 — per user's "samples first" instruction)
**Pass criteria:**
- [ ] Synthetic 50-lease demo dataset complete and exercising every code path.
- [ ] Scenario Engine running deterministic Baseline + COVID-Mild end-to-end on demo dataset.
- [ ] One polished UI screen (Scenario Result page) demonstrating the visual language.
- [ ] PM, Eng Lead, and Aviation SME advisor sign off in writing.

**If failed:** halt feature build, re-scope, or revisit design language.

#### 15.2 Alpha Gate (week 18)
**Pass criteria:**
- [ ] All 12 MVP features functionally complete (per FR acceptance criteria).
- [ ] Synthetic-data end-to-end demo runs without manual intervention.
- [ ] Audit log functional across all features.
- [ ] Performance NFRs met on synthetic 200-lease portfolio.
- [ ] Internal security review passed.

#### 15.3 Pilot Gate (week 26)
**Pass criteria:**
- [ ] 1–3 pilot lessors signed.
- [ ] Pilot lessor's real data ingested without bespoke engineering.
- [ ] First scenario run on real data within 2 hours of ingestion.
- [ ] DPIA completed; security questionnaire passed.
- [ ] Methodology white paper draft circulated.

#### 15.4 GA Gate (week 52)
**Pass criteria:**
- [ ] ≥1 pilot converted to paying customer.
- [ ] Auditor-pack acceptance ≥70% in pilot dry runs (KPI P3).
- [ ] Penetration test passed.
- [ ] SOC 2 Type I in progress.
- [ ] Methodology white paper published.
- [ ] Run-book for on-call complete.

---

### 16. Acceptance Criteria for v1.0 GA

In addition to gate criteria above:

- All FR-{Must} requirements pass automated acceptance tests.
- All NFR-{NFR} targets met under load.
- Documentation: user manual, API docs, methodology paper, model cards (per model), DPIA, security overview.
- Onboarding playbook tested with at least 2 customers self-serving.
- Support runbook with SLA commitments published.
- Incident-response plan tested via tabletop exercise.

---

### 17. Decisions Log and Remaining Open Questions

#### 17.1 Decisions resolved at v0.2 review (28–29 April 2026)

| Ref | Decision | Resolution | Rationale |
|---|---|---|---|
| D1 | Product name | **Aerinsights** | Stakeholder selection. |
| D2 | Visual accent | **Oxford Blue `#002147` on white** | Stakeholder selection; institutional, defensible against gimmick concerns; full token system locked in §6.1. |
| D3 | Pricing model | **Tiered enterprise: base platform fee covers 3 seats + per-additional-seat overage. No free tier — selective 30-day trial for qualified prospects.** | Free tier was rejected: it produces support cost, GDPR overhead, and brand confusion without producing customers in a B2B aviation finance context. Trial achieves the same "let them try" outcome cleanly. 3-seat minimum reflects SME lessor reality (typical deep users: Risk + Accounting + Asset Mgmt). Specific price points TBD from pilot data. |
| D4 | Cirium adapter strategy | **MVP: customer-supplied flat-file. GA: pursue reseller agreement.** | At MVP, Aerinsights has zero leverage with Cirium; reseller terms would be punitive or refused. Customers who already license Cirium can drop exports into our adapter. By GA, with proven volume, the reseller conversation is winnable. Smaller data-licensing surface during the GDPR-sensitive early period. |
| D5 | Big Four target validator | **KPMG (primary target); PwC backup.** | KPMG audits AerCap, SMBC AC, and the deepest Irish-lessor portfolio. PwC is the strong second. Formal paid engagement deferred to pilot phase. |
| D6 | CBI regulatory scope | **Aerinsights is NOT a CBI-regulated entity. Some bank-owned pilot tenants ARE — they will subject Aerinsights to their third-party-risk-management process.** | Not a blocker; sales-cycle reality. Prepare standard third-party assurance pack in Phase 0. Confirm formally with Irish counsel. |
| D7 | Behaviour-scorer framing | **Proceed with non-discriminatory framing per FR-F05-004 — "observed contractual-performance indicator under stress."** | Avoids discrimination claims. Country-level proxies must be empirical (observed restructuring outcomes, government-interference precedents), never cultural stereotypes. |
| D8 | LLM provider | **Azure OpenAI Service (EU — West Europe).** Microsoft sub-processor accepted; pilot tenants notified at onboarding. Anthropic Claude EU as fallback. | Stakeholder selection. EU-region compliance with GDPR. |
| D9 | AWG CTC Index licensing | **Pursue at standard enterprise/commercial tier, not member tier.** | Aerinsights is a B2B SaaS product, not a member-eligible operator. Standard licensing terms apply. |
| D10 | Methodology open-source | **Methodology released under Apache-2.0 once stable (target: alongside GA).** Outputs and product remain proprietary. | Stakeholder selection. Accelerates auditor and regulator trust. Code under proprietary licence; methodology paper, model cards, and reference algorithms under Apache-2.0. |
| D11 | Phase 2 geographic priority | **Deferred — to revisit pre-GA based on pilot demand signals.** | Stakeholder direction. |
| D12 | Mobile read-only Phase 3 | **Deferred — to revisit post-GA.** | Stakeholder direction. |

#### 17.2 Remaining open questions (must close before specific gates)

| # | Question | Owner | Target close date | Notes |
|---|---|---|---|---|
| OQ1 | Specific MVP pricing numbers (base platform €X covering 3 seats, per-seat overage €Y) | CEO + Head of Sales | Pre-pilot Gate (week 26) | Internal target band: base €25–50k/yr, additional seats €4–8k/yr each. Lock from pilot data. |
| OQ2 | Trial-to-paid conversion flow (gating, length, support included) | PM | Pilot Gate | 30-day default; refine. |
| OQ3 | Synthetic dataset scope sign-off (50 leases? 12 jurisdictions? specific airline archetypes?) | PM + Aviation SME | Sample Gate (week 6) | Critical for first samples — see §15.1. |
| OQ4 | DPIA scope and template | Legal counsel + DPO | Pre-pilot Gate | Required before any real lessor data ingested. |
| OQ5 | Specific data-licensing budget for AWG CTC Index | CEO | Phase 0 (week 4) | Affects MVP feasibility of F16. |
| OQ6 | Penetration-testing vendor selection | Engineering Lead | Pre-pilot Gate | EU-based preferred. |
| OQ7 | Methodology white-paper authorship — internal vs. co-authored with Big Four | CEO | Pre-GA | Co-authored carries more auditor weight. |
| OQ8 | Aviation SME advisor — hire vs. fractional vs. partner-firm engagement | CEO | Phase 0 (week 4) | Shapes whole modelling roadmap. |
| OQ9 | Apache-2.0 release scope — methodology paper only, or reference Python implementations too? | CEO + Engineering Lead | Pre-GA | Reference implementations strengthen trust further but require extra documentation effort. |
| OQ10 | Trial length and gating mechanism (data limits, feature limits, time limits) | PM | Pilot Gate | Replaces former "free tier" question. |

---

### 18. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-04-28 | Claude (drafted for PM) | Initial draft. |
| v0.2 | 2026-04-29 | Claude (post-stakeholder review) | Product named **Aerinsights**. Visual system locked (Oxford Blue `#002147`, full token spec). Pricing model finalised: tiered enterprise (base + per-seat overage), no free tier — selective trials only. Cirium adapter strategy locked (customer-supplied flat-file at MVP, reseller pursued at GA). KPMG named primary Big-Four target. CBI regulatory posture clarified. Azure OpenAI EU locked as LLM provider. Apache-2.0 methodology release committed. Q1–Q12 reorganised into Decisions Log (D1–D12) and Remaining Open Questions (OQ1–OQ10). |
| v0.3 | 2026-04-29 | Claude (post-pricing revision) | Pricing minimum revised from 5-seat to 3-seat to reflect SME lessor team-size reality. Internal target band adjusted (base €25–50k). AppFlow.md companion document drafted. |

---

### 19. Appendices

#### 19.1 Glossary

- **ABS** — Asset-Backed Securitisation.
- **AWG** — Aviation Working Group (industry body publishing the Cape Town Compliance Index).
- **Alt-A** — Alternative A under the Cape Town Aircraft Protocol; provides a 60-day cure-or-return regime in insolvency for ratifying states.
- **AWB** — Air Waybill (cargo concept; not relevant to Aerinsights but appears in design reference image).
- **CDS** — Credit Default Swap.
- **CECL** — Current Expected Credit Loss (US GAAP, ASC 326).
- **CTC** — Cape Town Convention.
- **DPD** — Days Past Due.
- **EAD** — Exposure at Default.
- **ECL** — Expected Credit Loss.
- **EIR** — Effective Interest Rate.
- **FH** — Flight Hour.
- **FVLCD** — Fair Value Less Costs of Disposal (IAS 36).
- **HSI** — Heavy Structural Inspection.
- **IATA IAWG** — Industry Accounting Working Group.
- **IBC** — Insolvency and Bankruptcy Code (India).
- **IDERA** — Irrevocable De-Registration and Export Request Authorisation.
- **JTBD** — Jobs To Be Done.
- **LC** — Letter of Credit.
- **LGD** — Loss Given Default.
- **LLP** — Life-Limited Part (engine).
- **MAV** — Maintenance-Adjusted Value.
- **MR** — Maintenance Reserve.
- **MSN** — Manufacturer Serial Number.
- **PBH** — Power-By-the-Hour (lease payment structure).
- **PD** — Probability of Default.
- **PKPU** — Penundaan Kewajiban Pembayaran Utang (Indonesian restructuring procedure).
- **RJ** — Recuperação Judicial (Brazilian judicial reorganisation).
- **RPK** — Revenue Passenger Kilometre.
- **SD** — Security Deposit.
- **SICR** — Significant Increase in Credit Risk (IFRS 9 stage-2 trigger).
- **VIU** — Value In Use (IAS 36).
- **WGI** — Worldwide Governance Indicators (World Bank).

#### 19.2 References
- Research Report: `Fleet_Analytics_Research_Report_v1.md` (companion).
- Design references: Knowvio (Dribbble), SkyLift by @sogasoux (Dribbble) — for visual-DNA extraction only.
- IFRS Foundation, AWG Cape Town materials, IATA IAWG IFRS 16 guidance — full URLs in Research Report §11.

#### 19.3 Companion documents (to be created in this order)

1. **AppFlow.md** — user journey maps per persona, screen-by-screen navigation.
2. **TechStack.md** — frameworks, libraries, infrastructure choices with rationale.
3. **BackendSchema.md** — authoritative SQL schema, migrations strategy, data-lineage map.
4. **ImplementationPlan.md** — sprint-level plan, ownership, dependencies, milestones.
5. **ModelGovernance.md** — model cards per model, validation methodology, back-test cadence.
6. **AuditTrailSpec.md** — what is logged, retention, surfacing, immutability proofs.
7. **RegulatoryMapping.md** — fuller regulatory mapping than §11 of this PRD.
8. **DataLicensingRegister.md** — every external data source's licence terms.
9. **PrivacyImpactAssessment.md** — GDPR DPIA.
10. **SecurityProgram.md** — security architecture, controls, SOC 2 trajectory.

---

*End of PRD v0.2. Status: stakeholder Q1–Q12 closed; remaining open questions (OQ1–OQ10) scoped to specific gates. Next action: produce AppFlow.md as the next companion artefact, mapping persona-specific user journeys against the locked information architecture (§6.3) and visual language (§6.1).*
