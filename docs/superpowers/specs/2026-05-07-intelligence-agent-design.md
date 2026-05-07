# Aeroinsights Intelligence 2.0 — Expert Agent Design Spec

**Date:** 7 May 2026  
**Feature:** Persistent AI agent embedded in the platform — portfolio-contextualised, domain-expert, agentic  
**Status:** Approved for implementation

---

## Goal

Build a permanently available AI analyst agent that knows the authenticated user's entire portfolio, understands aviation finance at senior-analyst level, has real-time access to market intelligence, and can navigate the platform and pre-populate forms on behalf of the user. Accessed via a circular button in the header, always present, never intrusive.

## Architecture

### New files

```
src/app/contexts/AgentContext.tsx
  — Panel open/close state, chat history (session-only), current page context string,
    usage counter (localStorage), pendingInputs for cross-page pre-population

src/app/components/agent/AgentButton.tsx
  — 40×40px circular trigger button, Oxford Blue, Zap icon
  — Breathing pulse animation on hover (2s loop, 200ms ease-out per phase)
  — Red notification dot when new high-severity signal since last panel open
  — Placed in Header.tsx immediately right of search bar

src/app/components/agent/AgentPanel.tsx
  — 420px fixed overlay, slides in from right (240ms cubic-bezier(0.32,0.72,0,1))
  — Sections: header bar, context strip, suggestions (when empty), chat area, input area, footer
  — Does not push layout (position: fixed, z-index: 50)
  — Minimize collapses to 48px strip; close unmounts

src/app/components/agent/AgentMessage.tsx
  — Renders individual messages: plain text, markdown tables, navigation links,
    action confirmation cards, tool-execution indicator

src/app/components/agent/AgentSuggestions.tsx
  — 4 contextual suggestion chips per route, static map (not AI-generated)
  — Shown only when chat history is empty
  — Click submits chip text as user message

src/app/components/agent/agentTools.ts
  — 5 tool definitions (JSON Schema for OpenAI function calling)
  — Executor functions: pure JS, query existing mock data modules directly
  — No network calls, no backend dependency

src/app/components/agent/portfolioSummary.ts
  — buildPortfolioSummary(): string
  — Queries LESSEE_RADAR, MACRO_SIGNALS, DEAL_FEED, DEFAULT_POLICY_RULES,
    PEAK_CONCENTRATIONS at AgentContext init time
  — Returns ~400-token structured prose string injected into every system prompt

src/app/utils/eclCalculator.ts
  — computeECL(inputs): number  and  computeStages(ecl, inputs): StageDistribution
  — Extracted from Scenarios.tsx; imported by both Scenarios.tsx and agentTools.ts

src/app/services/agentService.ts
  — streamAgentResponse(messages, tools, signal): AsyncGenerator<AgentEvent>
  — Handles Azure OpenAI streaming (stream: true, SSE parsing)
  — Detects tool_call deltas mid-stream, accumulates args, executes tool, makes
    second fetch with tool result, resumes streaming
  — Yields typed events: {type:"token",text}, {type:"tool_start",name},
    {type:"tool_done"}, {type:"action",path,params}, {type:"done"}, {type:"error",msg}
```

### Modified files

```
src/app/App.tsx
  — Wrap app with <AgentProvider>

src/app/components/layout/Layout.tsx
  — Render <AgentPanel> as sibling to Outlet (fixed overlay, always mounted when open)

src/app/components/layout/Header.tsx
  — Add <AgentButton> immediately right of the search bar div

src/app/pages/Scenarios.tsx
  — On Custom Builder tab mount, read AgentContext.pendingInputs
  — If present, call updateFormInputs(pendingInputs) and clear pendingInputs
  — Same pattern as existing clonePending mechanism
```

---

## Data Layer

### Portfolio summary

Built once at `AgentContext` initialisation. Queries existing mock data, returns ~400 tokens of structured prose. Never regenerated mid-session.

**Content:**
- Book value, lease count, lessee count, ECL, ECL as % of book
- Stage 3 lessees: name + exposure per lessee
- Stage 2 lessees: name + exposure per lessee
- Stage 1 lessees: name + exposure per lessee
- Active policy breaches (from `DEFAULT_POLICY_RULES` + `PEAK_CONCENTRATIONS`)
- High-severity market signals: name + change label (from `MACRO_SIGNALS`)
- Recent deal feed: headline + hours ago (top 4 from `DEAL_FEED`)

### The 5 tools

**`get_lessee_detail(lesseeName: string)`**  
Queries: `LESSEE_RADAR`, `WATCHLIST_DATA` (from watchlistEngine), `DEAL_FEED`  
Returns: composite signal, score, all four radar signals with values/status/trend, watchlist audit log (last 3 entries), relevant deal feed items

