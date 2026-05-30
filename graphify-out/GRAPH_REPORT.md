# Graph Report - docs/  (2026-05-24)

## Corpus Check
- Corpus is ~10,583 words - fits in a single context window. You may not need a graph.

## Summary
- 126 nodes · 214 edges · 9 communities (7 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.84)
- Token cost: 85,000 input · 17,260 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Operational Layer (Alerts · Reports · Audit)|Operational Layer (Alerts · Reports · Audit)]]
- [[_COMMUNITY_Real Intelligence & Sanctions Data|Real Intelligence & Sanctions Data]]
- [[_COMMUNITY_Excel Ingestion & ImportWizard|Excel Ingestion & ImportWizard]]
- [[_COMMUNITY_Backend Architecture (ADR-001)|Backend Architecture (ADR-001)]]
- [[_COMMUNITY_Multi-Tenancy & RBAC|Multi-Tenancy & RBAC]]
- [[_COMMUNITY_Quality · Observability · AI|Quality · Observability · AI]]
- [[_COMMUNITY_IFRS-9 ECL Core|IFRS-9 ECL Core]]
- [[_COMMUNITY_Persona CFO|Persona: CFO]]
- [[_COMMUNITY_Persona Portfolio Manager|Persona: Portfolio Manager]]

## God Nodes (most connected - your core abstractions)
1. `supabase/migrations/` - 22 edges
2. `T-1.1 Multi-sheet Excel parser (TODO)` - 16 edges
3. `T-1.2 Ingest Lessee Profiles sheet (TODO)` - 12 edges
4. `T-0.3 Canonicalize Portfolio vs Org scoping (TODO)` - 11 edges
5. `Phase 1 - Full Excel Ingestion` - 10 edges
6. `T-3.4 Universal audit log (TODO)` - 9 edges
7. `T-4.1 Row-level security audit and lockdown (TODO, HIGH)` - 9 edges
8. `T-0.1 Decide and execute backend architecture (DONE)` - 8 edges
9. `T-0.2 Consolidate import flows (TODO)` - 8 edges
10. `T-1.5 Ingest IFRS 9 ECL parameters (TODO)` - 8 edges

## Surprising Connections (you probably didn't know these)
- `T-4.1 Row-level security audit and lockdown (TODO, HIGH)` --references--> `PRD section 10 - User Roles & Permissions`  [INFERRED]
  ROADMAP.md → PRD.md
- `T-4.1 Row-level security audit and lockdown (TODO, HIGH)` --implements--> `Row-Level Security (RLS)`  [EXTRACTED]
  ROADMAP.md → PRD.md
- `T-0.2 Consolidate import flows (TODO)` --implements--> `ImportWizard (4-step)`  [INFERRED]
  ROADMAP.md → PRD.md
- `T-1.1 Multi-sheet Excel parser (TODO)` --implements--> `ImportWizard (4-step)`  [INFERRED]
  ROADMAP.md → PRD.md
- `T-1.5 Ingest IFRS 9 ECL parameters (TODO)` --implements--> `IFRS 9 Expected Credit Loss (ECL)`  [EXTRACTED]
  ROADMAP.md → PRD.md

