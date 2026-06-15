# AeroInsights — Intro / Product Demo Video (Remotion) — Design Spec

**Date:** 2026-06-15
**Status:** Approved (pending implementation plan)
**Author:** Tanam Sethi (with Claude)
**Topic:** A founder-led product demo video of AeroInsights, built in Remotion.

---

## 1. Goal & context

Produce a ~2.5-minute introductory **product demo video** of AeroInsights that
replicates what the founder (Tanam) would show an executive in a live
screen-share. It is used primarily for **cold outreach** (LinkedIn / email,
per the founder's outreach template) and the website. It must cover the
platform's **primary features** and its **differentiation**, while keeping the
language simple and to-the-point.

The video is **built in Remotion** by **rebuilding the app's UI as React
components** (faithful replicas using the real design tokens) — not by
capturing the live app (which is gated behind Auth0 + Supabase) and not by
importing live app code (which is coupled to Auth0/Supabase/Router/contexts).

### Source of truth for what to highlight
The **landing page** (`src/app/pages/Landing.tsx`) is the founder's own
narrative and drives feature priority. The **outreach email** sets the voice
and the must-cover pillars: *lease portfolio monitoring, stress testing,
lessee credit risk, lease rate forecasting, and the AI layer*, plus the
social-proof story (built from scratch; demoed to ELFC, Aerfin, EY) and
"signup takes seconds."

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Audience | Aviation-finance professionals broadly ("every seat at the table"), framed as a founder demo to an executive |
| Format | **Founder-driven guided tour** — a simulated cursor navigates ONE rebuilt app shell |
| Length | **~2.5 min** (≈2:40 with the agreed additions; VO kept tight to land near 2:30) |
| Narration | **Founder voiceover** (first person) + on-screen **captions** + **music**. Tanam records VO later; build to estimated timings + captions now |
| Founder/social proof | **Light touch, product-first** — founder + logos appear briefly near the close |
| Production approach | **Rebuild UI in React/Remotion components** (approach "C"), using real design tokens; do **not** import live app code |
| Demo data | The **bundled sample portfolio** (`AeroInsights_SamplePortfolio_2026.xlsx` — "Aer Capital Partners Ltd.") |
| Opening | **Straight into the product** (cursor lands on the dashboard) |
| Closing CTA | Sign-up + demo + contact ("Sign up in seconds — email or Google", `aeroinsights.vercel.app`, "Book a demo", Tanam Sethi / LinkedIn) |
| Aspect ratio | **16:9, 1920×1080 @ 30fps** (single master) |
| Interaction realism | **Realistic cursor** — clicks, hovers, tab switches, typing, panels expanding |
| Music tone | **Calm, modern, corporate-confident** (premium fintech) |

### Feature coverage
**Core (always):** Portfolio monitoring · Risk & ECL (IFRS 9) · Scenarios/stress
(Library **and** Custom Builder) · Lessee credit risk (Intelligence) · AI layer.
**Add-ons (selected):** Lease Rate Outlook (forecasting) · Excel Add-In.
**Dashboard:** KPIs **and** the Lessee Intelligence Map (globe).
*Not included:* Deal Generator, Maintenance Forecasting (kept out to protect pacing).

---

## 3. Brand & motion direction

From `.impeccable.md` and `src/styles/`:

- **Colour:** Oxford Blue `#002147` (primary); softer dark navy `#0a1a33` for
  atmospheric fields; off-white `#f4f7fd` for light surfaces. Semantic risk
  colours: red `#B91C1C`, amber `#B45309`, green `#15803D`.
- **Type:** Geist (technical, tabular numerals). Loaded via `@remotion/google-fonts`
  with `delayRender` so text never flickers.
- **Personality:** *Precise · Trustworthy · Authoritative* — "Bloomberg Terminal
  meets modern SaaS."
- **Motion:** restrained. Entrances are `opacity 0→1` + small `y` only;
  conservative ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`); **no bounce, no
  elastic, no purple-gradient AI aesthetics**. Animations communicate state,
  never perform.

---

## 4. Shot-by-shot script

Total ≈ 2:40 @ 30fps (≈4,800 frames). VO is first person, in the founder's
voice. Captions are brand-styled lower-thirds.

### Scene 1 — Dashboard (0:00–0:14)
- **Action:** App shell loads on the **Dashboard**. KPI strip counts up
  (Portfolio value, 12 aircraft, Avg LTV, **ECL Reserve $47.2M**) *alongside*
  the **Lessee Intelligence Map** — an orthographic globe slowly rotating with
  pulsing markers on watchlist countries (India & Mexico **red**/Stage 3,
  others amber/green).
- **VO:** "This is AeroInsights — the platform I built to run an entire
  aircraft-leasing book in one place. The dashboard gives you the headline
  numbers and a live map of where your counterparty risk actually sits.
  Everything here is real portfolio data."
- **Caption:** **AeroInsights: The Dashboard, portfolio summary**

### Scene 2 — Portfolio monitoring (0:14–0:34)
- **Action:** Cursor clicks **Portfolio** → lease register fills (IndiGo,
  Aeromexico, …); hover a row to reveal fleet/valuation; switch to the
  **Concentration** heatmap.
- **VO:** "Start with the portfolio: your full lease register, fleet and
  valuations, lessee concentration, and maturity profile — live, not in a
  spreadsheet. Every aircraft, every lease, every counterparty in one view."
- **Captions:** *Lease register · Fleet & valuations · Concentration · Maturity*

### Scene 3 — Risk & ECL / IFRS 9 (0:34–0:57)
- **Action:** Cursor clicks **Risk & ECL** → Stage 1/2/3 distribution bars fill;
  `ECL = PD × LGD × EAD` highlights; the IndiGo row expands (EAD $24.2M,
  lifetime PD 0.85, LGD 0.45 → **ECL $4.2M**); **SICR triggers** light up
  (47 DPD, country watchlist).
- **VO:** "Underneath is a full IFRS 9 engine — expected credit loss computed
  per lease, with automatic stage classification. When a lessee crosses a
  threshold, the platform moves it to Stage 3 and shows you exactly why. This
  is the audit-ready number, not a manual estimate."
- **Captions:** *IFRS 9 ECL · automatic staging · SICR triggers · audit trail*

### Scene 4 — Scenarios: Library + Custom Builder (0:57–1:26)
- **Action:** Cursor clicks **Scenarios** → lands on the **Library** tab
  (ready-made stress templates) → picks one → opens the **Custom Builder**:
  drags the **Fuel +40%** slider, flips to **JSON (DSL)** mode, sets weights
  60/25/15, the **validation checklist** ticks green, clicks **Run** → results
  animate **Base $47.2M / Adverse / Severe**; the **run-history tree** sprouts
  a child branch.
- **VO:** "Then stress it. Start from the scenario library — fifty-plus
  ready-made stress templates — or build your own: tune the macro inputs with
  sliders, or write the scenario directly as JSON. A fuel spike, a recession, a
  deferral wave — run across the whole book in one click. Every run is saved,
  branchable, and fully traceable — the audit trail regulators actually ask
  for."
- **Captions:** **Scenario Library · ready-made stress templates** →
  **Custom Scenario Builder · sliders or JSON (DSL)** →
  *One-click run · immutable, branchable history*

### Scene 5 — Lessee credit risk + AI layer (1:26–1:53)
- **Action:** Cursor clicks **Intelligence** → **Lessee Radar** (IndiGo /
  Aeromexico **RED**, composite scores; others amber/green; signal feed) → then
  clicks the **AI** pill → types *"Which lessees are highest risk and why?"* →
  the answer streams and **drafts a board-pack paragraph**.
- **VO:** "AeroInsights doesn't just hold your data — it reads it. It scores
  every lessee on operational and credit signals, so you know who's in trouble
  before they call you. And the AI layer ties it together: ask a question in
  plain English, and it summarises the book, flags the risks, and drafts the
  write-up for your board pack."
- **Captions:** *Lessee Radar · live risk scoring · AI: ask · summarise · draft*

### Scene 6 — Lease Rate Outlook (1:53–2:08)
- **Action:** Cursor clicks **Rate Outlook** → a forward lease-rate curve draws
  on; hover a point to reveal a value.
- **VO:** "It looks forward too — lease-rate outlook with forward curves, so you
  can price the next deal against where the market's heading."
- **Caption:** *Lease Rate Outlook · forward-curve analytics*

### Scene 7 — Excel Add-In (2:08–2:20)
- **Action:** Cut to an **Excel-like** view; a cell `=AI.Portfolio("fleet_size")`
  resolves; live data flows in from the platform.
- **VO:** "And if your team lives in Excel, the add-in pulls this same live data
  straight into a spreadsheet — no exports, no API wrangling."
- **Caption:** *Excel Add-In · live data, =AI.Portfolio(…)*

### Scene 8 — Close: social proof + CTA (2:20–2:40)
- **Action:** Screens collapse into the logo on an Oxford Blue field;
  social-proof logos fade in (Aerfin · ELFC · EY · Grant Thornton · KPMG); a
  CTA card resolves.
- **VO:** "I built AeroInsights from scratch and refined it with teams at
  Aerfin, ELFC and EY. Signup takes seconds — take a look, and tell me what you
  think."
- **Captions:** *Sign up in seconds — email or Google · aeroinsights.vercel.app ·
  Book a demo · Tanam Sethi*

**Coverage check:** Portfolio · Risk & ECL (IFRS 9) · Scenarios/stress (Library
+ Custom Builder) · Lessee credit risk · AI layer · Rate Outlook · Excel Add-In ✅.
Differentiators woven in: automatic SICR staging, immutable/branchable audit
trail, operational+credit signals, AI summarise/draft, the Lessee Intelligence
Map. Light founder + social-proof close ✅. VO ≈ 360 words.

---

## 5. Technical architecture

### 5.1 Isolation
Build as a **standalone workspace** at **`packages/demo-video/`** with its own
`package.json`. Rationale: Remotion's deps never touch the app; zero coupling
to Auth0/Supabase. Screens are **pure presentational replicas** built from the
design tokens — live app code is **not** imported.

### 5.2 Stack
- **Remotion 4.x** (`remotion`, `@remotion/cli`).
- **Tailwind v4** via `@remotion/tailwind-v4` (mirrors the app's utility classes).
- **Geist** via `@remotion/google-fonts/Geist` (loaded with `delayRender`).
- **lucide-react** for icons (already used by the app; Remotion-safe).
- **d3-geo** + **topojson-client** for the globe (already repo deps), with a
  **bundled** `countries-110m.json` placed in `public/` (no network fetch at
  render time).
- Composition: **1920×1080 @ 30fps, ≈4,800 frames**.

### 5.3 Determinism (hard constraint)
Every animation derives from `useCurrentFrame()`. **Do NOT use `framer-motion`
or `recharts`** — both animate on their own clock and render
non-deterministically under Remotion's frame-by-frame renderer. All charts and
the globe are hand-built (SVG / d3-geo) and driven by `interpolate` / `spring`.
This guarantees frame-identical renders.

### 5.4 Project structure
```
packages/demo-video/
  package.json
  remotion.config.ts
  tailwind config (v4 via @remotion/tailwind-v4)
  src/
    Root.tsx              # registerRoot; <Composition id="AeroInsightsDemo">
    DemoVideo.tsx         # <Series> of 8 scenes over a persistent shell
    theme/tokens.ts       # brand colours, fonts, easing constants
    data/portfolio.ts     # typed constants generated from the sample xlsx
    timeline/
      cursor.ts           # [{frame, x, y, click}] keyframe path
      captions.ts         # [{from, to, text}] caption track
      voiceover.md        # timed first-person founder script (for recording)
    components/
      AppShell.tsx, Sidebar.tsx, Cursor.tsx, Caption.tsx, Camera.tsx
      charts/ CountUp.tsx, AnimatedBars.tsx, AnimatedLine.tsx,
              ScenarioTree.tsx, Globe.tsx
    screens/
      Dashboard.tsx, Portfolio.tsx, RiskECL.tsx, ScenarioLibrary.tsx,
      ScenarioBuilder.tsx, Intelligence.tsx, AIPanel.tsx,
      RateOutlook.tsx, ExcelView.tsx, CTA.tsx
  public/
    countries-110m.json, music.mp3, logo.png, partner logos
  out/
    aeroinsights-demo.mp4
```

### 5.5 Key systems
- **Continuous shell + camera:** scenes 1–6 share one mounted `<AppShell>`. The
  active route, sidebar highlight, active tab, slider values, and typed AI text
  are all **derived from frame**. A `<Camera>` applies subtle zoom/pan
  (transform only) to emphasise moments (KPI count-up, IndiGo row expand,
  scenario tree). Scenes 7 (Excel) and 8 (CTA) are full cuts.
- **Cursor system:** `<Cursor>` reads the keyframe path from `timeline/cursor.ts`;
  smooth `interpolate` movement easing into each target, with a click-ripple on
  `click` frames. Click frames are the single source that drives the
  corresponding UI state change — this sells the "live screen-share."
- **Globe:** replicate the app's `WatchlistGlobe` — `geoOrthographic` +
  `geoPath`, rotation driven by frame (`rotate([-angle, -15])`), watchlist
  countries filled by status colour, pulsing centroid markers (India, Mexico,
  etc.).
- **Data:** a one-time script parses `AeroInsights_SamplePortfolio_2026.xlsx`
  into typed constants in `data/portfolio.ts` (Aer Capital Partners; IndiGo /
  Aeromexico; ECL $47.2M base; IFRS 9 figures) so screens are accurate and
  deterministic.
- **Captions:** brand-styled lower-thirds; `opacity 0→1` + `y 8→0`, ≤500ms,
  conservative ease.
- **Audio:** `<Audio>` music bed in `public/`, ducked ~−12 dB under VO regions.
  VO is a later layer added as `<Audio src="vo.mp3">`; `voiceover.md` holds the
  timed script, and the build is paced to it via the caption track now.

### 5.6 Output & verification
- `npm run studio` — Remotion Studio preview during development.
- `npm run render` → `out/aeroinsights-demo.mp4` (H.264, 1080p).
- **Verification:** render still frames at each scene's midpoint (via
  `@remotion/renderer` or Studio) and eyeball them before the full render;
  confirm fonts, brand colours, data values, cursor positions, and caption
  timing.

---

## 6. Deliverables
1. The `packages/demo-video/` Remotion project.
2. A timed `voiceover.md` founder script for Tanam to record.
3. A rendered `out/aeroinsights-demo.mp4` (1920×1080, ~2:40).

---

## 7. Open items / dependencies
- **Voiceover audio:** Tanam records after the build; timings are estimated from
  the caption track and nudged once the real VO exists.
- **Music track:** a royalty-free "calm corporate" bed must be chosen and placed
  in `public/music.mp3` (licence noted in `ATTRIBUTIONS.md`).
- **Partner logos:** reuse the existing assets in `public/logos/` for the close.
- **Distressed-book framing:** the sample portfolio is deliberately stressed
  (multiple Stage 3 / Red lessees). This is intentional — it demonstrates the
  ECL / SICR / stress engine working — but worth a conscious confirmation that
  it reads well in a sales context.

---

## 8. Out of scope
- Capturing the live (authenticated) app.
- Deal Generator and Maintenance Forecasting screens.
- Additional aspect-ratio cuts (square / vertical) — 16:9 master only for now.
- Final VO recording and music licensing/selection (handled by the founder).