**`get_leases_by_filter({stage?: string, jurisdiction?: string, expiryBefore?: string, lesseeId?: string})`**  
Queries: static `MOCK_LEASES` array defined inline in `agentTools.ts` — 15–20 representative leases across the 10 lessees, sufficient for prototype query responses  
Returns: filtered lease list — lessee, aircraft type, MSN, expiry date, stage, jurisdiction, monthly rent USD

**`get_market_signals({category?: string})`**  
Queries: `MACRO_SIGNALS`, `DEAL_FEED`, `JURISDICTION_EVENTS`  
Returns: signals filtered by category (fuel/gdp/rates/fx/aviation/all), each with severity, ECL impact, affected lessees

**`get_scenario_result(scenarioName: string)`**  
Queries: static `MOCK_SCENARIO_RUNS` array defined inline in `agentTools.ts` — 4 representative historical runs (Baseline, Fuel Spike, COVID-Severe, Rate Rise). The `computeECL` function is extracted from `Scenarios.tsx` into a new shared utility `src/app/utils/eclCalculator.ts` and imported by both `Scenarios.tsx` and `agentTools.ts`.  
Returns: matched scenario name, run date, ECL result, stage distribution, key inputs used

**`navigate_and_prepopulate({path: string, params?: Record<string, number>})`**  
Not a data tool — triggers an action event in `agentService`  
`AgentPanel` intercepts, renders a confirmation card showing path + params  
On user confirm: calls `useNavigate(path)`, sets `AgentContext.pendingInputs = params`  
Always requires user confirmation before executing — never fires automatically

### System prompt structure

```
[PERSONA + DOMAIN SCOPE — ~150 tokens]
You are Aeroinsights Intelligence, a domain-expert AI analyst embedded in an
aircraft lessor portfolio management platform. You have deep knowledge of IFRS 9
ECL methodology, IAS 36 VIU, Cape Town Convention repossession practice, and
aviation finance. You only discuss topics within this domain. For regulatory or
tax questions, always note "consult your auditor/advisor." For investment
decisions, present options with trade-offs — never make a direct recommendation.

[PORTFOLIO CONTEXT — ~400 tokens]
{buildPortfolioSummary()}

[CURRENT PAGE CONTEXT — ~30 tokens, updated per route]
User is currently viewing: {pageContext}

[PLATFORM SITEMAP — ~200 tokens]
Dashboard (/): portfolio KPIs, ECL trend, market signals strip, recent scenarios.
Portfolio (/portfolio/analytics): concentration analysis, covenant headroom.
Portfolio > Leases (/portfolio/register): full lease register.
Scenarios (/scenarios/run): Custom Builder — scenario parameter form with sliders.
Deals (/deals/generator): lease pricing and deal analysis.
Risk & ECL (/risk-ecl): ECL overview, stage migration, sensitivity.
Aero Intelligence (/intelligence): macro signals, lessee radar, deal feed, jurisdiction watch.
Counterparties (/counterparties): lessee watchlist, behavior scores, profile panels.
Jurisdictions (/jurisdictions): Cape Town scores, enforcement data.
Settings > Model Params (/settings/ecl): SICR triggers, concentration policy rules.
Reports (/reports): report templates, export history.

[KNOWLEDGE BASE — ~600 tokens]
IFRS 9: Stage 1 = performing, 12-month ECL, EIR on gross carrying amount.
Stage 2 = SICR triggered, lifetime ECL, EIR on gross. Stage 3 = credit-impaired,
lifetime ECL, EIR on net (amortised cost). SICR indicators: 30+ DPD rebuttable
presumption, significant PD increase vs origination, watchlist elevation, covenant
breach. ECL = PD × LGD × EAD, discounted at original EIR.
IAS 36 VIU: discount rate = pre-tax rate reflecting current market assessment of
time value of money and asset-specific risks. ECB deposit rate relevant for
EUR-denominated lease streams.
Cape Town Convention: IDERA allows lessor to de-register and export aircraft on
lessee default without court order, in ratifying states. CTC score reflects
ratification quality + enforcement track record. Ireland, Singapore, UAE: strong.
India: improved post-2024 IBC amendments. Brazil, Sri Lanka: moderate with caveats.
Maintenance reserves: typically $150–300/FH and $200–500/cycle for narrowbody
aircraft, held by lessor, returned on qualifying shop visit. Security deposits:
typically 2–3 months rent, applied on default.
Lease rate factor (LRF): monthly rent ÷ aircraft NBV, typically 0.7–1.1% for
narrowbody, 0.55–0.85% for widebody. Revenue/lease ratio: annual lease cost ÷
annual revenue, >8.5% signals stress for most carrier cost structures.

[TOOLS]
{JSON schema for all 5 tools}

[HARD CONSTRAINTS]
- Never discuss topics outside aviation finance, IFRS 9/16/IAS 36, Cape Town
  Convention, and this platform's functionality
- Never make specific investment recommendations
- Always caveat regulatory/tax guidance with "consult your auditor/advisor"
- For navigate_and_prepopulate: always confirm before executing, show exact params
- Respond concisely — prefer tables for comparative data, bullets for lists
- When uncertain about specific portfolio data, call the appropriate tool rather
  than guessing
```