## Hyperedges (group relationships)
- **All Phase 0 tasks** — task_0_1, task_0_2, task_0_3 [EXTRACTED 1.00]
- **All Phase 1 tasks** — task_1_1, task_1_2, task_1_3, task_1_4, task_1_5, task_1_6, task_1_7, task_1_8, task_1_9, task_1_10 [EXTRACTED 1.00]
- **All Phase 3 tasks** — task_3_1, task_3_2, task_3_3, task_3_4, task_3_5 [EXTRACTED 1.00]
- **Tasks affecting supabase/migrations/** — task_0_3, task_1_2, task_1_3, task_1_4, task_1_5, task_1_6, task_1_7, task_1_8, task_1_10, task_2_5, task_2_6, task_3_1, task_3_3, task_3_4, task_3_5, task_4_1, task_4_3, task_5_1, task_5_2, task_5_3, task_5_4, task_6_5 [EXTRACTED 1.00]
- **Roadmap critical path** — task_0_1, task_0_2, task_1_1, task_1_2, task_2_4, task_3_1, task_4_2, task_5_1 [EXTRACTED 1.00]

## Communities (9 total, 2 thin omitted)

### Community 0 - "Operational Layer (Alerts · Reports · Audit)"
Cohesion: 0.12
Nodes (25): Universal Audit Log (immutable, 7yr), Scenario & ECL Engine (Run History), Stage Migration tracking, api/cron/alerts.ts (new), api/cron/scheduled-reports.ts (new), api/cron/watchlist-eval.ts (new), api/fx/rates.ts (new), src/app/contexts/CurrencyContext.tsx (+17 more)

### Community 1 - "Real Intelligence & Sanctions Data"
Cohesion: 0.11
Nodes (25): Sanctions screening (OFAC/EU/UKOFSI/UNSC), api/sanctions/screen.ts (new), api/signals/news.ts, src/app/components/counterparties/, src/app/components/counterparties/LesseeProfilePanel.tsx, src/app/components/counterparties/SimpleLesseePanel.tsx, src/app/components/portfolio/AircraftValuationPanel.tsx, src/app/data/intelligenceData.ts (+17 more)

### Community 2 - "Excel Ingestion & ImportWizard"
Cohesion: 0.15
Nodes (22): ImportWizard (4-step), Monthly close workflow, e2e/ (new), playwright.config.ts (new), src/app/components/import/ColumnMapStep.tsx, src/app/components/import/ImportWizard.tsx, src/app/components/jurisdictions/jurisdictionData.ts, src/app/components/portfolio/SDMRTab.tsx (+14 more)

### Community 3 - "Backend Architecture (ADR-001)"
Cohesion: 0.13
Nodes (15): ADR-001 Backend Architecture (Supabase + Vercel Functions), Excel Add-in (=AERO.* functions), FastAPI backend (removed), Row-Level Security (RLS), Supabase (Postgres + RLS), Vercel Functions, api/excel/*.ts (new Vercel Functions), backend/ (deleted) (+7 more)

### Community 4 - "Multi-Tenancy & RBAC"
Cohesion: 0.21
Nodes (15): RBAC roles (Admin / Risk Analyst / Accounting / Read-Only), api/signals/, api/tenant/delete.ts (new), src/app/contexts/PortfolioContext.tsx, src/app/hooks/, src/app/hooks/useRole.ts (new), src/app/pages/Settings.tsx, Phase 4 - Multi-tenancy and RBAC Hardening (+7 more)

### Community 5 - "Quality · Observability · AI"
Cohesion: 0.14
Nodes (15): api/ai/chat.ts, api/ai/narrative.ts, api/**/*.ts, docs/RUNBOOK.md (new), .github/workflows/security.yml (new), src/app/services/, src/app/services/narrativeService.ts, src/app/utils/ (+7 more)

### Community 6 - "IFRS-9 ECL Core"
Cohesion: 0.43
Nodes (7): IFRS 9 Expected Credit Loss (ECL), Significant Increase in Credit Risk (SICR), src/app/pages/RiskECL.tsx, src/app/utils/eclCalculator.ts, T-1.5 Ingest IFRS 9 ECL parameters (TODO), T-1.6 Ingest SICR triggers configuration (TODO), T-3.2 Persist ECL period snapshots (TODO)

## Knowledge Gaps
- **57 isolated node(s):** `Vercel Functions`, `FastAPI backend (removed)`, `RBAC roles (Admin / Risk Analyst / Accounting / Read-Only)`, `Significant Increase in Credit Risk (SICR)`, `Scenario & ECL Engine (Run History)` (+52 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `supabase/migrations/` connect `Operational Layer (Alerts · Reports · Audit)` to `Real Intelligence & Sanctions Data`, `Excel Ingestion & ImportWizard`, `Multi-Tenancy & RBAC`, `IFRS-9 ECL Core`?**
  _High betweenness centrality (0.436) - this node is a cross-community bridge._
- **Why does `Phase 6 - Quality, Observability, Compliance` connect `Quality · Observability · AI` to `Excel Ingestion & ImportWizard`, `Multi-Tenancy & RBAC`?**
  _High betweenness centrality (0.209) - this node is a cross-community bridge._
- **Why does `T-6.5 Data retention and tenant deletion (TODO)` connect `Multi-Tenancy & RBAC` to `Operational Layer (Alerts · Reports · Audit)`, `Quality · Observability · AI`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **What connects `Vercel Functions`, `FastAPI backend (removed)`, `RBAC roles (Admin / Risk Analyst / Accounting / Read-Only)` to the rest of the system?**
  _57 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Operational Layer (Alerts · Reports · Audit)` be split into smaller, more focused modules?**
  _Cohesion score 0.12333333333333334 - nodes in this community are weakly interconnected._
- **Should `Real Intelligence & Sanctions Data` be split into smaller, more focused modules?**
  _Cohesion score 0.10666666666666667 - nodes in this community are weakly interconnected._
- **Should `Excel Ingestion & ImportWizard` be split into smaller, more focused modules?**
  _Cohesion score 0.1471861471861472 - nodes in this community are weakly interconnected._