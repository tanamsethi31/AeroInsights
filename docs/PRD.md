# Aeroinsights — Product Requirements Document

**Version:** 1.0  
**Date:** May 2026  
**Status:** Living Document  
**Classification:** Internal — Confidential

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Target Market & Users](#3-target-market--users)
4. [Market Opportunity](#4-market-opportunity)
5. [Product Vision & Strategy](#5-product-vision--strategy)
6. [Differentiators](#6-differentiators)
7. [Feature Architecture](#7-feature-architecture)
8. [Primary Features](#8-primary-features)
9. [Secondary Features](#9-secondary-features)
10. [User Roles & Permissions](#10-user-roles--permissions)
11. [Technical Architecture](#11-technical-architecture)
12. [Integrations & Data Sources](#12-integrations--data-sources)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Compliance & Regulatory Framework](#14-compliance--regulatory-framework)
15. [Scale & Growth Roadmap](#15-scale--growth-roadmap)
16. [Success Metrics](#16-success-metrics)

---

## 1. Executive Summary

**Aeroinsights** is a purpose-built aviation lessor decision platform that consolidates portfolio risk management, IFRS 9 expected credit loss (ECL) modelling, counterparty intelligence, scenario stress-testing, and regulatory reporting into a single, audit-ready SaaS product.

The global commercial aircraft leasing market manages approximately **$450 billion in leased aircraft assets** across 50+ active lessors. Today that industry relies on fragmented tooling — Excel workbooks, generic credit systems, and siloed data feeds — to manage complex, high-stakes decisions affecting hundreds of millions of dollars in exposure per institution.

Aeroinsights replaces this patchwork with a vertically integrated platform that understands the language of aviation finance: lease stages, maintenance reserves, security deposits, CTC protections, insolvency regimes, and the specific macro signals (jet fuel, RPK, sovereign ratings) that drive counterparty stress in this asset class.

---

## 2. Problem Statement

### 2.1 The Core Pain

Aircraft lessors operate in a uniquely complex risk environment:

- **Multi-jurisdictional exposure** — a single portfolio spans 20–50 sovereign risk environments simultaneously, each with different insolvency law, CTC adoption, and sanctions risk
- **IFRS 9 compliance burden** — lessors must calculate, document, and disclose expected credit losses on a forward-looking basis across stages 1, 2, and 3, with an immutable audit trail regulators can inspect
- **Operational signal dependency** — unlike pure credit lenders, lessors must monitor operational metrics (load factor, schedule stability, fuel cost stress) because they are leading indicators of lessee default that balance-sheet data alone misses
- **Asset recovery complexity** — when a lessee defaults, recovery depends on physical aircraft repossession, jurisdiction-specific CTC protections, maintenance reserve adequacy, and real-time market value — none of which generic credit systems model

### 2.2 How the Industry Works Today

| Task | Current Tool | Problem |
|---|---|---|
| ECL calculation | Excel | Error-prone, not auditable, manual inputs, no scenario branching |
| Portfolio monitoring | Internal spreadsheets | No live signals, no stage migration tracking |
| Counterparty intelligence | Manually sourced news | No portfolio-relevance scoring, not linked to ECL |
| Scenario modelling | Python scripts or Excel macros | Not reproducible, no audit trail, can't branch |
| Sanctions screening | Manual OFAC checks or expensive point solutions | Not integrated with portfolio exposure |
| Board/audit reporting | Manual slide decks | Hours of effort per report cycle, no version control |
| Jurisdiction risk | Country risk services (not aviation-specific) | No link to portfolio exposure or lease stage |

### 2.3 Cost of the Status Quo

- Risk analysts spend **40–60% of their time** on data assembly rather than analysis
- ECL calculation errors under IFRS 9 carry **direct regulatory and audit risk**
- Aircraft repossessed after lessee default average **18–36 months** to re-lease when recovery is poorly managed — representing tens of millions in lost rent
- Scenario models built in Excel are **not reproducible or auditable**, creating significant audit findings risk

---

## 3. Target Market & Users

### 3.1 Primary Market

**Commercial aircraft lessors** — institutions that own commercial jet and turboprop aircraft and lease them to airlines and operators globally.

**Market Segments by Portfolio Size:**

| Tier | AUM Range | Examples | Segment Notes |
|---|---|---|---|
| Tier 1 (Enterprise) | $20B+ | AerCap, Air Lease Corp, SMBC Aviation Capital | 1,000+ aircraft, 100+ jurisdictions |
| Tier 2 (Mid-Market) | $5B–$20B | Avolon, BOC Aviation, Aircastle | 300–800 aircraft, 50–80 jurisdictions |
| Tier 3 (Growth) | $500M–$5B | Regional and niche lessors, family office-backed | 20–150 aircraft, 10–40 jurisdictions |
| Tier 4 (Emerging) | <$500M | New entrants, regional specialists | <50 aircraft, focused geography |

**Primary Target for Initial Launch:** Tier 2 and Tier 3 lessors. These institutions have genuine IFRS 9 compliance requirements and portfolio complexity, but lack the internal technology teams to build custom solutions. Tier 1 lessors are aspirational enterprise accounts with longer sales cycles.

### 3.2 Secondary Markets

- **Aviation finance banks** — institutions with aircraft loan books (EETC, export credit financing) sharing the same counterparty and asset risk profile
- **Aircraft-backed ABS/securitisation managers** — portfolio managers for Enhanced Equipment Trust Certificates and aircraft ABS structures
- **PE/infrastructure funds with aviation exposure** — funds holding lessor equity or aviation assets
- **Aviation auditors and advisors** — Big 4 audit practices and specialist aviation finance advisors who serve lessors (potential professional services licensing channel)

### 3.3 User Personas

#### Persona 1: The Risk Analyst
**Name:** Sarah Chen, Senior Risk Analyst  
**Role at lessor:** Owns IFRS 9 model, stage classification, watchlist  
**Day-to-day pain:** Spends 3 days per quarter rebuilding ECL model in Excel; cannot do ad-hoc stress tests for board requests; audit prep takes 2 weeks  
**What they need from Aeroinsights:** One-click scenario runs, immutable run history, audit export package, live signal monitoring  
**Success metric:** Quarterly close time reduced from 3 days to 4 hours  

#### Persona 2: The CFO / Chief Risk Officer
**Name:** James O'Brien, CFO  
**Role at lessor:** Owns regulatory capital, investor reporting, board pack  
**Day-to-day pain:** Cannot get real-time portfolio view; scenario comparisons require analyst turnaround; board pack takes 5 days to produce  
**What they need from Aeroinsights:** Dashboard with KPI strip, scenario comparison, board pack generation in one click  
**Success metric:** Board pack produced in under 30 minutes  

#### Persona 3: The Portfolio Manager
**Name:** Priya Nair, Portfolio Manager  
**Role at lessor:** Manages lessee relationships, lease renewals, aircraft placements  
**Day-to-day pain:** No early warning on lessee operational stress; learns about problems from news, not system  
**What they need from Aeroinsights:** Lessee radar, deal feed, jurisdiction watch, counterparty profiles  
**Success metric:** Identifies stressed lessees 30+ days earlier; no surprise defaults  

#### Persona 4: The Auditor / External User
**Name:** Mark Davies, Audit Partner (Big 4)  
**Role at lessor:** External auditor reviewing IFRS 9 ECL  
**Day-to-day pain:** Receives Excel workbooks with no change history; cannot trace methodology; significant audit time spent reconstructing process  
**What they need from Aeroinsights:** Auditor Evidence Pack (RPT-001), immutable run history, stage migration log  
**Success metric:** Audit evidence collected in hours, not weeks  

#### Persona 5: The Compliance Officer
**Name:** David Park, Head of Compliance  
**Role at lessor:** Owns sanctions screening, AML, CTC compliance  
**Day-to-day pain:** Manual OFAC checks; no link between sanctions status and portfolio exposure; jurisdiction alerts not integrated with lease data  
**What they need from Aeroinsights:** Fleet sanctions tracker, jurisdiction watch, automated screening cadence  
**Success metric:** Full fleet screened daily; any flag surfaced within 24 hours  

---

## 4. Market Opportunity

### 4.1 Total Addressable Market (TAM)

- **Global leased fleet:** ~25,000 commercial aircraft
- **Estimated leased asset value:** $450B+ (CAPA, AVAC 2025)
- **Active lessors globally:** ~200 (including subsidiaries and niche operators)
- **Estimated annual spend on risk/compliance tooling per mid-market lessor:** $500K–$3M (including people, systems, data feeds)
- **TAM estimate (SaaS capture of current spend):** $150M–$600M annually

### 4.2 Serviceable Addressable Market (SAM)

Targeting Tier 2 and Tier 3 lessors initially:
- **~120 institutions** in Tier 2/3 globally
- **Average contract value (ACV) estimate:** $80K–$350K per year depending on portfolio size and feature tier
- **SAM:** ~$30M–$50M annually (near-term)

### 4.3 Market Tailwinds

1. **IFRS 9 / CECL compliance tightening** — regulators are increasingly scrutinising expected credit loss methodologies; manual Excel models are no longer acceptable for Big 4 audits at scale
2. **Post-Russia expropriation risk awareness** — the 2022 Russian fleet seizure ($10B+ in lessor losses) permanently changed how the industry thinks about jurisdiction risk, sanctions exposure, and repossession preparedness
3. **New entrant lessors** — low-cost capital markets in Asia (Singapore, Hong Kong, Japan) are producing new lessor entrants who have no legacy systems and will adopt modern platforms from day one
4. **Aviation recovery and growth** — post-COVID recovery plus Airbus/Boeing order backlogs mean lessors are deploying more capital and need better tools to manage growing complexity
5. **Data availability** — aviation-specific data sources (OAG schedule data, MCTD utilisation, CAPA fleet databases) are becoming more accessible via API, enabling richer intelligence than was possible 5 years ago

---

## 5. Product Vision & Strategy

### 5.1 Vision

**"Make every aviation lessor decision — from lease structuring to audit sign-off — traceable, fast, and intelligence-led."**

### 5.2 Product Principles

1. **Aviation-native, not generic** — every feature is designed for the specific risk profile of aircraft leasing, not adapted from a generic credit or banking product
2. **Audit-first** — every calculation, every run, every configuration change is immutably logged; the platform generates its own audit evidence
3. **Intelligence to action** — raw signals (fuel prices, schedule instability, sovereign downgrades) are always connected to portfolio impact and suggested actions, not just displayed as data
4. **Analyst-empowering, not analyst-replacing** — scenario tools give risk analysts the ability to model complex hypotheticals in minutes; the platform augments expertise, not commoditises it
5. **Institutional-grade UX** — clean, high-density information design appropriate for senior finance professionals; no consumer-style gamification

### 5.3 Go-to-Market Strategy

**Phase 1 (Current):** Build product completeness with seed clients. Targeted direct outreach to Tier 3 lessors and aviation finance boutiques. Early adopter pricing with white-glove onboarding.

**Phase 2:** Grow into Tier 2. Partner with Big 4 aviation audit practices to embed Aeroinsights into their IFRS 9 audit workflow (Professional Services channel). Conference presence at ISTAT, Airline Economics, and AVIC.

**Phase 3:** Enterprise Tier 1 accounts. Custom deployments with dedicated infrastructure, SSO, custom data connectors, and SLA-backed support contracts.

---

## 6. Differentiators

### 6.1 Primary Differentiators

| Differentiator | What it means | Why competitors don't have it |
|---|---|---|
| **IFRS 9 ECL engine built for leasing** | Stage classification, ECL calculation, and scenario modelling designed specifically for aircraft lease book accounting — not a generic loan model adapted | Building this requires deep knowledge of both IFRS 9 methodology and aviation lease structure; no generic credit platform has invested in this combination |
| **Operational signals as credit signals** | Load factor, schedule stability, fuel cost stress, and RPK data are treated as leading indicators of lessee default risk, integrated directly into the watchlist engine | Most credit systems monitor financial covenants; aviation lessors need operational metrics that are leading indicators, not lagging |
| **Immutable scenario branching with audit trail** | Every scenario run is permanently recorded with full parameters, results, and lineage (parent → child runs); the audit trail is the product, not a feature | Generic analytics tools treat scenarios as ephemeral; regulators and auditors now require reproducible, traceable ECL scenarios |
| **Sanctions-to-exposure integration** | Sanctions screening results are linked directly to fleet positions, jurisdiction exposure, and portfolio ECL — not just a pass/fail list | Point-solution sanctions tools don't understand aircraft routes, CTC jurisdictions, or how a sanctioned route translates to lessee payment risk |
| **Jurisdiction watch integrated with lease book** | Country-level events (credit rating changes, regulatory shifts, political risk) are always expressed in terms of "which lessees does this affect and by how much" | Generic country risk services have no concept of a lease book; they produce country ratings with no connection to portfolio exposure |
| **Insolvency regime simulation** | Models recovery outcomes under Chapter 11, UK Administration, Cape Town Convention protections, and European Insolvency Regulation — jurisdiction by jurisdiction | This requires aviation legal domain knowledge that no general-purpose financial platform has embedded |

### 6.2 Competitive Landscape

| Competitor | Category | What they do | Gap vs Aeroinsights |
|---|---|---|---|
| Chatham Financial | Hedging / derivatives analytics | FX and fuel hedging analytics for airlines and lessors | No ECL engine, no portfolio management, no counterparty intelligence |
| Acuris / Debtwire | Credit intelligence | Distressed debt news and analytics | Not aviation-specific, no ECL integration, no scenario engine |
| CAPA Centre for Aviation | Aviation intelligence | Fleet and route data, news, analysis | Data/research product; not a decisioning or risk management platform |
| Avitas / mba Aviation | Asset valuation | Aircraft appraisal and market value data | Valuation only; no ECL, no counterparty risk, no reporting |
| Internal Excel / Python | Bespoke | Custom-built internal models | High build cost, no auditability, no live signals, not scalable |
| Generic GRC platforms | Enterprise risk | Governance, risk, compliance tools (e.g., RSA, ServiceNow GRC) | Not aviation-aware; require expensive customisation; don't understand lease stage accounting |

**Aeroinsights occupies a unique position:** the only platform that combines real-time aviation intelligence, IFRS 9 ECL modelling, scenario stress-testing, counterparty monitoring, and audit-ready reporting in a single vertical SaaS product for aircraft lessors.

---

## 7. Feature Architecture

The platform is organised into six functional domains:

```
┌─────────────────────────────────────────────────────────────────┐
│                        AEROINSIGHTS                             │
├─────────────┬──────────────┬──────────────┬────────────────────┤
│  PORTFOLIO  │ INTELLIGENCE │  SCENARIOS   │  COUNTERPARTIES    │
│  MANAGEMENT │    ENGINE    │   & ECL      │  & SANCTIONS       │
├─────────────┴──────────────┴──────────────┴────────────────────┤
│              REPORTS & DISCLOSURE                               │
├────────────────────────────────────────────────────────────────┤
│         DEALS & STRUCTURING (Lease Generator, NPV, Rack)        │
├────────────────────────────────────────────────────────────────┤
│       PLATFORM: Auth, RBAC, Audit Log, Settings, Export         │
└────────────────────────────────────────────────────────────────┘
```

---

## 8. Primary Features

### 8.1 Dashboard — Executive Portfolio Hub

**Purpose:** Real-time portfolio health at a glance for C-suite and risk leadership.

**Key Metrics Strip:**
- Portfolio Book Value ($B) with period delta
- Expected Credit Loss ($M) with period delta and trend direction
- Active Watchlist Entries (count with severity breakdown)
- Active Scenario Runs (count)

**Market Signal Tiles (5 live signals):**
- Jet-A1 Rotterdam price (fuel cost stress proxy)
- GDP macro indicator (sovereign credit proxy)
- Central bank rates (discount rate and PD driver)
- FX pairs relevant to portfolio (INR, BRL, MXN, EUR)
- Aviation-specific KPI (RPK growth, load factor index)
- Each tile shows: current value, delta, severity badge (High/Medium/Low), ECL impact ($M)

**ECL Trend Chart:** 6-month rolling area chart showing ECL evolution across scenarios

**Stage Distribution Chart:** Bar/line combo showing lease count and ECL by Stage 1/2/3

**Watchlist Headlines Table:** Live table of top watchlist entries with status, trigger, lessee, last changed, and one-click lessee profile access

**Recent Scenario Runs:** Last 5 scenario runs with ECL result, mode, date, and download/re-run actions

**Onboarding Checklist:** Collapsible progress tracker for new tenants covering initial setup tasks; auto-dismisses on completion

**Executive Mode:** Simplified view suppressing detailed charts; shows KPI strip, watchlist, and scenarios only — appropriate for board observers and C-suite users

---

### 8.2 Portfolio Management

**Purpose:** Complete lease register, fleet inventory, counterparty overview, and portfolio analytics across 6 tabs.

#### 8.2.1 Lease Register Tab

Full sortable table of every lease in the portfolio:
- Lease ID, Lessee, Aircraft Type, MSN
- Lease Start/End dates
- Monthly Rent (USD, convertible to selected currency)
- IFRS 9 Stage (1/2/3) with colour-coded row styling
- Status (Active / Terminated / Default)
- Filters: Stage (1/2/3/All), Status (Active/Terminated/Default/All)
- Export as XLSX

#### 8.2.2 Aircraft / Fleet Tab

Expandable fleet inventory with nested valuation and maintenance data:

**Top-Level Columns:** Aircraft Type, MSN, Current Lessee, NBV, Current MV, MAV (Market-Adjusted Value)

**Valuation Sub-Tab (Expanded):**
- Three valuation methodologies displayed simultaneously:
  - **NBV (Net Book Value):** Historical cost amortised over aircraft life
  - **CMV (Current Market Value):** Observable market comps and appraisal data
  - **MAV (Market-Adjusted Value):** Proprietary blend — MAV = (HLB × 0.4) + (CMV × 0.6) × Utilisation Factor
- Manual override controls for CMV and half-life base value
- ECL impact calculator: real-time recalculation of portfolio ECL impact from any valuation change
- Data source badges (AWG Index / Market Observable / Management Override)

**Maintenance Forecast Sub-Tab (Expanded):**
- 5-year timeline of scheduled maintenance events (C-Check, D-Check, Engine Overhaul)
- Per-event: date, type, estimated cost, completion status
- Maintenance reserve balance vs. cumulative forecast cost
- Shortfall alert if reserve balance insufficient

#### 8.2.3 Lessees Tab

Sortable counterparty health table:
- Lessee Name, Country, Behavior Score (0–100), Stage, Lease Count, Total Exposure ($M)
- Payment Days Overdue (colour-coded: ≤5 green, 5–30 amber, >30 red)
- Last Signal (most recent watchlist trigger type)
- Click through to full lessee profile

#### 8.2.4 Concentration Tab

Portfolio concentration analytics:
- Herfindahl-Hirschman Index (HHI) for lessee and geographic concentration
- Top 10 lessees by exposure (bar chart with policy threshold overlay)
- Geographic concentration by country (table and visual)
- Aircraft type concentration (pie chart)
- Policy breach alerts when any single-name or geographic threshold is exceeded

#### 8.2.5 Security Deposit / Maintenance Reserve (SD/MR) Tab

- Security deposit balances per lease with contractual vs. held amount
- Maintenance reserve accruals vs. forecast scheduled maintenance
- Shortfall and surplus positions per aircraft
- Reconciliation with balance sheet accounts

#### 8.2.6 Performance vs. Plan Tab

- Variance analysis: actual book value, ECL, default rate vs. management budget
- Trend charts comparing actuals to forecast across all key metrics
- Variance explanations tied to watchlist triggers and rating changes
- Month-by-month budget vs. actual table with RAG status

---

### 8.3 Intelligence Engine

**Purpose:** Multi-signal intelligence hub that translates macro, operational, news, and jurisdiction signals into portfolio-specific impact assessments.

#### 8.3.1 Macro Signals Tab

**7 live macro signals with portfolio impact:**

| Signal | Category | Current Example | ECL Impact |
|---|---|---|---|
| Jet-A1 Rotterdam | Fuel | +27.3% YTD | +$3.2M |
| India GDP | GDP | −0.6pp vs WEO forecast | +$2.1M |
| ECB Rate | Rates | 3.50% (−25bps) | +$0.8M |
| EUR/USD | FX | −2.0% in 90 days | +$1.5M |
| USD/INR | FX | −2.1% in 90 days | +$2.8M |
| Brent Crude | Fuel | +12.2% in 90 days | +$1.9M |
| Brazil Fiscal | GDP | 2.8pp deficit widening | +$1.2M |

**Per signal card:**
- Current value + direction
- Severity badge (High / Medium / Low)
- ECL portfolio impact ($M)
- Three narrative layers: Global context / Portfolio-specific impact / Suggested action
- Affected lessees strip (colour-coded by Stage)
- Source link

**Auto-refresh:** Every 15 minutes; manual refresh available; timestamp shown

#### 8.3.2 Lessee Radar Tab

Operational stress scoring matrix for all monitored lessees:

**5 operational metrics per lessee:**
- Load Factor (%) — threshold: <80% → RED
- Schedule Stability (%) — threshold: <85% → RED
- Fuel Cost Stress (% of revenue) — threshold: >35% → RED
- Revenue/Lease ratio (%) — threshold: >8.5% → RED
- Composite Signal Score (0–100) — drives watchlist escalation

**Composite scoring:** ≥70 = RED (Critical), 40–69 = AMBER (Watch), <40 = GREEN (Healthy)

Sortable by any column; click lessee to open profile; export radar matrix as CSV

#### 8.3.3 Deal Feed Tab

Curated aviation news and event feed with portfolio-relevance scoring:
- Categories: Financial Distress / Fleet / Route Network / Regulatory / Positive / Sanctions
- Relevance scoring (High / Medium / Low) based on portfolio exposure matching
- Sentiment classification (Negative / Positive / Neutral) per item
- Affected lessees identified per news item
- Suggested action button per item (e.g., "View Counterparty", "Escalate to Risk Team")
- Auto-refresh every 30 minutes

#### 8.3.4 Jurisdiction Watch Tab

Country-level risk event monitoring linked to portfolio exposure:
- Credit rating changes (S&P, Moody's, Fitch)
- Regulatory and legal developments
- Political risk events
- CTC (Cape Town Convention) status changes
- Per event: headline, detail, affected lessees, total exposure, Stage breakdown
- Aggregated by jurisdiction with "X lessees, $XXM exposure" summary

---

### 8.4 Scenario & ECL Engine

**Purpose:** Forward-looking ECL modelling with deterministic and Monte Carlo modes, full audit trail, and scenario branching.

#### 8.4.1 Scenario Library

7 pre-built scenarios covering the full spectrum of industry stress events:

| Scenario | ECL | vs Baseline | Weight |
|---|---|---|---|
| Baseline | $47.2M | — | 60% |
| COVID-Mild | $68.4M | +45% | 15% |
| COVID-Severe | $124.7M | +164% | 10% |
| Fuel Spike +40% | $71.3M | +51% | 7% |
| Sovereign Stress | $89.1M | +89% | 5% |
| Currency Collapse | $103.5M | +119% | 3% |
| Russia-Style Expropriation | $242.8M | +414% | Stress only |

Each card shows: ECL result, scenario weight as visual bar, description, last run timestamp, and inline configure/run panel

#### 8.4.2 Custom Scenario Builder

Full-parameter scenario construction with two editing modes:

**Form Mode (Sliders):**
- Macro shocks: GDP delta (±5pp), RPK delta (±20%), Fuel delta (−30% to +40%), FX basket delta (±15%), Rate delta (±100bps), Asset value delta (±20%)
- PD multipliers: Stage 2 (1.0x–3.0x), Stage 3 (1.0x–5.0x)
- Live ECL preview updates as sliders move

**DSL Mode (JSON Editor):**
- Full JSON scenario definition with syntax highlighting
- Real-time validation with inline error messages
- Copy/paste compatible for advanced users

**Run Configuration:**
- Deterministic mode: Single run, fixed seed, ~5 seconds
- Monte Carlo mode: 100–100,000 paths, configurable; 5,000 paths ≈ 1.25 seconds
- Runtime estimate shown before execution
- Scenario calibration banner: compares current market signals to baseline assumptions and suggests parameter adjustments

**Validation Checklist:**
- Scenario name provided
- Shocks within bounds
- PD multipliers not extreme
- All checks pass before Execute is enabled

#### 8.4.3 Run History (Immutable Audit Trail)

Permanent, branching record of every scenario execution:

**Tree structure:** Root runs with child branches (sensitivity analysis variants); GitBranch icon for child runs

**Per run:**
- Run ID, Scenario Name, Mode, Paths (MC only), Run Date, ECL Result, Duration, Status
- Actions: View Results, Clone & Edit, Branch, Download

**Expanded run panel (RunResultPanel):**
- Auto-generated narrative (key findings, dominant risk drivers, top affected lessees)
- Shapley decomposition: bar chart showing ECL contribution by risk driver (GDP / Fuel / FX / PD multiplier / Asset value)
- Stage migration: before/after Stage 1/2/3 counts and lease movements
- Top affected lessees table: ECL delta per lessee, ranked
- Download as PDF, XLSX, or JSON

**Data retention:** 7-year immutable audit trail; no deletion

#### 8.4.4 Insolvency Regimes Tab

Recovery modelling under different legal frameworks:
- Chapter 11 (US), UK Administration, European Insolvency Regulation, Cape Town Convention
- CTC (OCPI) protection impact on aircraft repossession speed and cost
- Recovery waterfall: secured vs. unsecured creditor positions
- Jurisdiction-by-jurisdiction recovery rate simulation for Stage 3 leases

#### 8.4.5 Lease Pricing Tab

Lease structuring and deal pricing tool:
- IRR-based and MWR-based rent calculation
- Inputs: Aircraft type, term, desired IRR, expected residual value, maintenance cost assumptions
- Output: Monthly rent, total lease payment, payment schedule, IRR, NPV
- Sensitivity analysis: rent vs. IRR, rent vs. residual value

---

### 8.5 Counterparties & Sanctions

**Purpose:** Deep lessee profiles with operational health monitoring and integrated sanctions screening.

#### 8.5.1 Lessee Profile Panel

**Overview Tab:**
- Total exposure, lease count, average monthly rent
- Load factor, schedule stability trend, behaviour score (3-month sparkline)
- Payment performance (days overdue, colour-coded)
- Active watchlist triggers list (7 most recent with timestamps and trigger types)

**Financial Health Tab:**
- Balance sheet summary (assets, liabilities, equity)
- EBITDA, net income (3-year history where available)
- Coverage ratios: Debt/EBITDA, interest coverage, DSCR
- Trend charts: Revenue, EBITDA, leverage over time
- Credit rating history

**Fleet Performance Tab:**
- Aircraft assignments with per-aircraft utilisation, CASK, load factor
- Fleet mix chart
- Route network map
- Monthly load factor seasonality pattern
- Route network stability (cancellations and changes)

**Restructuring Simulator:**
- Hypothetical restructuring scenario builder
- Inputs: Revenue reduction (%), cost reduction (%), covenant breach date
- Outputs: Months to cash depletion, minimum capex to avoid distress, legal path recommendation
- Recovery waterfall under relevant insolvency regime

#### 8.5.2 Sanctions Monitoring

**Watchlist signal feed:** Horizontal scrollable tile strip showing 8 most recent watchlist events across all lessees; click to jump to lessee profile

**Summary strip:** Sanctions Alerts (count) / Under Monitoring / Sanctions Clear / Fleet Exposure Flags / Last Screened timestamp

**Per-lessee sanctions status:**
- OFAC SDN (daily screening)
- EU Consolidated List (daily)
- UKOFSI (weekly)
- UNSC Consolidated (quarterly)
- Fuzzy matching threshold and match details if flagged

**Fleet Sanctions Tracker Table:** Every aircraft in the fleet, per-registration row showing:
- Registration, Aircraft Type, MSN, Lessee, Operating Country
- Sanctions Status: Red Alert / Secondary Risk / Clear (colour-coded rows)
- Route exposure breakdown (country codes + % exposure)
- Alert detail (free text if flagged)
- Last checked date
- Actions: View Registration / View Aircraft / Escalate

**Screening cadence:** OFAC daily, EU daily, UKOFSI weekly, UNSC quarterly; last batch run timestamp displayed

---

### 8.6 Reports & Disclosure

**Purpose:** Pre-built institutional-grade reports for audit, board, regulatory, and portfolio disclosure.

#### 8.6.1 Report Templates

Six pre-built report templates:

| ID | Report | Category | Formats | Primary Audience |
|---|---|---|---|---|
| RPT-001 | Auditor Evidence Pack | Audit | PDF, XLSX, CSV, JSON | External auditors, regulators |
| RPT-002 | Board Pack | Board | PDF, XLSX | CFO, Board, Investors |
| RPT-003 | Portfolio Register Export | Portfolio | XLSX, CSV | Internal operations, auditors |
| RPT-004 | ECL Disclosure Pack | Risk | PDF, XLSX | Risk committee, regulators |
| RPT-005 | Watchlist Report | Risk | PDF, XLSX | CRO, Risk team |
| RPT-006 | Jurisdiction Risk Summary | Jurisdiction | PDF, XLSX | Compliance, Board |

**On-demand generation via ReportFormatModal:**
- Format selection (PDF / XLSX / DOCX)
- Currency preference (EUR default; 9 currencies available: USD, GBP, AED, SGD, HKD, JPY, CAD, AUD)
- Module inclusion/exclusion checkboxes
- Custom timestamp
- Progress feedback and auto-download on completion

#### 8.6.2 Scheduled Reports

Recurring report delivery configuration:
- Frequency options: Daily, Weekly, Monthly, Quarterly, Custom cron
- Recipient list management (add/remove email addresses)
- Timezone-aware scheduling
- Active / Paused status toggle
- Format preference per schedule

#### 8.6.3 Export History

Immutable audit trail of every report export:
- Export ID, report name, format, generated date, user (or "Scheduled"), file size
- Re-download (30-day cache)
- View Metadata (generation parameters as JSON)
- 7-year metadata retention

---

## 9. Secondary Features

### 9.1 Deals & Structuring Module

**Rack & Stack:** Deal prioritisation engine ranking available deals by risk-adjusted return
- Inputs: Available capital, cost of capital, risk appetite
- Outputs: Ranked deal list by IRR, MOIC, risk-adjusted return metric

**Portfolio Exit NPV:**
- Full portfolio exit scenario with WACC input and per-aircraft residual value assumptions
- Output: Portfolio exit NPV, paydown timeline, return metrics
- Cash flow waterfall analysis

**Lease Generator:**
- Complete lease rent calculation from IRR-target or MWR basis
- Payment schedule output
- Sensitivity tables (rent vs. IRR at various residual value assumptions)

### 9.2 AI Agent (Aeroinsights AI)

**Pill-shaped "AI" button** with Zap icon in the header, persistent across all pages.

Planned capabilities:
- Natural language queries against portfolio data ("Which lessees have load factor below 80% and are in Stage 2?")
- ECL narrative generation (auto-written findings for board papers)
- Scenario parameter suggestions based on current market signals
- Watchlist alert summaries in plain English
- Deal structuring Q&A

### 9.3 Currency System

**Global currency selector** in the header (dropdown):
- 9 supported currencies: EUR (default), USD, GBP, AED, SGD, HKD, JPY, CAD, AUD
- All monetary values across the platform convert using static FX rates
- Selected currency persists in localStorage across sessions
- Applied uniformly to: portfolio metrics, lease rents, ECL figures, report exports

### 9.4 Settings & Administration

#### 9.4.1 Tenant Configuration
- Tenant name, base currency, timezone, fiscal year end
- IFRS 9 adoption date
- WACC / discount rate (used in ECL and NPV calculations)
- Inline edit with save/cancel; full change audit trail

#### 9.4.2 User Management & RBAC
- 4 roles: Admin / Risk Analyst / Accounting / Read-Only (see Section 10)
- Invite users via Auth0 email invitation
- MFA status per user
- Last login and activity tracking
- Soft-delete with audit trail preservation

#### 9.4.3 Data Sources
- Portfolio upload via ImportWizard: CSV or XLSX with column mapping (Step 1: file selection → Step 2: column mapping → Step 3: validation → Step 4: import confirmation)
- API integration connections for live data feeds
- Sanctions feed configuration and screening cadence settings

#### 9.4.4 Model Parameters (IFRS 9)
- Stage 1 / Stage 2 / Stage 3 PD calibration inputs
- LGD assumptions by aircraft type and jurisdiction
- Significant Increase in Credit Risk (SICR) trigger thresholds
- Discount rate override

#### 9.4.5 Audit Log
- Immutable event trail: user, timestamp, action, affected record, before/after values
- Every configuration change, scenario run, report export, and user action logged
- Non-deletable; 7-year retention
- Filter by user, date range, action type

#### 9.4.6 Alert Configuration
- Watchlist trigger threshold configuration (e.g., "Days Past Due > X days → Stage 2")
- Email notification rules by trigger type and severity
- Recipient mapping per alert category

#### 9.4.7 Excel Add-in
- Custom Excel functions exposing Aeroinsights data (ECL, stage, metrics) directly in Excel
- For users with existing Excel-based workflows; bridges adoption gap

### 9.5 Authentication & Access

- Auth0-based authentication with Auth0 Universal Login
- Three login paths: Email/Password sign-in, Create account (screen_hint: signup), Email OTP (passwordless, no password required)
- `prompt: "login"` ensures fresh login form on every session start (no cached session auto-accept)
- `federated: true` logout clears both Auth0 and upstream IdP (Google etc.) sessions
- Email allowlist at two layers: Auth0 Post Login Action (server-side) + in-app `RequireAuth` guard (client-side)
- Deep-link preservation: requested URL preserved across Auth0 redirect via `appState.returnTo`
- "Access Restricted" branded screen for authenticated but non-allowlisted users

---

## 10. User Roles & Permissions

| Permission | Admin | Risk Analyst | Accounting | Read-Only |
|---|---|---|---|---|
| View Dashboard | ✓ | ✓ | ✓ | ✓ |
| View Portfolio (all tabs) | ✓ | ✓ | ✓ | ✓ |
| Edit lease / aircraft data | ✓ | ✓ | — | — |
| View Intelligence (all tabs) | ✓ | ✓ | ✓ | ✓ |
| Run Scenarios | ✓ | ✓ | — | — |
| View Scenario Library | ✓ | ✓ | ✓ | ✓ |
| View Insolvency / Lease Pricing | ✓ | ✓ | — | — |
| View Counterparties | ✓ | ✓ | ✓ | ✓ |
| View Sanctions Tracker | ✓ | ✓ | ✓ | — |
| Generate Reports | ✓ | ✓ | ✓ | — |
| Configure Scheduled Reports | ✓ | ✓ | — | — |
| View Reports & Export History | ✓ | ✓ | ✓ | ✓ |
| Access Deals module | ✓ | ✓ | — | — |
| Manage Tenant Settings | ✓ | — | — | — |
| Manage Users & RBAC | ✓ | — | — | — |
| Configure Model Parameters | ✓ | ✓ | — | — |
| View Audit Log | ✓ | ✓ | ✓ | — |
| Configure Alerts | ✓ | ✓ | — | — |

---

## 11. Technical Architecture

### 11.1 Frontend

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Routing | React Router v6 |
| Authentication | Auth0 React SDK (`@auth0/auth0-react`) |
| State management | React Context + hooks (CurrencyContext, etc.) |
| Charts | Recharts |
| Icons | Lucide React + Bootstrap Icons |
| Export: PDF | jsPDF + jspdf-autotable |
| Export: XLSX | SheetJS (xlsx) |
| Export: DOCX | docx (v9) |
| Styling | Inline styles (institutional design system) |
| Deployment | Vercel (auto-deploy on git push to main) |

### 11.2 Backend (API)

| Layer | Technology |
|---|---|
| API | Python FastAPI |
| Base URL | `VITE_API_BASE_URL` (default: `http://localhost:8000/api/v1`) |
| Authentication | Auth0 JWT bearer tokens |
| User provisioning | POST `/auth/me` on first authenticated render |
| Data storage | PostgreSQL (inferred) |

### 11.3 Deployment

- **Frontend:** Vercel with SPA rewrite (`vercel.json`: all routes → `/index.html`)
- **CI/CD:** Auto-deploy on every push to `main` branch on GitHub (`github.com/tanamsethi31/Aeroinsights`)
- **Environment variables:** `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_ALLOWED_EMAILS`, `VITE_API_BASE_URL`

---

## 12. Integrations & Data Sources

### 12.1 Current Integrations

| Data Source | Signal | Used In |
|---|---|---|
| Auth0 | Identity and access management | Login, RequireAuth, RBAC |
| OFAC SDN | Sanctions screening | Counterparties → Fleet Tracker |
| EU Consolidated List | Sanctions screening | Counterparties → Fleet Tracker |
| UKOFSI | Sanctions screening | Counterparties → Fleet Tracker |
| UNSC Consolidated | Sanctions screening | Counterparties → Fleet Tracker |

### 12.2 Planned / Roadmap Integrations

| Data Source | Signal | Would Power |
|---|---|---|
| OAG Schedule Data | Schedule stability, load factor proxy | Lessee Radar |
| MCTD / Cirium Fleet | Aircraft utilisation, fleet movements | Aircraft tab, Lessee Radar |
| Avitas / mba Aviation | Aircraft market values (CMV) | Aircraft Valuation |
| IATA Economics | RPK, yield, load factor indices | Macro Signals |
| Bloomberg / Refinitiv | Jet-A1, Brent, FX rates, bond yields | Macro Signals (live) |
| CAPA Fleet Database | Fleet orders, retirements, placements | Deal Feed |
| Moody's / S&P / Fitch | Sovereign and corporate ratings | Jurisdiction Watch, Watchlist |
| Cape Town Convention Registry | CTC protocols per jurisdiction | Insolvency Regimes |
| ADS-B / FlightAware | Real-time aircraft positions | Sanctions route exposure |

---

## 13. Non-Functional Requirements

### 13.1 Performance

- Dashboard initial load: < 2 seconds (cached API)
- Scenario run (deterministic): < 10 seconds
- Scenario run (Monte Carlo, 1,000 paths): < 15 seconds
- Report generation (PDF, standard): < 30 seconds
- Page navigation: < 500ms (client-side routing)

### 13.2 Availability

- Target uptime: 99.9% (Vercel SLA)
- No planned maintenance windows during business hours (global user base across timezones)
- Graceful degradation: if API unavailable, frontend still loads with cached data and shows stale indicator

### 13.3 Security

- All data in transit: TLS 1.2+ (enforced by Vercel and Auth0)
- Authentication: Auth0 with PKCE flow; no passwords stored by Aeroinsights
- Session security: `prompt: "login"` prevents session hijacking via cached Auth0 tokens; `federated: true` logout clears upstream sessions
- Email allowlist: two-layer (Auth0 Action server-side + client-side guard)
- Audit log: immutable; no deletion path available in the application
- MFA: configurable per user in Settings; enforced for Admin role (target)
- API: JWT bearer token on all calls; tokens expire per Auth0 audience settings

### 13.4 Data Privacy

- No PII transmitted beyond what Auth0 receives for authentication (email, name)
- Portfolio data remains tenant-isolated (multi-tenant architecture)
- Sanctions screening results are internal to tenant
- GDPR: right to erasure handled at Auth0 level; portfolio data deletion on request

### 13.5 Accessibility

- WCAG 2.1 AA target (aspirational; current inline-style approach needs audit)
- Keyboard navigation supported for all primary flows
- Bootstrap Icons and Lucide Icons provide semantic meaning via `aria-label` (to be added)

---

## 14. Compliance & Regulatory Framework

### 14.1 IFRS 9 / IFRS 7

Aeroinsights is designed to support full IFRS 9 compliance for aircraft lessors:

- **Stage classification:** All three stages with configurable SICR triggers
- **ECL calculation:** Forward-looking, probability-weighted, time-value-adjusted
- **Disclosure support:** RPT-004 (ECL Disclosure Pack) provides IFRS 7 disclosure tables
- **Audit evidence:** RPT-001 (Auditor Evidence Pack) provides full workpapers
- **Immutable history:** Run History and Audit Log provide the reproducible audit trail IFRS 9 requires

### 14.2 Sanctions Compliance

- Multi-list screening: OFAC, EU, UKOFSI, UNSC
- Configurable cadence (daily to quarterly per list)
- Fleet-level exposure analysis (route-based secondary risk)
- Escalation workflow (Escalate action in Fleet Tracker)

### 14.3 Cape Town Convention

- Insolvency Regimes module models CTC Article XI (Alternative A/B) impact on repossession speed
- Jurisdiction-level CTC adoption status tracked in Jurisdiction Watch
- CTC protection modelled in recovery waterfall calculations

---

## 15. Scale & Growth Roadmap

### Phase 1 — Foundation (Current)

**Status:** Core platform complete

Delivered features:
- Dashboard with live signals and watchlist
- Portfolio management (6 tabs)
- Intelligence engine (4 sub-tabs)
- Scenario engine with Library, Custom Builder, Run History
- Counterparties with sanctions tracking
- Reports (6 templates, PDF/XLSX/DOCX export)
- Deals module (3 sub-tabs)
- Settings with RBAC, audit log, model params
- Auth0 authentication with allowlist, deep-linking, account switching
- Multi-currency support (9 currencies)
- Vercel deployment with auto-deploy CI/CD

**Seed client target:** 3–5 Tier 3 lessors (100–500 aircraft portfolios)

### Phase 2 — Intelligence (6–12 months)

- **Live data feeds:** Bloomberg / Refinitiv API for real-time jet fuel, FX, rates
- **OAG schedule integration:** Real operational data replacing static Lessee Radar
- **Aircraft valuation data API:** Avitas or mba Aviation CMV integration
- **AI agent (full release):** NLP query engine against portfolio data
- **Mobile-responsive views:** CFO-focused mobile dashboard
- **Excel Add-in (full release):** Certified Office Add-in with data functions

**Target:** 15–30 clients; first Tier 2 account

### Phase 3 — Enterprise (12–24 months)

- **Dedicated infrastructure:** Single-tenant deployment options for Tier 1
- **Custom data connectors:** Proprietary data ingestion pipeline (CSV, SFTP, API)
- **Advanced Monte Carlo:** Correlated shock distributions; portfolio-level VaR
- **Regulatory capital module:** ICAAP / Pillar 2 stress testing for bank lessors
- **Multi-entity consolidation:** Group-level portfolio view across multiple legal entities
- **SSO / SAML:** Enterprise identity federation (Okta, Azure AD, PingFederate)
- **Audit firm licensing:** White-label or partner channel for Big 4 IFRS 9 audit practices
- **API (public):** REST API allowing clients to pull Aeroinsights data into their own systems

**Target:** 50–100 clients; first Tier 1 account; annual revenue $5M+

### Phase 4 — Platform (24–48 months)

- **Marketplace:** Third-party data and analytics connectors
- **Benchmark database:** Anonymised industry benchmarks (default rates, recovery rates, LGD by aircraft type) — powered by aggregated platform data
- **Regulatory reporting automation:** Direct XBRL/iXBRL filing support for applicable jurisdictions
- **Secondary market module:** Lease trading and aircraft sale process management

---

## 16. Success Metrics

### 16.1 Product Metrics

| Metric | Definition | Target (Year 1) |
|---|---|---|
| Time to first scenario run | Minutes from account creation to first completed scenario | < 30 minutes |
| ECL close time reduction | Self-reported time saving on quarterly ECL close | > 50% reduction |
| Board pack generation time | Time from click to download for RPT-002 | < 5 minutes |
| Watchlist early warning rate | % of lessee stress events flagged by Lessee Radar before payment default | > 70% |
| Audit evidence completeness | % of auditor requests satisfied by platform exports without manual supplementation | > 85% |
| Report generation NPS | Net Promoter Score from report users | > 50 |

### 16.2 Business Metrics

| Metric | Target (Year 1) | Target (Year 2) |
|---|---|---|
| Paying clients | 5 | 25 |
| ARR | $400K | $2.5M |
| Average Contract Value | $80K | $100K |
| Gross Revenue Retention | — | > 90% |
| Net Revenue Retention | — | > 110% |
| Time to Value (first meaningful use) | < 1 week | < 3 days |

### 16.3 Quality Gates

- Zero P0 bugs in production at any time
- All scenario runs produce reproducible results (same inputs → same outputs, deterministic mode)
- Audit log completeness: 100% of state-changing actions logged
- Sanctions screening: 100% of fleet screened within configured cadence (no silent failures)

---

*This document is a living PRD. It will be updated as the product evolves, new client feedback is gathered, and roadmap priorities are refined.*

*Owner: Product  
Last updated: May 2026*