---

## UI / UX

### AgentButton

- 40×40px circle, `background: #002147`, `border-radius: 50%`
- Icon: lucide `Zap` (16px, white) — already imported in project
- **Hover state:** CSS keyframe animation `agentPulse` — `box-shadow` goes from `0 0 0 0px rgba(0,33,71,0.35)` to `0 0 0 10px rgba(0,33,71,0)` over 2s, loops. Each phase: 200ms `ease-out`
- **Open state:** `box-shadow: inset 0 0 0 2px rgba(255,255,255,0.3)` inner ring
- **Notification dot:** 8×8px circle, `background: #B91C1C`, `position: absolute`, top-right, border: `2px solid white`. Appears when `AgentContext.hasNewSignal === true`. Cleared on panel open.

### AgentPanel

- `position: fixed; right: 0; top: 0; height: 100vh; width: 420px; z-index: 50`
- Slide animation: `transform: translateX(100%)` → `translateX(0)`, 240ms `cubic-bezier(0.32,0.72,0,1)`
- `background: #FFFFFF; border-left: 1px solid #E2E8F0; box-shadow: -4px 0 24px rgba(0,0,0,0.10)`

**Header bar (56px):**
```
[Zap 16px] Aeroinsights Intelligence          [—] [×]
           GPT-4o · EU West · Data stays in region
```
Title: 14px weight-600 `#0F172A`. Badge: 11px `#475569`. Minimize collapses panel to 48px width strip showing only the Zap icon; click to re-expand.

**Context strip (36px):** `background: #F8FAFC; border-bottom: 1px solid #E2E8F0`  
12px muted text, single line, truncated. Updates on every route change via `useLocation()` in `AgentContext`.

**Suggestion chips:** 8px gap flex-wrap, shown when `messages.length === 0`.  
Each chip: pill button, `background: #F8FAFC`, `border: 1px solid #E2E8F0`, 13px.  
Route → 4 chips (static map in `AgentSuggestions.tsx`):

| Route | Chip 1 | Chip 2 | Chip 3 | Chip 4 |
|---|---|---|---|---|
| `/` | "What needs attention today?" | "Summarise my ECL position" | "Any new signals affecting my book?" | "Which lessees are most exposed to fuel?" |
| `/counterparties` | "Which lessees are Red this week?" | "Compare my Stage 3 lessees" | "What are my options for IndiGo?" | "Show worst fuel-cost exposures" |
| `/scenarios/run` | "What market inputs should I use today?" | "Pre-populate from current market data" | "Explain the drivers of my last run" | "Which lessees drive the most ECL variance?" |
| `/intelligence` | "Which signal has the biggest ECL impact?" | "Summarise this week's deal feed" | "What does the India GDP revision mean for me?" | "Any jurisdiction risks I should act on?" |
| `/risk-ecl` | "Why did three leases migrate to Stage 2?" | "What is driving my ECL increase?" | "Which lessee has the highest LGD?" | "Generate an auditor summary of this quarter" |
| `(default)` | "What needs attention today?" | "Summarise my ECL position" | "Any new signals affecting my book?" | "Open Aero Intelligence" |

**Chat area:**  
User messages: right-aligned, `background: #002147`, white text, `border-radius: 18px 18px 4px 18px`, max-width 80%.  
Agent messages: left-aligned, `background: #FFFFFF`, `border-left: 2px solid #002147`, `border-radius: 0 18px 18px 18px`, max-width 92%.  
Scroll-to-bottom on new message. Overflow-y: auto.

**Message content (AgentMessage.tsx renders):**
- Plain paragraphs — standard text
- Markdown tables (`| col |` lines) → styled `<table>` matching platform table system
- Navigation links `[[Label|/path]]` → Oxford Blue underlined, triggers `useNavigate` on click
- Tool indicator: `"Looking up [tool name]..."` in 12px italic `#94A3B8`, replaced when streaming resumes
- Action confirmation card (distinct UI):

```
┌─────────────────────────────────────────────────┐
│ ⚡ Ready to open Custom Builder                  │
│                                                 │
│   Fuel Delta       +14.3%                       │
│   GDP Delta        −0.6pp                       │
│   EUR/USD Delta    −2.0%                        │
│                                                 │
│   [Open and pre-fill]        [Cancel]           │
└─────────────────────────────────────────────────┘
```
Background: `rgba(0,33,71,0.04)`, border: `1px solid rgba(0,33,71,0.15)`, border-left: `3px solid #002147`.

**Input area (64px, border-top):**  
`<textarea>` single-line (Enter sends, Shift+Enter newline), placeholder "Ask about your portfolio...". Send button: Oxford Blue, arrow icon. "Actions" pill expands 3-item menu: *Run Scenario*, *Generate Report*, *Export Data* — each submits a pre-written message string.

**Footer (28px):** `background: #F8FAFC; border-top: 1px solid #E2E8F0`  
Left: `{count} / 200 queries today` in 12px muted. Right: ⓘ icon, tooltip explains limit.

---

## Agent Capabilities by Tier

### Tier 1 — Portfolio queries
Answered from portfolio summary (no tool call) for macro questions. Tool calls (`get_lessee_detail`, `get_leases_by_filter`) for specific lessee or lease queries. The system prompt includes 3 few-shot examples showing the expected answer style.

### Tier 2 — Market intelligence
Answered from portfolio summary for high-level signal questions. `get_market_signals` for filtered or detailed signal queries. Model always relates signals back to specific affected lessees — never generic macro commentary.

### Tier 3 — Analytical guidance
Answered from the knowledge base embedded in the system prompt. Always caveated appropriately. Model reasons over IFRS 9 / IAS 36 / Cape Town concepts against the user's specific portfolio data from the summary.

### Tier 4 — Platform navigation guidance
Answered from the platform sitemap in the system prompt. "Where do I configure X?" → exact path, what each setting means, direct navigation link in response.

### Tier 5 — Agentic actions (navigate + pre-populate + compute only)

| Action type | Implementation | Confirmation required |
|---|---|---|
| Navigate to page | `navigate_and_prepopulate({path})` → `useNavigate()` | Yes — confirmation card |
| Pre-populate form | `navigate_and_prepopulate({path, params})` → `AgentContext.pendingInputs` | Yes — shows exact params |
| Compute scenario ECL | `computeECL()` called in `agentTools.ts` with provided inputs, result returned inline | No — read-only computation |
| Navigate to report | Navigation link in response to `/reports` with template pre-selected | No — link is passive |

**Explicitly excluded from Tier 5:**  
Direct writes to watchlist status, stage classifications, ECL assumptions, policy rules, or any record constituting audit evidence. The agent guides the user to the right screen; the human executes the final action.

---

## Usage Limits

```typescript
// localStorage key: "aeroinsights:agent_usage"
interface AgentUsage {
  date: string;        // "2026-05-07" — resets when date changes
  count: number;       // increments per sent message
  userId: string;      // auth0 sub, to scope per user on shared devices
}
```

- **Limit:** 200 queries/user/day
- **80% warning:** soft banner in panel footer at 160/200
- **At limit:** input disabled, message: "Daily query limit reached. Resets at midnight UTC."
- **Enforcement:** localStorage only (prototype). Production: backend middleware.

---

## Scope Boundaries (system prompt enforced)

**In scope:**
- Authenticated user's portfolio data (current session mock data only)
- IFRS 9, IAS 36, IFRS 16 as applied to aircraft lessors
- Cape Town Convention and jurisdictional repossession practice
- Aviation finance market conditions (Intelligence module feeds)
- Aeroinsights platform functionality and navigation
- General aviation finance industry knowledge

**Out of scope (model declines with redirect):**
- Topics outside aviation finance
- Specific investment recommendations
- Regulatory or tax advice stated as instructions (explanation with caveat: yes)
- Competitor pricing or commentary
- Data from other tenants (architecturally impossible + prompt enforced)

---

## Environment Variables Required

```bash
VITE_AZURE_OPENAI_ENDPOINT   # already configured for narrativeService
VITE_AZURE_OPENAI_KEY        # already configured for narrativeService
VITE_AZURE_OPENAI_AGENT_DEPLOYMENT   # deployment name for GPT-4o (may differ from narrative deployment)
```

If `VITE_AZURE_OPENAI_AGENT_DEPLOYMENT` is unset, agent falls back to the same deployment as `narrativeService`. If endpoint or key are missing, `AgentButton` renders in a disabled state with tooltip "Intelligence agent not configured."

---

## What This Is Not

- Not a chatbot bolted on the side. It has full portfolio context from the first message.
- Not a help widget. It reasons about the user's actual data, not generic docs.
- Not a search bar. It synthesises across signals, tools, and knowledge — not keyword retrieval.
- Not a write agent. It navigates and pre-populates. Humans make the final change on regulated data.
