# AeroInsights Intro / Demo Video (Remotion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a ~2:40, 1920×1080 founder-led product demo of AeroInsights as a standalone Remotion project that rebuilds the app UI as deterministic React components and renders to `out/aeroinsights-demo.mp4`.

**Architecture:** A self-contained workspace at `packages/demo-video/` with zero coupling to the live app. One persistent `<AppShell>` is navigated by a frame-driven animated cursor across scenes 1–6 (Dashboard → Portfolio → Risk&ECL → Scenarios → Intelligence/AI → Rate Outlook), followed by hard-cut Excel and CTA scenes. Every animation derives from `useCurrentFrame()` — no `framer-motion`, no `recharts` (non-deterministic). Pure logic (data parsing, cursor/caption/count-up math) is unit-tested with Vitest; visual components are verified by rendering still frames.

**Tech Stack:** Remotion 4.x, React 18, TypeScript, Tailwind v4 (`@remotion/tailwind-v4`), `@remotion/google-fonts/Geist`, `d3-geo` + `topojson-client` (globe), `lucide-react` (icons), Vitest (logic tests).

**Reference spec:** `docs/superpowers/specs/2026-06-15-intro-demo-video-design.md` — read it first; the shot-by-shot script (§4) is the authority for scene content, VO, and captions.

---

## Conventions

- All paths are relative to the repo root unless noted.
- Run all `npm`/`npx` commands from inside `packages/demo-video/` unless the step says otherwise.
- 30 fps. Frame for time `m:ss` = `(m*60 + ss) * 30`. Scene boundaries (frames): S1 0–420, S2 420–1020, S3 1020–1710, S4 1710–2580, S5 2580–3390, S6 3390–3840, S7 3840–4200, S8 4200–4800. Total **4800 frames**.
- Commit after every task with the message shown in its final step.
- **STYLING — inline styles only (no Tailwind).** A diagnostic render in this Remotion 4.x setup proved Tailwind v4 utility classes (`flex`, `grid`, `bg-*`, `text-*`, etc., including arbitrary values) produce **no** styling — the stylesheet is not applied at render time, and `@source` did not fix it. Therefore every component uses **inline `style={{…}}` objects only**, following the pattern established in `src/components/AppShell.tsx` and `src/components/Sidebar.tsx`. The code blocks in Tasks 6–13 below were originally written with Tailwind `className`s; when implementing, translate each `className` to the equivalent inline `style` (using `COLORS`/tokens for brand values). Keep all animation/data/frame logic (interpolate/spring calls, data values, layout intent) exactly as specified — only the styling mechanism changes. The Tailwind plumbing (`@import "tailwindcss"`, `enableTailwind`) is left in place but inert; do not rely on it. Verify each screen with a still render.

---

## File structure

```
packages/demo-video/
  package.json              # T1  isolated workspace deps + scripts
  tsconfig.json             # T1
  remotion.config.ts        # T1  enableTailwind + video settings
  src/index.css             # T1  @import "tailwindcss"
  src/index.ts              # T1  registerRoot(Root)
  src/Root.tsx              # T1  <Composition id="AeroInsightsDemo">
  src/DemoVideo.tsx         # T13 assembles the 8 scenes + cursor + captions + audio
  src/theme/tokens.ts       # T2  brand colours, easing, font family
  src/theme/fonts.ts        # T2  Geist load + delayRender
  src/data/portfolio.ts     # T3  typed constants generated from the sample xlsx
  src/data/portfolio.test.ts# T3
  scripts/gen-data.mjs      # T3  one-time xlsx -> portfolio.ts generator
  src/timeline/cursor.ts    # T4  keyframe path + position(frame) + click state
  src/timeline/cursor.test.ts# T4
  src/timeline/captions.ts  # T5  caption track + captionAt(frame)
  src/timeline/captions.test.ts# T5
  src/timeline/voiceover.md # T13 timed founder VO script (for recording)
  src/components/Cursor.tsx  # T6
  src/components/Caption.tsx # T6
  src/components/Camera.tsx  # T6
  src/components/AppShell.tsx# T7
  src/components/Sidebar.tsx # T7
  src/components/charts/CountUp.tsx      # T8
  src/components/charts/CountUp.test.ts  # T8
  src/components/charts/AnimatedBars.tsx # T8
  src/components/charts/AnimatedLine.tsx # T9
  src/components/charts/ScenarioTree.tsx # T9
  src/components/charts/Globe.tsx        # T9
  src/screens/Dashboard.tsx       # T10
  src/screens/Portfolio.tsx       # T10
  src/screens/RiskECL.tsx         # T11
  src/screens/ScenarioLibrary.tsx # T11
  src/screens/ScenarioBuilder.tsx # T11
  src/screens/Intelligence.tsx    # T12
  src/screens/AIPanel.tsx         # T12
  src/screens/RateOutlook.tsx     # T12
  src/screens/ExcelView.tsx       # T12
  src/screens/CTA.tsx             # T12
  public/countries-110m.json # T9  bundled world atlas (no network at render)
  public/music.mp3           # T13 placeholder calm-corporate bed
  public/logo.png            # T1  copied from repo /public/logo.png
  out/                       # render output (gitignored)
```

---

## Task 1: Scaffold the isolated Remotion workspace

**Files:**
- Create: `packages/demo-video/package.json`
- Create: `packages/demo-video/tsconfig.json`
- Create: `packages/demo-video/remotion.config.ts`
- Create: `packages/demo-video/src/index.css`
- Create: `packages/demo-video/src/index.ts`
- Create: `packages/demo-video/src/Root.tsx`
- Create: `packages/demo-video/.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@aeroinsights/demo-video",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "studio": "remotion studio",
    "render": "remotion render AeroInsightsDemo out/aeroinsights-demo.mp4",
    "still": "remotion still AeroInsightsDemo",
    "test": "vitest run",
    "gen-data": "node scripts/gen-data.mjs"
  },
  "dependencies": {
    "@remotion/google-fonts": "4.0.378",
    "d3-geo": "^3.1.1",
    "lucide-react": "^0.487.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "remotion": "4.0.378",
    "topojson-client": "^3.1.0"
  },
  "devDependencies": {
    "@remotion/cli": "4.0.378",
    "@remotion/tailwind-v4": "4.0.378",
    "@types/d3-geo": "^3.1.0",
    "@types/react": "18.3.1",
    "@types/topojson-client": "^3.1.5",
    "tailwindcss": "4.1.12",
    "typescript": "^5.6.3",
    "vitest": "^4.1.5",
    "xlsx": "^0.18.5"
  }
}
```

> Note: keep all `remotion`/`@remotion/*` versions identical. If `npm install` reports a newer current Remotion, run `npx remotion versions` after install and align all four packages to the resolved version, then re-commit `package.json`.

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src", "scripts", "remotion.config.ts"]
}
```

- [ ] **Step 3: Create `remotion.config.ts`**

```ts
import {Config} from '@remotion/cli/config';
import {enableTailwind} from '@remotion/tailwind-v4';

Config.setVideoImageFormat('jpeg');
Config.overrideWebpackConfig((cfg) => enableTailwind(cfg));
```

- [ ] **Step 4: Create `src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 5: Create `src/index.ts`**

```ts
import './index.css';
import {registerRoot} from 'remotion';
import {Root} from './Root';

registerRoot(Root);
```

- [ ] **Step 6: Create a minimal `src/Root.tsx` (placeholder composition to verify boot)**

```tsx
import {Composition} from 'remotion';
import {AbsoluteFill} from 'remotion';

const Placeholder: React.FC = () => (
  <AbsoluteFill className="bg-[#002147] items-center justify-center">
    <span className="text-white text-6xl font-black">AeroInsights</span>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <Composition
    id="AeroInsightsDemo"
    component={Placeholder}
    durationInFrames={4800}
    fps={30}
    width={1920}
    height={1080}
  />
);
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules
out
```

- [ ] **Step 8: Install dependencies**

Run (from `packages/demo-video/`): `npm install`
Expected: completes without peer-dependency errors. If Remotion warns about version mismatch, run `npx remotion versions` and align all `remotion`/`@remotion/*` versions.

- [ ] **Step 9: Copy the logo asset**

Run (from repo root): `mkdir -p packages/demo-video/public && cp public/logo.png packages/demo-video/public/logo.png`

- [ ] **Step 10: Verify the project renders a still**

Run (from `packages/demo-video/`): `npx remotion still AeroInsightsDemo out/test-frame.png --frame=0`
Expected: `out/test-frame.png` is created showing an Oxford-Blue frame with white "AeroInsights" text. Open it to confirm.

- [ ] **Step 11: Commit**

```bash
git add packages/demo-video
git commit -m "feat(demo-video): scaffold isolated Remotion workspace"
```

---

## Task 2: Theme tokens and fonts

**Files:**
- Create: `packages/demo-video/src/theme/tokens.ts`
- Create: `packages/demo-video/src/theme/fonts.ts`

- [ ] **Step 1: Create `src/theme/tokens.ts`**

```ts
// Brand tokens mirrored from .impeccable.md and src/styles/.
export const COLORS = {
  brand: '#002147',      // Oxford Blue
  brandDeep: '#001228',
  darkBg: '#0a1a33',
  softBg: '#f4f7fd',
  surface: '#ffffff',
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  red: '#B91C1C',        // Stage 3 / critical
  amber: '#B45309',      // watch
  green: '#15803D',      // healthy
  redFill: 'rgba(185,28,28,0.30)',
  amberFill: 'rgba(180,83,9,0.28)',
  greenFill: 'rgba(21,128,61,0.25)',
} as const;

// Conservative ease-out from the brand spec (zero bounce).
export const EASE = [0.23, 1, 0.32, 1] as const;

export type RiskStatus = 'red' | 'amber' | 'green';
export const statusColor = (s: RiskStatus) =>
  s === 'red' ? COLORS.red : s === 'amber' ? COLORS.amber : COLORS.green;
export const statusFill = (s: RiskStatus) =>
  s === 'red' ? COLORS.redFill : s === 'amber' ? COLORS.amberFill : COLORS.greenFill;
```

- [ ] **Step 2: Create `src/theme/fonts.ts`**

```ts
import {loadFont} from '@remotion/google-fonts/Geist';
import {cancelRender, continueRender, delayRender} from 'remotion';

const {fontFamily} = loadFont('normal', {
  weights: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
});

export const FONT_FAMILY = fontFamily;

const handle = delayRender('Loading Geist');
loadFont()
  .waitUntilDone()
  .then(() => continueRender(handle))
  .catch((e) => cancelRender(e));
```

> If `@remotion/google-fonts/Geist` does not resolve (Geist not present in the installed version), fall back: `npm i @fontsource-variable/geist`, `import '@fontsource-variable/geist'`, set `FONT_FAMILY = "'Geist Variable', system-ui, sans-serif"`, and gate readiness on `document.fonts.ready` inside a `delayRender`/`continueRender` pair.

- [ ] **Step 3: Wire the font family into `Root.tsx`**

Replace the `Placeholder` style usage so the font applies globally. Modify `src/Root.tsx` to import the font module for its side effect and set the family on the placeholder:

```tsx
import {Composition, AbsoluteFill} from 'remotion';
import {FONT_FAMILY} from './theme/fonts';
import {COLORS} from './theme/tokens';

const Placeholder: React.FC = () => (
  <AbsoluteFill
    style={{fontFamily: FONT_FAMILY, background: COLORS.brand}}
    className="items-center justify-center"
  >
    <span className="text-white text-6xl font-black">AeroInsights</span>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <Composition
    id="AeroInsightsDemo"
    component={Placeholder}
    durationInFrames={4800}
    fps={30}
    width={1920}
    height={1080}
  />
);
```

- [ ] **Step 4: Verify the font loads in a still**

Run: `npx remotion still AeroInsightsDemo out/test-font.png --frame=0`
Expected: still renders (no `delayRender` timeout) and the "AeroInsights" text uses Geist.

- [ ] **Step 5: Commit**

```bash
git add packages/demo-video/src/theme packages/demo-video/src/Root.tsx
git commit -m "feat(demo-video): add brand tokens and Geist font loading"
```

---

## Task 3: Sample-portfolio data module (TDD)

**Files:**
- Create: `packages/demo-video/scripts/gen-data.mjs`
- Create: `packages/demo-video/src/data/portfolio.ts`
- Create: `packages/demo-video/src/data/portfolio.test.ts`

- [ ] **Step 1: Write the generator script `scripts/gen-data.mjs`**

```js
// One-time generator: parses the bundled sample xlsx into a typed TS module.
// Run from packages/demo-video/: npm run gen-data
import XLSX from 'xlsx';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const SRC = resolve(process.cwd(), '../../AeroInsights_SamplePortfolio_2026.xlsx');
const wb = XLSX.readFile(SRC);
const rows = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], {header: 1, blankrows: false});

const aircraft = rows('Aircraft Register').slice(2).map((r) => ({
  id: r[0], reg: r[1], type: r[3], operator: r[8], country: r[9],
  stage: Number(r[10]), mv: Number(r[11]), ead: Number(r[12]), rent: Number(r[13]),
})).filter((a) => a.id);

const lessees = rows('Lessee Profiles').slice(2).map((r) => ({
  id: r[0], name: r[1], country: r[3], rating: r[5], pd: Number(r[6]),
  watchlist: String(r[7] || '').toLowerCase(), stage: r[8], dpd: Number(r[9]),
})).filter((l) => l.id);

const out = `// AUTO-GENERATED by scripts/gen-data.mjs from AeroInsights_SamplePortfolio_2026.xlsx
// Do not edit by hand; re-run \`npm run gen-data\`.
export interface Aircraft { id: string; reg: string; type: string; operator: string; country: string; stage: number; mv: number; ead: number; rent: number; }
export interface Lessee { id: string; name: string; country: string; rating: string; pd: number; watchlist: string; stage: string; dpd: number; }

export const LESSOR = 'Aer Capital Partners Ltd.';
export const REPORTING_DATE = '31 May 2026';
export const AIRCRAFT: Aircraft[] = ${JSON.stringify(aircraft, null, 2)};
export const LESSEES: Lessee[] = ${JSON.stringify(lessees, null, 2)};

// Headline figures used by the Dashboard KPI strip (see spec §4).
export const KPIS = {
  portfolioValue: '$2.41B',
  fleetSize: AIRCRAFT.length,
  avgLtv: '67.3%',
  eclReserve: '$47.2M',
} as const;

// Stress scenario outputs (Stress Scenarios sheet, spec §4 Scene 4).
export const SCENARIOS = [
  {label: 'Base', value: '$47.2M', weight: 60, status: 'green' as const},
  {label: 'Adverse', value: '$58.9M', weight: 25, status: 'amber' as const},
  {label: 'Severe', value: '$71.4M', weight: 15, status: 'red' as const},
];

// One worked IFRS 9 ECL row highlighted in Scene 3.
export const ECL_HIGHLIGHT = {
  lessee: 'IndiGo Airlines', ead: '$24.2M', pdLifetime: 0.85, lgd: 0.45,
  eclLifetime: '$4.2M', dpd: 47, stage: 'Stage 3',
};
`;

writeFileSync(resolve(process.cwd(), 'src/data/portfolio.ts'), out);
console.log('Wrote src/data/portfolio.ts:', aircraft.length, 'aircraft,', lessees.length, 'lessees');
```

- [ ] **Step 2: Generate the data module**

Run (from `packages/demo-video/`): `npm run gen-data`
Expected: prints e.g. `Wrote src/data/portfolio.ts: 12 aircraft, 12 lessees` and creates `src/data/portfolio.ts`.

- [ ] **Step 3: Write the failing test `src/data/portfolio.test.ts`**

```ts
import {describe, it, expect} from 'vitest';
import {AIRCRAFT, LESSEES, KPIS, SCENARIOS, LESSOR, ECL_HIGHLIGHT} from './portfolio';

describe('portfolio data', () => {
  it('has the Aer Capital sample loaded', () => {
    expect(LESSOR).toBe('Aer Capital Partners Ltd.');
    expect(AIRCRAFT.length).toBeGreaterThanOrEqual(10);
    expect(KPIS.fleetSize).toBe(AIRCRAFT.length);
  });
  it('includes the distressed lessees used in the script', () => {
    const names = LESSEES.map((l) => l.name);
    expect(names).toContain('IndiGo Airlines');
    expect(names).toContain('Aeromexico');
  });
  it('exposes the three weighted scenarios summing to 100', () => {
    expect(SCENARIOS.map((s) => s.label)).toEqual(['Base', 'Adverse', 'Severe']);
    expect(SCENARIOS.reduce((a, s) => a + s.weight, 0)).toBe(100);
  });
  it('keeps the ECL highlight consistent with the spec', () => {
    expect(ECL_HIGHLIGHT.eclLifetime).toBe('$4.2M');
    expect(ECL_HIGHLIGHT.stage).toBe('Stage 3');
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/data/portfolio.test.ts`
Expected: PASS (4 tests). If `IndiGo`/`Aeromexico` are absent, inspect the generated `portfolio.ts` and fix the column indices in `gen-data.mjs`, re-run `npm run gen-data`, then re-run the test.

- [ ] **Step 5: Commit**

```bash
git add packages/demo-video/scripts packages/demo-video/src/data
git commit -m "feat(demo-video): generate typed sample-portfolio data with tests"
```

---

## Task 4: Cursor timeline (TDD)

**Files:**
- Create: `packages/demo-video/src/timeline/cursor.ts`
- Create: `packages/demo-video/src/timeline/cursor.test.ts`

- [ ] **Step 1: Write the failing test `src/timeline/cursor.test.ts`**

```ts
import {describe, it, expect} from 'vitest';
import {cursorAt, isClicking, CURSOR_KEYS} from './cursor';

describe('cursor timeline', () => {
  it('returns the first keyframe position before the timeline starts', () => {
    const p = cursorAt(0);
    expect(p.x).toBe(CURSOR_KEYS[0].x);
    expect(p.y).toBe(CURSOR_KEYS[0].y);
  });
  it('interpolates linearly between two keyframes', () => {
    // Between frame 0 (first key) and the next key, midpoint x is the average.
    const a = CURSOR_KEYS[0];
    const b = CURSOR_KEYS[1];
    const mid = Math.round((a.frame + b.frame) / 2);
    const p = cursorAt(mid);
    expect(p.x).toBeGreaterThan(Math.min(a.x, b.x) - 1);
    expect(p.x).toBeLessThan(Math.max(a.x, b.x) + 1);
  });
  it('flags a click within the click window of a click keyframe', () => {
    const clickKey = CURSOR_KEYS.find((k) => k.click);
    expect(clickKey).toBeDefined();
    expect(isClicking(clickKey!.frame)).toBe(true);
    expect(isClicking(clickKey!.frame + 30)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/timeline/cursor.test.ts`
Expected: FAIL with "Cannot find module './cursor'".

- [ ] **Step 3: Implement `src/timeline/cursor.ts`**

```ts
import {interpolate} from 'remotion';
import {EASE} from '../theme/tokens';

export interface CursorKey { frame: number; x: number; y: number; click?: boolean; }

// Coordinates are in 1920x1080 space. These map to the sidebar items and the
// interactive controls each scene touches (see DemoVideo layout). Tune exact
// pixels during T13 once screens exist; values here give a valid timeline.
export const CURSOR_KEYS: CursorKey[] = [
  {frame: 0, x: 960, y: 540},
  {frame: 360, x: 120, y: 220},                 // approach Portfolio (S2)
  {frame: 420, x: 120, y: 220, click: true},    // click Portfolio
  {frame: 1020, x: 120, y: 270, click: true},   // click Risk & ECL (S3)
  {frame: 1710, x: 120, y: 320, click: true},   // click Scenarios (S4)
  {frame: 1900, x: 560, y: 480, click: true},   // pick a library template
  {frame: 2100, x: 980, y: 520},                // drag fuel slider
  {frame: 2360, x: 1360, y: 760, click: true},  // Run
  {frame: 2580, x: 120, y: 370, click: true},   // click Intelligence (S5)
  {frame: 2900, x: 1680, y: 90, click: true},   // click AI pill
  {frame: 3390, x: 120, y: 470, click: true},   // click Rate Outlook (S6)
  {frame: 3840, x: 960, y: 540},                // Excel cut (S7)
  {frame: 4800, x: 960, y: 540},
];

const CLICK_WINDOW = 18; // frames a click ripple/effect is "active"

function bracket(frame: number): [CursorKey, CursorKey] {
  if (frame <= CURSOR_KEYS[0].frame) return [CURSOR_KEYS[0], CURSOR_KEYS[0]];
  for (let i = 0; i < CURSOR_KEYS.length - 1; i++) {
    if (frame >= CURSOR_KEYS[i].frame && frame <= CURSOR_KEYS[i + 1].frame) {
      return [CURSOR_KEYS[i], CURSOR_KEYS[i + 1]];
    }
  }
  const last = CURSOR_KEYS[CURSOR_KEYS.length - 1];
  return [last, last];
}

export function cursorAt(frame: number): {x: number; y: number} {
  const [a, b] = bracket(frame);
  if (a.frame === b.frame) return {x: a.x, y: a.y};
  const t = (frame - a.frame) / (b.frame - a.frame);
  const x = interpolate(t, [0, 1], [a.x, b.x], {easing: (n) => bezier(n)});
  const y = interpolate(t, [0, 1], [a.y, b.y], {easing: (n) => bezier(n)});
  return {x, y};
}

export function isClicking(frame: number): boolean {
  return CURSOR_KEYS.some((k) => k.click && frame >= k.frame && frame < k.frame + CLICK_WINDOW);
}

// Minimal cubic-bezier(0.23,1,0.32,1) evaluator for easing the cursor.
function bezier(t: number): number {
  const [x1, y1, x2, y2] = EASE;
  let u = t;
  for (let i = 0; i < 5; i++) {
    const x = bez(u, x1, x2) - t;
    const d = bezDeriv(u, x1, x2);
    if (Math.abs(d) < 1e-6) break;
    u -= x / d;
  }
  return bez(u, y1, y2);
}
const bez = (t: number, a: number, b: number) =>
  3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
const bezDeriv = (t: number, a: number, b: number) =>
  3 * (1 - t) ** 2 * a + 6 * (1 - t) * t * (b - a) + 3 * t ** 2 * (1 - b);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/timeline/cursor.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/demo-video/src/timeline/cursor.ts packages/demo-video/src/timeline/cursor.test.ts
git commit -m "feat(demo-video): add frame-driven cursor timeline with tests"
```

---

## Task 5: Caption track (TDD)

**Files:**
- Create: `packages/demo-video/src/timeline/captions.ts`
- Create: `packages/demo-video/src/timeline/captions.test.ts`

- [ ] **Step 1: Write the failing test `src/timeline/captions.test.ts`**

```ts
import {describe, it, expect} from 'vitest';
import {CAPTIONS, captionAt} from './captions';

describe('caption track', () => {
  it('opens with the approved dashboard caption', () => {
    expect(captionAt(60)).toBe('AeroInsights: The Dashboard, portfolio summary');
  });
  it('returns null in gaps between captions', () => {
    const sorted = [...CAPTIONS].sort((a, b) => a.from - b.from);
    // A frame after the last caption ends has no caption.
    const last = sorted[sorted.length - 1];
    expect(captionAt(last.to + 1)).toBeNull();
  });
  it('shows the Custom Builder caption during Scene 4', () => {
    const any = CAPTIONS.some((c) => c.text.includes('Custom Scenario Builder'));
    expect(any).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/timeline/captions.test.ts`
Expected: FAIL with "Cannot find module './captions'".

- [ ] **Step 3: Implement `src/timeline/captions.ts`**

```ts
export interface CaptionCue { from: number; to: number; text: string; }

// Frames at 30fps. Text per spec §4 (captions column).
export const CAPTIONS: CaptionCue[] = [
  {from: 30, to: 410, text: 'AeroInsights: The Dashboard, portfolio summary'},
  {from: 440, to: 1000, text: 'Lease register · Fleet & valuations · Concentration · Maturity'},
  {from: 1040, to: 1690, text: 'IFRS 9 ECL · automatic staging · SICR triggers · audit trail'},
  {from: 1730, to: 1990, text: 'Scenario Library · ready-made stress templates'},
  {from: 2000, to: 2320, text: 'Custom Scenario Builder · sliders or JSON (DSL)'},
  {from: 2330, to: 2560, text: 'One-click run · immutable, branchable history'},
  {from: 2600, to: 3370, text: 'Lessee Radar · live risk scoring · AI: ask · summarise · draft'},
  {from: 3410, to: 3820, text: 'Lease Rate Outlook · forward-curve analytics'},
  {from: 3860, to: 4180, text: 'Excel Add-In · live data, =AI.Portfolio(…)'},
  {from: 4230, to: 4780, text: 'Sign up in seconds · aeroinsights.vercel.app · Book a demo'},
];

export function captionAt(frame: number): string | null {
  const cue = CAPTIONS.find((c) => frame >= c.from && frame <= c.to);
  return cue ? cue.text : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/timeline/captions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/demo-video/src/timeline/captions.ts packages/demo-video/src/timeline/captions.test.ts
git commit -m "feat(demo-video): add caption track with tests"
```

---

## Task 6: Visual primitives — Cursor, Caption, Camera

**Files:**
- Create: `packages/demo-video/src/components/Cursor.tsx`
- Create: `packages/demo-video/src/components/Caption.tsx`
- Create: `packages/demo-video/src/components/Camera.tsx`

- [ ] **Step 1: Implement `src/components/Cursor.tsx`**

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {cursorAt, isClicking, CURSOR_KEYS} from '../timeline/cursor';

export const Cursor: React.FC = () => {
  const frame = useCurrentFrame();
  const {x, y} = cursorAt(frame);
  const clicking = isClicking(frame);
  const clickKey = CURSOR_KEYS.find((k) => k.click && frame >= k.frame && frame < k.frame + 18);
  const ripple = clickKey ? interpolate(frame - clickKey.frame, [0, 18], [0, 1], {extrapolateRight: 'clamp'}) : 0;

  return (
    <div style={{position: 'absolute', left: x, top: y, transform: 'translate(-4px,-2px)', zIndex: 50}}>
      {clickKey && (
        <div
          style={{
            position: 'absolute', left: 0, top: 0, transform: `translate(-50%,-50%) scale(${0.4 + ripple * 1.6})`,
            width: 40, height: 40, borderRadius: 9999, border: '2px solid #002147',
            opacity: 1 - ripple,
          }}
        />
      )}
      {/* Arrow cursor */}
      <svg width="26" height="26" viewBox="0 0 24 24" style={{filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))', transform: clicking ? 'scale(0.9)' : 'scale(1)'}}>
        <path d="M5 3l14 8-6 1.5L10.5 19 5 3z" fill="#0f172a" stroke="#fff" strokeWidth="1.2" />
      </svg>
    </div>
  );
};
```

- [ ] **Step 2: Implement `src/components/Caption.tsx`**

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {captionAt, CAPTIONS} from '../timeline/captions';
import {COLORS} from '../theme/tokens';

export const Caption: React.FC = () => {
  const frame = useCurrentFrame();
  const text = captionAt(frame);
  if (!text) return null;
  const cue = CAPTIONS.find((c) => frame >= c.from && frame <= c.to)!;
  const enter = interpolate(frame - cue.from, [0, 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const exit = interpolate(cue.to - frame, [0, 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const opacity = Math.min(enter, exit);
  const y = interpolate(enter, [0, 1], [8, 0]);

  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 70, display: 'flex', justifyContent: 'center', zIndex: 40}}>
      <div
        style={{
          opacity, transform: `translateY(${y}px)`,
          background: 'rgba(255,255,255,0.94)', color: COLORS.brand,
          border: `1px solid ${COLORS.line}`, borderRadius: 9999,
          padding: '12px 26px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em',
          boxShadow: '0 8px 30px rgba(0,33,71,0.12)',
        }}
      >
        {text}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Implement `src/components/Camera.tsx`**

```tsx
import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';
import {EASE} from '../theme/tokens';

export interface CameraMove { from: number; to: number; scale: number; x: number; y: number; }

// Applies subtle zoom/pan (transform only) to its children. Identity outside moves.
export const Camera: React.FC<{moves: CameraMove[]; children: React.ReactNode}> = ({moves, children}) => {
  const frame = useCurrentFrame();
  const active = moves.find((m) => frame >= m.from && frame <= m.to);
  let scale = 1, tx = 0, ty = 0;
  if (active) {
    const half = (active.from + active.to) / 2;
    // Ease in to the move's peak, then back out — gentle, never abrupt.
    const p = frame <= half
      ? interpolate(frame, [active.from, half], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
      : interpolate(frame, [half, active.to], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const e = cubic(p);
    scale = 1 + (active.scale - 1) * e;
    tx = active.x * e;
    ty = active.y * e;
  }
  return (
    <div style={{position: 'absolute', inset: 0, transform: `scale(${scale}) translate(${tx}px,${ty}px)`, transformOrigin: 'center'}}>
      {children}
    </div>
  );
};

function cubic(t: number): number {
  const [, y1, , y2] = EASE;
  return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3;
}
```

- [ ] **Step 4: Render-verify the cursor + caption (temporary harness)**

Temporarily set `Root.tsx`'s `Placeholder` to render `<Cursor/>` and `<Caption/>` over a white `AbsoluteFill`, then:
Run: `npx remotion still AeroInsightsDemo out/test-primitives.png --frame=60`
Expected: a cursor arrow near (120,220→ along path) and the dashboard caption pill at the bottom. Revert `Root.tsx` after confirming.

- [ ] **Step 5: Commit**

```bash
git add packages/demo-video/src/components
git commit -m "feat(demo-video): add Cursor, Caption and Camera primitives"
```

---

## Task 7: App shell + sidebar

**Files:**
- Create: `packages/demo-video/src/components/Sidebar.tsx`
- Create: `packages/demo-video/src/components/AppShell.tsx`

- [ ] **Step 1: Implement `src/components/Sidebar.tsx`**

```tsx
import {LayoutGrid, Table2, ShieldCheck, SlidersHorizontal, BrainCircuit, LineChart, FileText} from 'lucide-react';
import {COLORS} from '../theme/tokens';

export type Route = 'dashboard' | 'portfolio' | 'risk' | 'scenarios' | 'intelligence' | 'rate' | 'reports';

const ITEMS: {key: Route; label: string; Icon: React.FC<any>}[] = [
  {key: 'dashboard', label: 'Dashboard', Icon: LayoutGrid},
  {key: 'portfolio', label: 'Portfolio', Icon: Table2},
  {key: 'risk', label: 'Risk & ECL', Icon: ShieldCheck},
  {key: 'scenarios', label: 'Scenarios', Icon: SlidersHorizontal},
  {key: 'intelligence', label: 'Intelligence', Icon: BrainCircuit},
  {key: 'rate', label: 'Rate Outlook', Icon: LineChart},
  {key: 'reports', label: 'Reports', Icon: FileText},
];

export const Sidebar: React.FC<{active: Route}> = ({active}) => (
  <div style={{width: 240, background: COLORS.surface, borderRight: `1px solid ${COLORS.line}`}} className="flex flex-col p-3 gap-1">
    <div className="flex items-center gap-2.5 px-2 py-3 mb-2">
      <div style={{background: COLORS.brand}} className="size-8 rounded-lg flex items-center justify-center">
        <img src={require('remotion').staticFile('logo.png')} alt="" className="size-5 object-contain" />
      </div>
      <span style={{color: COLORS.ink}} className="font-extrabold tracking-tight text-lg">AeroInsights</span>
    </div>
    {ITEMS.map(({key, label, Icon}) => {
      const on = key === active;
      return (
        <div
          key={key}
          style={{background: on ? COLORS.brand : 'transparent', color: on ? '#fff' : COLORS.muted}}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium"
        >
          <Icon size={18} />
          {label}
        </div>
      );
    })}
  </div>
);
```

> Note: `staticFile` must be imported normally. Replace the inline `require('remotion').staticFile` with a top import `import {staticFile} from 'remotion';` and use `src={staticFile('logo.png')}`. (Shown inline above only to keep the snippet together — use the top-level import.)

- [ ] **Step 2: Implement `src/components/AppShell.tsx`**

```tsx
import {AbsoluteFill} from 'remotion';
import {Sidebar, Route} from './Sidebar';
import {COLORS} from '../theme/tokens';
import {LESSOR, REPORTING_DATE} from '../data/portfolio';

export const AppShell: React.FC<{active: Route; title: string; children: React.ReactNode}> = ({active, title, children}) => (
  <AbsoluteFill style={{background: COLORS.softBg}}>
    <div className="flex h-full">
      <Sidebar active={active} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div style={{background: COLORS.surface, borderBottom: `1px solid ${COLORS.line}`}} className="flex items-center justify-between px-7 py-4">
          <div>
            <p style={{color: COLORS.ink}} className="text-xl font-bold">{title}</p>
            <p style={{color: COLORS.muted}} className="text-sm">{LESSOR} · {REPORTING_DATE}</p>
          </div>
          <div style={{background: COLORS.brand}} className="flex items-center gap-2 rounded-full px-4 py-2 text-white text-sm font-semibold">
            <span className="size-2 rounded-full bg-emerald-400" /> AI
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-hidden p-7">{children}</div>
      </div>
    </div>
  </AbsoluteFill>
);
```

- [ ] **Step 3: Fix the `staticFile` import in `Sidebar.tsx`**

Add `import {staticFile} from 'remotion';` at the top of `Sidebar.tsx` and set the logo `src={staticFile('logo.png')}`. Remove the inline `require(...)`.

- [ ] **Step 4: Render-verify the shell**

Temporarily point `Root.tsx`'s component at a wrapper that renders `<AppShell active="dashboard" title="Dashboard"><div/></AppShell>`, then:
Run: `npx remotion still AeroInsightsDemo out/test-shell.png --frame=0`
Expected: sidebar with 7 items (Dashboard highlighted Oxford Blue), top bar showing "Aer Capital Partners Ltd. · 31 May 2026". Revert `Root.tsx`.

- [ ] **Step 5: Commit**

```bash
git add packages/demo-video/src/components/Sidebar.tsx packages/demo-video/src/components/AppShell.tsx
git commit -m "feat(demo-video): add AppShell and Sidebar"
```

---

## Task 8: Chart primitives — CountUp (TDD) + AnimatedBars

**Files:**
- Create: `packages/demo-video/src/components/charts/CountUp.tsx`
- Create: `packages/demo-video/src/components/charts/CountUp.test.ts`
- Create: `packages/demo-video/src/components/charts/AnimatedBars.tsx`

- [ ] **Step 1: Write the failing test `src/components/charts/CountUp.test.ts`**

```ts
import {describe, it, expect} from 'vitest';
import {countValue} from './CountUp';

describe('countValue', () => {
  // Signature: countValue(target, frame, start, dur)
  it('is 0 at the start frame', () => {
    expect(countValue(100, 30, 30, 30)).toBe(0); // frame === start
  });
  it('reaches the target at the end frame', () => {
    expect(countValue(100, 60, 30, 30)).toBe(100); // frame === start + dur
  });
  it('clamps before start and after end', () => {
    expect(countValue(100, 5, 10, 30)).toBe(0);
    expect(countValue(100, 999, 10, 30)).toBe(100);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/charts/CountUp.test.ts`
Expected: FAIL with "Cannot find module './CountUp'".

- [ ] **Step 3: Implement `src/components/charts/CountUp.tsx`**

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {EASE} from '../../theme/tokens';

// Pure helper (tested): value at `frame`, ramping target over [start, start+dur].
export function countValue(target: number, frame: number, start: number, dur: number): number {
  return interpolate(frame, [start, start + dur], [0, target], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export const CountUp: React.FC<{
  target: number; start: number; dur?: number;
  prefix?: string; suffix?: string; decimals?: number; className?: string; style?: React.CSSProperties;
}> = ({target, start, dur = 30, prefix = '', suffix = '', decimals = 0, className, style}) => {
  const frame = useCurrentFrame();
  const v = countValue(target, frame, start, dur);
  return <span className={className} style={style}>{prefix}{v.toFixed(decimals)}{suffix}</span>;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/charts/CountUp.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `src/components/charts/AnimatedBars.tsx`**

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS} from '../../theme/tokens';

// Bars that grow from 0 to their value over [start, start+dur].
export const AnimatedBars: React.FC<{
  data: {label: string; value: number; color?: string}[];
  start: number; dur?: number; height?: number;
}> = ({data, start, dur = 24, height = 180}) => {
  const frame = useCurrentFrame();
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return (
    <div className="flex items-end gap-3" style={{height}}>
      {data.map((d, i) => {
        const grow = interpolate(frame, [start + i * 3, start + i * 3 + dur], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-2">
            <div
              style={{
                height: `${(d.value / max) * 100 * grow}%`,
                width: '100%', borderRadius: '6px 6px 0 0',
                background: d.color ?? COLORS.brand,
              }}
            />
            <span style={{color: COLORS.muted}} className="text-xs">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 6: Commit**

```bash
git add packages/demo-video/src/components/charts/CountUp.tsx packages/demo-video/src/components/charts/CountUp.test.ts packages/demo-video/src/components/charts/AnimatedBars.tsx
git commit -m "feat(demo-video): add CountUp (tested) and AnimatedBars chart primitives"
```

---

## Task 9: Chart primitives — AnimatedLine, ScenarioTree, Globe

**Files:**
- Create: `packages/demo-video/src/components/charts/AnimatedLine.tsx`
- Create: `packages/demo-video/src/components/charts/ScenarioTree.tsx`
- Create: `packages/demo-video/src/components/charts/Globe.tsx`
- Create: `packages/demo-video/public/countries-110m.json` (downloaded)

- [ ] **Step 1: Bundle the world atlas (no network at render time)**

Run (from `packages/demo-video/`):
`curl -L -o public/countries-110m.json https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`
Expected: ~110 KB JSON file created. Confirm with `head -c 60 public/countries-110m.json` (should start with `{"type":"Topology"`).

- [ ] **Step 2: Implement `src/components/charts/AnimatedLine.tsx`**

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS} from '../../theme/tokens';

// Draws an SVG polyline progressively over [start, start+dur] using stroke-dash.
export const AnimatedLine: React.FC<{
  points: number[]; start: number; dur?: number; width?: number; height?: number; color?: string;
}> = ({points, start, dur = 40, width = 700, height = 240, color = COLORS.brand}) => {
  const frame = useCurrentFrame();
  const max = Math.max(...points), min = Math.min(...points);
  const sx = width / (points.length - 1);
  const norm = (v: number) => height - ((v - min) / (max - min || 1)) * (height - 20) - 10;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * sx} ${norm(p)}`).join(' ');
  const draw = interpolate(frame, [start, start + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <svg width={width} height={height}>
      <path d={d} fill="none" stroke={color} strokeWidth={3}
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    </svg>
  );
};
```

- [ ] **Step 3: Implement `src/components/charts/ScenarioTree.tsx`**

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS, statusColor, RiskStatus} from '../../theme/tokens';

// A root run that sprouts child branches (sensitivity variants) over time.
export const ScenarioTree: React.FC<{
  nodes: {label: string; value: string; status: RiskStatus}[]; start: number;
}> = ({nodes, start}) => {
  const frame = useCurrentFrame();
  return (
    <div className="relative" style={{height: 220, width: 360}}>
      {/* Root */}
      <div style={{position: 'absolute', left: 0, top: 90, background: COLORS.brand}} className="text-white rounded-lg px-4 py-2 text-sm font-semibold">
        Run · Base
      </div>
      {nodes.map((n, i) => {
        const appear = interpolate(frame, [start + i * 14, start + i * 14 + 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const ty = (i - (nodes.length - 1) / 2) * 70;
        return (
          <div key={n.label} style={{opacity: appear}}>
            <svg style={{position: 'absolute', left: 130, top: 105}} width="90" height={Math.abs(ty) + 4}>
              <path d={`M 0 ${ty < 0 ? Math.abs(ty) : 0} C 45 ${ty < 0 ? Math.abs(ty) : 0}, 45 ${ty < 0 ? 0 : ty}, 90 ${ty < 0 ? 0 : ty}`}
                fill="none" stroke={COLORS.line} strokeWidth="2" />
            </svg>
            <div style={{position: 'absolute', left: 230, top: 96 + ty, borderColor: statusColor(n.status)}}
              className="bg-white border rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm">
              <span style={{color: statusColor(n.status)}}>{n.label}</span> <b>{n.value}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Implement `src/components/charts/Globe.tsx`**

```tsx
import {useMemo} from 'react';
import {useCurrentFrame, interpolate, staticFile, delayRender, continueRender} from 'remotion';
import {useState, useEffect} from 'react';
import {geoOrthographic, geoPath, geoGraticule} from 'd3-geo';
import {feature} from 'topojson-client';
import {COLORS, statusColor, statusFill, RiskStatus} from '../../theme/tokens';

const COUNTRY_ISO: Record<string, number> = {
  India: 356, Mexico: 484, Brazil: 76, 'Sri Lanka': 144, Canada: 124, UAE: 784,
  Ireland: 372, Germany: 276, France: 250, 'United Kingdom': 826, Singapore: 702,
  'United States': 840, Australia: 36, Japan: 392, China: 156,
};
const CENTROID: Record<string, [number, number]> = {
  India: [79, 21], Mexico: [-102, 24], Brazil: [-52, -14], 'Sri Lanka': [81, 8],
  Ireland: [-8, 53], 'United Kingdom': [-3, 55], Singapore: [104, 1], 'United States': [-98, 39],
};

export const Globe: React.FC<{
  size?: number;
  markers: {country: string; status: RiskStatus}[];
}> = ({size = 460, markers}) => {
  const frame = useCurrentFrame();
  const [world, setWorld] = useState<any>(null);

  useEffect(() => {
    const h = delayRender('Loading world atlas');
    fetch(staticFile('countries-110m.json'))
      .then((r) => r.json())
      .then((topo) => { setWorld(feature(topo, topo.objects.countries)); continueRender(h); });
  }, []);

  const rotateLon = interpolate(frame, [0, 420], [-70, -40]); // slow drift during Scene 1
  const proj = useMemo(() => geoOrthographic().scale(size / 2 - 6).translate([size / 2, size / 2]).rotate([rotateLon, -15]), [rotateLon, size]);
  const path = geoPath(proj) as any;
  const flagged = new Map(markers.map((m) => [COUNTRY_ISO[m.country], m.status]));

  if (!world) return <div style={{width: size, height: size}} />;

  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} fill="#eef3fb" stroke={COLORS.line} />
      <path d={path(geoGraticule()()) || ''} fill="none" stroke="rgba(0,33,71,0.08)" />
      {world.features.map((f: any, i: number) => {
        const id = Number(f.id);
        const st = flagged.get(id) as RiskStatus | undefined;
        return <path key={i} d={path(f) || ''} fill={st ? statusFill(st) : '#dbe5f4'} stroke="#c3d2e8" strokeWidth={0.5} />;
      })}
      {markers.map((m) => {
        const c = CENTROID[m.country];
        if (!c) return null;
        const pt = proj(c);
        if (!pt) return null;
        const pulse = 1 + 0.4 * Math.sin((frame / 12) + COUNTRY_ISO[m.country]);
        // Hide markers on the far side of the globe.
        const visible = (geoPath(proj) as any).pointRadius(1);
        return <circle key={m.country} cx={pt[0]} cy={pt[1]} r={5 * pulse} fill={statusColor(m.status)} opacity={0.9} />;
      })}
    </svg>
  );
};
```

> The far-side culling above is approximate; if back-face markers show through, compare each centroid against the projection's rotation and skip when the angular distance from the globe centre exceeds 90°. Acceptable to leave as-is for the demo.

- [ ] **Step 5: Render-verify the globe**

Temporarily render `<Globe markers={[{country:'India',status:'red'},{country:'Mexico',status:'red'},{country:'Ireland',status:'green'}]} />` from `Root.tsx`, then:
Run: `npx remotion still AeroInsightsDemo out/test-globe.png --frame=30`
Expected: orthographic globe with India/Mexico shaded red, Ireland green, pulsing markers. Revert `Root.tsx`.

- [ ] **Step 6: Commit**

```bash
git add packages/demo-video/src/components/charts/AnimatedLine.tsx packages/demo-video/src/components/charts/ScenarioTree.tsx packages/demo-video/src/components/charts/Globe.tsx packages/demo-video/public/countries-110m.json
git commit -m "feat(demo-video): add AnimatedLine, ScenarioTree and d3-geo Globe"
```

---

## Task 10: Screens — Dashboard + Portfolio

**Files:**
- Create: `packages/demo-video/src/screens/Dashboard.tsx`
- Create: `packages/demo-video/src/screens/Portfolio.tsx`

- [ ] **Step 1: Implement `src/screens/Dashboard.tsx`**

```tsx
import {CountUp} from '../components/charts/CountUp';
import {Globe} from '../components/charts/Globe';
import {AnimatedBars} from '../components/charts/AnimatedBars';
import {COLORS} from '../theme/tokens';
import {KPIS} from '../data/portfolio';

// `localStart` is the frame (composition-absolute) at which this scene begins,
// so count-ups time correctly. Scene 1 starts at frame 0.
export const Dashboard: React.FC<{localStart: number}> = ({localStart}) => {
  const kpis = [
    {label: 'Portfolio Value', node: <CountUp target={2.41} decimals={2} prefix="$" suffix="B" start={localStart + 10} />},
    {label: 'Fleet Size', node: <CountUp target={KPIS.fleetSize} suffix=" Aircraft" start={localStart + 10} />},
    {label: 'Avg LTV', node: <CountUp target={67.3} decimals={1} suffix="%" start={localStart + 10} />},
    {label: 'ECL Reserve', node: <CountUp target={47.2} decimals={1} prefix="$" suffix="M" start={localStart + 10} />},
  ];
  return (
    <div className="h-full flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} style={{background: COLORS.surface, border: `1px solid ${COLORS.line}`}} className="rounded-xl p-5">
            <p style={{color: COLORS.muted}} className="text-sm">{k.label}</p>
            <p style={{color: COLORS.ink}} className="text-3xl font-black mt-1">{k.node}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">
        <div style={{background: COLORS.surface, border: `1px solid ${COLORS.line}`}} className="rounded-xl p-5 flex flex-col">
          <p style={{color: COLORS.ink}} className="font-bold mb-1">Lessee Intelligence Map</p>
          <p style={{color: COLORS.muted}} className="text-sm mb-2">Counterparty risk by jurisdiction</p>
          <div className="flex-1 flex items-center justify-center">
            <Globe size={360} markers={[
              {country: 'India', status: 'red'}, {country: 'Mexico', status: 'red'},
              {country: 'Ireland', status: 'green'}, {country: 'United Kingdom', status: 'amber'},
              {country: 'Singapore', status: 'green'}, {country: 'United States', status: 'green'},
            ]} />
          </div>
        </div>
        <div style={{background: COLORS.surface, border: `1px solid ${COLORS.line}`}} className="rounded-xl p-5 flex flex-col">
          <p style={{color: COLORS.ink}} className="font-bold mb-3">Lease Maturity Profile</p>
          <div className="flex-1">
            <AnimatedBars start={localStart + 20} height={220}
              data={[2025, 2026, 2027, 2028, 2029, 2030].map((y, i) => ({label: String(y), value: [55, 88, 63, 95, 70, 42][i]}))} />
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Implement `src/screens/Portfolio.tsx`**

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS} from '../theme/tokens';
import {AIRCRAFT} from '../data/portfolio';

export const Portfolio: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  const rows = AIRCRAFT.slice(0, 8);
  return (
    <div style={{background: COLORS.surface, border: `1px solid ${COLORS.line}`}} className="h-full rounded-xl overflow-hidden flex flex-col">
      <div className="flex gap-6 px-6 pt-5 text-sm font-semibold">
        {['Lease Register', 'Fleet & Valuations', 'Lessees', 'Concentration', 'SD / MR', 'Performance'].map((t, i) => (
          <span key={t} style={{color: i === 0 ? COLORS.brand : COLORS.muted, borderColor: i === 0 ? COLORS.brand : 'transparent'}} className="pb-2 border-b-2">{t}</span>
        ))}
      </div>
      <div style={{borderTop: `1px solid ${COLORS.line}`}} className="grid grid-cols-6 px-6 py-3 text-xs font-semibold uppercase tracking-wide" >
        {['Aircraft', 'Reg', 'Operator', 'Country', 'MV ($M)', 'Stage'].map((h) => <span key={h} style={{color: COLORS.muted}}>{h}</span>)}
      </div>
      {rows.map((a, i) => {
        const reveal = interpolate(frame, [localStart + 10 + i * 6, localStart + 10 + i * 6 + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const stageColor = a.stage >= 3 ? COLORS.red : a.stage === 2 ? COLORS.amber : COLORS.green;
        return (
          <div key={a.id} style={{opacity: reveal, borderTop: `1px solid ${COLORS.line}`, color: COLORS.ink}} className="grid grid-cols-6 px-6 py-3 text-sm">
            <span className="font-medium">{a.type}</span>
            <span>{a.reg}</span>
            <span>{a.operator}</span>
            <span>{a.country}</span>
            <span>{a.mv}</span>
            <span style={{color: stageColor}} className="font-semibold">Stage {a.stage}</span>
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 3: Render-verify both screens**

Temporarily render `<AppShell active="dashboard" title="Dashboard"><Dashboard localStart={0}/></AppShell>` from `Root.tsx`:
Run: `npx remotion still AeroInsightsDemo out/test-dashboard.png --frame=40`
Expected: KPI strip mid-count-up, globe, maturity bars. Then swap to Portfolio and render `--frame=440`. Revert `Root.tsx`.

- [ ] **Step 4: Commit**

```bash
git add packages/demo-video/src/screens/Dashboard.tsx packages/demo-video/src/screens/Portfolio.tsx
git commit -m "feat(demo-video): add Dashboard and Portfolio screens"
```

---

## Task 11: Screens — Risk & ECL, Scenario Library, Scenario Builder

**Files:**
- Create: `packages/demo-video/src/screens/RiskECL.tsx`
- Create: `packages/demo-video/src/screens/ScenarioLibrary.tsx`
- Create: `packages/demo-video/src/screens/ScenarioBuilder.tsx`

- [ ] **Step 1: Implement `src/screens/RiskECL.tsx`**

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {AnimatedBars} from '../components/charts/AnimatedBars';
import {COLORS} from '../theme/tokens';
import {ECL_HIGHLIGHT} from '../data/portfolio';

export const RiskECL: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  const expand = interpolate(frame, [localStart + 120, localStart + 150], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div className="h-full grid grid-cols-2 gap-5">
      <div style={{background: COLORS.surface, border: `1px solid ${COLORS.line}`}} className="rounded-xl p-6 flex flex-col">
        <p style={{color: COLORS.ink}} className="font-bold mb-1">Stage Distribution</p>
        <p style={{color: COLORS.muted}} className="text-sm mb-4">ECL by IFRS 9 stage ($M)</p>
        <AnimatedBars start={localStart + 20} height={220} data={[
          {label: 'Stage 1', value: 12.1, color: COLORS.green},
          {label: 'Stage 2', value: 13.8, color: COLORS.amber},
          {label: 'Stage 3', value: 21.3, color: COLORS.red},
        ]} />
      </div>
      <div style={{background: COLORS.surface, border: `1px solid ${COLORS.line}`}} className="rounded-xl p-6 flex flex-col gap-4">
        <div style={{background: COLORS.softBg}} className="rounded-lg px-4 py-3 font-mono text-sm" >
          <span style={{color: COLORS.brand}} className="font-bold">ECL = PD × LGD × EAD</span>
        </div>
        <div style={{borderColor: COLORS.red, opacity: 0.4 + expand * 0.6}} className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span style={{color: COLORS.ink}} className="font-semibold">{ECL_HIGHLIGHT.lessee}</span>
            <span style={{color: COLORS.red}} className="text-sm font-bold">{ECL_HIGHLIGHT.stage}</span>
          </div>
          <div style={{maxHeight: expand * 120, overflow: 'hidden'}} className="grid grid-cols-4 gap-3 mt-3 text-sm">
            {[['EAD', ECL_HIGHLIGHT.ead], ['PD (lifetime)', ECL_HIGHLIGHT.pdLifetime], ['LGD', ECL_HIGHLIGHT.lgd], ['ECL', ECL_HIGHLIGHT.eclLifetime]].map(([k, v]) => (
              <div key={String(k)}>
                <p style={{color: COLORS.muted}} className="text-xs">{k}</p>
                <p style={{color: COLORS.ink}} className="font-bold">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[`${ECL_HIGHLIGHT.dpd} DPD backstop`, 'Country watchlist', 'SICR — Active'].map((t) => (
            <span key={t} style={{background: 'rgba(185,28,28,0.10)', color: COLORS.red}} className="rounded-full px-3 py-1 text-xs font-semibold">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Implement `src/screens/ScenarioLibrary.tsx`**

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS} from '../theme/tokens';

const TEMPLATES = [
  {name: 'Fuel Spike +40%', tag: 'Macro', desc: 'Jet fuel shock across the book'},
  {name: 'Global Recession', tag: 'Severe', desc: 'Demand collapse, RPK −18%'},
  {name: 'Deferral Wave', tag: 'Liquidity', desc: '6-month rent deferrals'},
  {name: 'Rate Shock +200bps', tag: 'Rates', desc: 'Discount-rate stress'},
  {name: 'Single-Lessee Default', tag: 'Idiosyncratic', desc: 'Largest exposure fails'},
  {name: 'Sanctions Event', tag: 'Geopolitical', desc: 'Jurisdiction freeze'},
];

export const ScenarioLibrary: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  return (
    <div className="h-full flex flex-col gap-4">
      <p style={{color: COLORS.ink}} className="font-bold text-lg">Scenario Library <span style={{color: COLORS.muted}} className="font-normal text-sm">· 50+ templates</span></p>
      <div className="grid grid-cols-3 gap-4">
        {TEMPLATES.map((t, i) => {
          const reveal = interpolate(frame, [localStart + 10 + i * 5, localStart + 10 + i * 5 + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const picked = i === 0 && frame > localStart + 180; // template the cursor selects
          return (
            <div key={t.name} style={{opacity: reveal, background: COLORS.surface, borderColor: picked ? COLORS.brand : COLORS.line, borderWidth: picked ? 2 : 1}} className="rounded-xl p-5 border">
              <span style={{background: COLORS.softBg, color: COLORS.brand}} className="rounded-full px-2.5 py-1 text-xs font-semibold">{t.tag}</span>
              <p style={{color: COLORS.ink}} className="font-bold mt-3">{t.name}</p>
              <p style={{color: COLORS.muted}} className="text-sm mt-1">{t.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Implement `src/screens/ScenarioBuilder.tsx`**

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {ScenarioTree} from '../components/charts/ScenarioTree';
import {COLORS} from '../theme/tokens';
import {SCENARIOS} from '../data/portfolio';

export const ScenarioBuilder: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  // Slider drags from 0 to +40 over its window.
  const fuel = Math.round(interpolate(frame, [localStart + 40, localStart + 110], [0, 40], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const dslMode = frame > localStart + 140;       // cursor flips to JSON
  const ran = frame > localStart + 230;           // Run clicked
  const validTicks = interpolate(frame, [localStart + 120, localStart + 160], [0, 3], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div className="h-full grid grid-cols-2 gap-5">
      <div style={{background: COLORS.surface, border: `1px solid ${COLORS.line}`}} className="rounded-xl p-6 flex flex-col gap-5">
        <div className="flex gap-3 text-sm font-semibold">
          <span style={{color: !dslMode ? COLORS.brand : COLORS.muted}}>Form</span>
          <span style={{color: dslMode ? COLORS.brand : COLORS.muted}}>JSON (DSL)</span>
        </div>
        {!dslMode ? (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex justify-between text-sm"><span style={{color: COLORS.ink}}>Jet Fuel</span><span style={{color: COLORS.brand}} className="font-bold">+{fuel}%</span></div>
              <div style={{background: COLORS.line}} className="h-2 rounded-full mt-2"><div style={{width: `${(fuel / 60) * 100}%`, background: COLORS.brand}} className="h-2 rounded-full" /></div>
            </div>
            {[['Probability — Base', '60%'], ['Probability — Adverse', '25%'], ['Probability — Severe', '15%']].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm"><span style={{color: COLORS.muted}}>{k}</span><span style={{color: COLORS.ink}} className="font-semibold">{v}</span></div>
            ))}
          </div>
        ) : (
          <pre style={{background: COLORS.brandDeep, color: '#9ec5ff'}} className="rounded-lg p-4 text-xs leading-relaxed overflow-hidden">{`{
  "shock": { "fuel": 0.40 },
  "weights": { "base": 0.6, "adv": 0.25, "sev": 0.15 },
  "lgd_regime": "stressed"
}`}</pre>
        )}
        <div className="mt-auto flex flex-col gap-1.5">
          {['Macro inputs set', 'Weights sum to 100%', 'LGD regime valid'].map((c, i) => (
            <div key={c} className="flex items-center gap-2 text-sm" style={{opacity: i < validTicks ? 1 : 0.3}}>
              <span style={{background: i < validTicks ? COLORS.green : COLORS.line}} className="size-4 rounded-full flex items-center justify-center text-white text-[10px]">✓</span>
              <span style={{color: COLORS.ink}}>{c}</span>
            </div>
          ))}
          <div style={{background: ran ? COLORS.brand : COLORS.muted}} className="mt-2 self-start rounded-lg px-6 py-2.5 text-white text-sm font-semibold">{ran ? 'Running…' : 'Run scenario'}</div>
        </div>
      </div>
      <div style={{background: COLORS.surface, border: `1px solid ${COLORS.line}`}} className="rounded-xl p-6 flex flex-col gap-5">
        <p style={{color: COLORS.ink}} className="font-bold">Results <span style={{color: COLORS.muted}} className="font-normal text-sm">· probability-weighted ECL</span></p>
        <div className="grid grid-cols-3 gap-3">
          {SCENARIOS.map((s) => (
            <div key={s.label} style={{borderColor: COLORS.line}} className="border rounded-lg p-3 text-center">
              <p style={{color: COLORS.muted}} className="text-xs">{s.label} · {s.weight}%</p>
              <p style={{color: COLORS.ink}} className="text-xl font-black mt-1" >{ran ? s.value : '—'}</p>
            </div>
          ))}
        </div>
        <p style={{color: COLORS.muted}} className="text-sm">Run history</p>
        {ran && <ScenarioTree start={localStart + 240} nodes={SCENARIOS.map((s) => ({label: s.label, value: s.value, status: s.status}))} />}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Render-verify the three screens**

Render each from `Root.tsx` temporarily at representative frames (RiskECL `--frame=1200`, ScenarioLibrary `--frame=1800`, ScenarioBuilder `--frame=2400`), wrapping in `<AppShell active="risk"|"scenarios" .../>`. Confirm: stage bars, expanded IndiGo ECL row, library cards (first highlighted), builder slider at +40 / JSON mode / results populated / tree branching. Revert `Root.tsx`.

- [ ] **Step 5: Commit**

```bash
git add packages/demo-video/src/screens/RiskECL.tsx packages/demo-video/src/screens/ScenarioLibrary.tsx packages/demo-video/src/screens/ScenarioBuilder.tsx
git commit -m "feat(demo-video): add Risk&ECL, Scenario Library and Builder screens"
```

---

## Task 12: Screens — Intelligence, AI Panel, Rate Outlook, Excel, CTA

**Files:**
- Create: `packages/demo-video/src/screens/Intelligence.tsx`
- Create: `packages/demo-video/src/screens/AIPanel.tsx`
- Create: `packages/demo-video/src/screens/RateOutlook.tsx`
- Create: `packages/demo-video/src/screens/ExcelView.tsx`
- Create: `packages/demo-video/src/screens/CTA.tsx`

- [ ] **Step 1: Implement `src/screens/Intelligence.tsx`**

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS, statusColor, RiskStatus} from '../theme/tokens';

const RADAR: {name: string; score: number; status: RiskStatus; signal: string}[] = [
  {name: 'IndiGo Airlines', score: 82, status: 'red', signal: 'Covenant breach risk · 47 DPD'},
  {name: 'Aeromexico', score: 88, status: 'red', signal: 'Insolvency filed · Concurso'},
  {name: 'Pacific Wings', score: 54, status: 'amber', signal: 'Fleet expansion · new RFP'},
  {name: 'SkyWave Air', score: 33, status: 'green', signal: 'Traffic recovery +18% MoM'},
];

export const Intelligence: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  return (
    <div className="h-full flex flex-col gap-4">
      <p style={{color: COLORS.ink}} className="font-bold text-lg">Lessee Radar</p>
      <div className="grid grid-cols-2 gap-4">
        {RADAR.map((l, i) => {
          const reveal = interpolate(frame, [localStart + 10 + i * 8, localStart + 10 + i * 8 + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <div key={l.name} style={{opacity: reveal, background: COLORS.surface, border: `1px solid ${COLORS.line}`}} className="rounded-xl p-5 flex items-center gap-4">
              <div style={{borderColor: statusColor(l.status), color: statusColor(l.status)}} className="size-14 rounded-full border-4 flex items-center justify-center font-black">{l.score}</div>
              <div className="flex-1">
                <p style={{color: COLORS.ink}} className="font-bold">{l.name}</p>
                <p style={{color: COLORS.muted}} className="text-sm">{l.signal}</p>
              </div>
              <span style={{background: statusColor(l.status)}} className="text-white text-xs font-bold rounded-full px-3 py-1 uppercase">{l.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Implement `src/screens/AIPanel.tsx`** (slides in over the shell)

```tsx
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS} from '../theme/tokens';

const QUESTION = 'Which lessees are highest risk and why?';
const ANSWER = 'IndiGo and Aeromexico are your two highest-risk counterparties. Both are Stage 3: IndiGo is 47 days past due with a country-watchlist flag (India, IBC); Aeromexico has filed under Concurso. Combined lifetime ECL is $7.6M — 16% of reserves. Recommend prioritising both for restructuring review.';

// `panelStart` is the local frame at which the AI panel begins to open.
export const AIPanel: React.FC<{panelStart: number}> = ({panelStart}) => {
  const frame = useCurrentFrame();
  const open = interpolate(frame, [panelStart, panelStart + 16], [100, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const typed = Math.floor(interpolate(frame, [panelStart + 30, panelStart + 70], [0, QUESTION.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const answered = Math.floor(interpolate(frame, [panelStart + 90, panelStart + 230], [0, ANSWER.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  return (
    <div style={{position: 'absolute', top: 0, right: 0, bottom: 0, width: 520, transform: `translateX(${open}%)`, background: COLORS.surface, borderLeft: `1px solid ${COLORS.line}`, boxShadow: '-12px 0 40px rgba(0,33,71,0.10)'}} className="p-6 flex flex-col gap-4 z-30">
      <div className="flex items-center gap-2">
        <span style={{background: COLORS.brand}} className="rounded-full px-3 py-1.5 text-white text-sm font-semibold">AeroInsights AI</span>
      </div>
      <div style={{background: COLORS.softBg}} className="rounded-lg p-3 text-sm" >
        <span style={{color: COLORS.ink}}>{QUESTION.slice(0, typed)}</span>
        {typed < QUESTION.length && <span style={{color: COLORS.brand}}>|</span>}
      </div>
      {answered > 0 && (
        <div style={{color: COLORS.ink}} className="text-[15px] leading-relaxed">{ANSWER.slice(0, answered)}</div>
      )}
      {answered >= ANSWER.length && (
        <div style={{background: COLORS.softBg, color: COLORS.brand}} className="mt-auto rounded-lg p-3 text-sm font-semibold">↳ Drafted for board pack</div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Implement `src/screens/RateOutlook.tsx`**

```tsx
import {AnimatedLine} from '../components/charts/AnimatedLine';
import {COLORS} from '../theme/tokens';

export const RateOutlook: React.FC<{localStart: number}> = ({localStart}) => (
  <div style={{background: COLORS.surface, border: `1px solid ${COLORS.line}`}} className="h-full rounded-xl p-7 flex flex-col">
    <p style={{color: COLORS.ink}} className="font-bold text-lg">Lease Rate Outlook</p>
    <p style={{color: COLORS.muted}} className="text-sm mb-6">Forward lease-rate curve · A320neo · $/month (000s)</p>
    <div className="flex-1 flex items-center justify-center">
      <AnimatedLine start={localStart + 15} width={900} height={300}
        points={[285, 292, 300, 311, 318, 322, 330, 341, 349, 356]} />
    </div>
    <div className="flex gap-8 text-sm">
      {[['Spot', '$285k'], ['12m fwd', '$318k'], ['24m fwd', '$356k']].map(([k, v]) => (
        <div key={k}><span style={{color: COLORS.muted}}>{k} </span><span style={{color: COLORS.ink}} className="font-bold">{v}</span></div>
      ))}
    </div>
  </div>
);
```

- [ ] **Step 4: Implement `src/screens/ExcelView.tsx`** (full-frame cut)

```tsx
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {COLORS} from '../theme/tokens';

const CELLS = [
  ['Metric', 'Formula', 'Value'],
  ['Fleet size', '=AI.Portfolio("fleet_size")', '12'],
  ['Portfolio value', '=AI.Portfolio("nbv")', '$2.41B'],
  ['ECL reserve', '=AI.Portfolio("ecl")', '$47.2M'],
  ['Stage 3 count', '=AI.Portfolio("stage3")', '4'],
];

export const ExcelView: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: '#f3f3f3'}} className="p-16 justify-center">
      <div className="bg-white rounded-lg shadow-2xl overflow-hidden" style={{border: '1px solid #d0d0d0'}}>
        <div style={{background: '#217346'}} className="text-white px-5 py-2.5 text-sm font-semibold">Excel · AeroInsights Add-In</div>
        <table className="w-full text-sm">
          <tbody>
            {CELLS.map((row, r) => {
              const reveal = interpolate(frame, [localStart + 10 + r * 12, localStart + 10 + r * 12 + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
              return (
                <tr key={r} style={{opacity: r === 0 ? 1 : reveal, background: r === 0 ? '#f7f7f7' : '#fff'}}>
                  {row.map((c, ci) => (
                    <td key={ci} style={{borderBottom: '1px solid #e6e6e6', borderRight: '1px solid #e6e6e6', color: ci === 1 ? COLORS.brand : '#1f1f1f', fontFamily: ci === 1 ? 'monospace' : undefined}} className="px-5 py-3">{c}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 5: Implement `src/screens/CTA.tsx`** (full-frame close)

```tsx
import {AbsoluteFill, useCurrentFrame, interpolate, staticFile} from 'remotion';
import {COLORS} from '../theme/tokens';

const PARTNERS = ['Aerfin', 'ELFC', 'EY', 'Grant Thornton', 'KPMG'];

export const CTA: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  const f = (s: number, e: number) => interpolate(frame, [localStart + s, localStart + e], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: `linear-gradient(160deg, ${COLORS.darkBg}, ${COLORS.brand} 60%, ${COLORS.brandDeep})`}} className="items-center justify-center text-center">
      <div style={{opacity: f(0, 18), transform: `translateY(${interpolate(f(0, 18), [0, 1], [12, 0])}px)`}} className="flex flex-col items-center gap-6">
        <img src={staticFile('logo.png')} alt="" style={{width: 84, filter: 'brightness(0) invert(1)'}} />
        <p className="text-white text-5xl font-black tracking-tight">AeroInsights</p>
        <p style={{color: '#9ec5ff', opacity: f(14, 30)}} className="text-2xl">Sign up in seconds — email or Google</p>
      </div>
      <div style={{opacity: f(34, 50)}} className="mt-10 flex items-center gap-8">
        {PARTNERS.map((p) => <span key={p} className="text-white/60 text-lg font-semibold">{p}</span>)}
      </div>
      <div style={{opacity: f(50, 66)}} className="mt-10 flex flex-col items-center gap-1">
        <p className="text-white text-xl font-semibold">aeroinsights.vercel.app · Book a demo</p>
        <p style={{color: '#9ec5ff'}} className="text-base">Tanam Sethi · linkedin.com/in/tanamsethi</p>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 6: Render-verify each screen** at frames 2700 (Intelligence), 2980 (AI panel open), 3500 (Rate Outlook), 3950 (Excel), 4500 (CTA) via temporary `Root.tsx` wrappers. Confirm content matches the script. Revert `Root.tsx`.

- [ ] **Step 7: Commit**

```bash
git add packages/demo-video/src/screens/Intelligence.tsx packages/demo-video/src/screens/AIPanel.tsx packages/demo-video/src/screens/RateOutlook.tsx packages/demo-video/src/screens/ExcelView.tsx packages/demo-video/src/screens/CTA.tsx
git commit -m "feat(demo-video): add Intelligence, AI panel, Rate Outlook, Excel and CTA screens"
```

---

## Task 13: Assemble the timeline (DemoVideo) + audio + voiceover script

**Files:**
- Create: `packages/demo-video/src/DemoVideo.tsx`
- Create: `packages/demo-video/src/timeline/voiceover.md`
- Modify: `packages/demo-video/src/Root.tsx`
- Add: `packages/demo-video/public/music.mp3` (placeholder)

- [ ] **Step 1: Add a placeholder music bed**

Place any royalty-free calm-corporate track at `packages/demo-video/public/music.mp3` (e.g. from the Remotion music library or a CC0 source). If none is available yet, create silence so the build runs:
Run (from `packages/demo-video/`): `ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t 160 -q:a 9 public/music.mp3`
Expected: a 160-second silent mp3. Record the final track's licence in `ATTRIBUTIONS.md` later.

- [ ] **Step 2: Implement `src/DemoVideo.tsx`**

```tsx
import {AbsoluteFill, Series, Sequence, Audio, staticFile} from 'remotion';
import {AppShell} from './components/AppShell';
import {Cursor} from './components/Cursor';
import {Caption} from './components/Caption';
import {Camera, CameraMove} from './components/Camera';
import {Dashboard} from './screens/Dashboard';
import {Portfolio} from './screens/Portfolio';
import {RiskECL} from './screens/RiskECL';
import {ScenarioLibrary} from './screens/ScenarioLibrary';
import {ScenarioBuilder} from './screens/ScenarioBuilder';
import {Intelligence} from './screens/Intelligence';
import {AIPanel} from './screens/AIPanel';
import {RateOutlook} from './screens/RateOutlook';
import {ExcelView} from './screens/ExcelView';
import {CTA} from './screens/CTA';
import {FONT_FAMILY} from './theme/fonts';

// Scene boundaries (frames) — see plan Conventions.
const S = {dash: 420, port: 600, risk: 690, scen: 870, intel: 810, rate: 450, excel: 360, cta: 600};

const cameraMoves: CameraMove[] = [
  {from: 30, to: 120, scale: 1.06, x: 0, y: -10}, // KPI emphasis (Scene 1)
];

export const DemoVideo: React.FC = () => (
  <AbsoluteFill style={{fontFamily: FONT_FAMILY}}>
    <Series>
      {/* Scenes 1-6 share the shell; each Series.Sequence renders the right screen.
          localStart=0 inside each Sequence because useCurrentFrame() resets per Sequence. */}
      <Series.Sequence durationInFrames={S.dash}>
        <Camera moves={cameraMoves.map((m) => m)}>
          <AppShell active="dashboard" title="Dashboard"><Dashboard localStart={0} /></AppShell>
        </Camera>
      </Series.Sequence>
      <Series.Sequence durationInFrames={S.port}>
        <AppShell active="portfolio" title="Portfolio"><Portfolio localStart={0} /></AppShell>
      </Series.Sequence>
      <Series.Sequence durationInFrames={S.risk}>
        <AppShell active="risk" title="Risk & ECL"><RiskECL localStart={0} /></AppShell>
      </Series.Sequence>
      <Series.Sequence durationInFrames={S.scen}>
        {/* Scene 4: library first ~180f, then builder. Both under the Scenarios shell. */}
        <AppShell active="scenarios" title="Scenarios">
          <Sequence durationInFrames={180}><ScenarioLibrary localStart={0} /></Sequence>
          <Sequence from={180}><ScenarioBuilder localStart={0} /></Sequence>
        </AppShell>
      </Series.Sequence>
      <Series.Sequence durationInFrames={S.intel}>
        <AppShell active="intelligence" title="Intelligence">
          <Intelligence localStart={0} />
          <AIPanel panelStart={320} />
        </AppShell>
      </Series.Sequence>
      <Series.Sequence durationInFrames={S.rate}>
        <AppShell active="rate" title="Rate Outlook"><RateOutlook localStart={0} /></AppShell>
      </Series.Sequence>
      {/* Full-frame cuts */}
      <Series.Sequence durationInFrames={S.excel}><ExcelView localStart={0} /></Series.Sequence>
      <Series.Sequence durationInFrames={S.cta}><CTA localStart={0} /></Series.Sequence>
    </Series>

    {/* Global overlays span the whole composition (not reset per Sequence). */}
    <Cursor />
    <Caption />
    <Audio src={staticFile('music.mp3')} volume={0.25} />
  </AbsoluteFill>
);
```

> Sub-sequence note: inside Scene 4 the `<Sequence from={180}>` makes `ScenarioBuilder`'s `useCurrentFrame()` reset to 0 at its start, so `localStart={0}` is correct there too. The Scene-5 `AIPanel panelStart={320}` is in Scene-5-local frames.

- [ ] **Step 3: Point `Root.tsx` at the real composition**

```tsx
import {Composition} from 'remotion';
import {DemoVideo} from './DemoVideo';
import './theme/fonts';

export const Root: React.FC = () => (
  <Composition
    id="AeroInsightsDemo"
    component={DemoVideo}
    durationInFrames={4800}
    fps={30}
    width={1920}
    height={1080}
  />
);
```

- [ ] **Step 4: Create the founder VO script `src/timeline/voiceover.md`**

```markdown
# AeroInsights demo — voiceover script (founder, first person)

Target pace ~150 wpm. Record one take per scene; timings are guides.

- **Scene 1 (0:00–0:14):** This is AeroInsights — the platform I built to run an entire aircraft-leasing book in one place. The dashboard gives you the headline numbers and a live map of where your counterparty risk actually sits. Everything here is real portfolio data.
- **Scene 2 (0:14–0:34):** Start with the portfolio: your full lease register, fleet and valuations, lessee concentration, and maturity profile — live, not in a spreadsheet. Every aircraft, every lease, every counterparty in one view.
- **Scene 3 (0:34–0:57):** Underneath is a full IFRS 9 engine — expected credit loss computed per lease, with automatic stage classification. When a lessee crosses a threshold, the platform moves it to Stage 3 and shows you exactly why. This is the audit-ready number, not a manual estimate.
- **Scene 4 (0:57–1:26):** Then stress it. Start from the scenario library — fifty-plus ready-made stress templates — or build your own: tune the macro inputs with sliders, or write the scenario directly as JSON. A fuel spike, a recession, a deferral wave — run across the whole book in one click. Every run is saved, branchable, and fully traceable — the audit trail regulators actually ask for.
- **Scene 5 (1:26–1:53):** AeroInsights doesn't just hold your data — it reads it. It scores every lessee on operational and credit signals, so you know who's in trouble before they call you. And the AI layer ties it together: ask a question in plain English, and it summarises the book, flags the risks, and drafts the write-up for your board pack.
- **Scene 6 (1:53–2:08):** It looks forward too — lease-rate outlook with forward curves, so you can price the next deal against where the market's heading.
- **Scene 7 (2:08–2:20):** And if your team lives in Excel, the add-in pulls this same live data straight into a spreadsheet — no exports, no API wrangling.
- **Scene 8 (2:20–2:40):** I built AeroInsights from scratch and refined it with teams at Aerfin, ELFC and EY. Signup takes seconds — take a look, and tell me what you think.
```

- [ ] **Step 5: Render-verify the full assembly at scene midpoints**

Run (from `packages/demo-video/`), one per scene:
```
npx remotion still AeroInsightsDemo out/v-s1.png --frame=120
npx remotion still AeroInsightsDemo out/v-s2.png --frame=700
npx remotion still AeroInsightsDemo out/v-s3.png --frame=1350
npx remotion still AeroInsightsDemo out/v-s4a.png --frame=1820
npx remotion still AeroInsightsDemo out/v-s4b.png --frame=2400
npx remotion still AeroInsightsDemo out/v-s5.png --frame=2980
npx remotion still AeroInsightsDemo out/v-s6.png --frame=3600
npx remotion still AeroInsightsDemo out/v-s7.png --frame=3980
npx remotion still AeroInsightsDemo out/v-s8.png --frame=4500
```
Expected: each frame shows the correct screen with the correct sidebar item highlighted, the cursor near the right control, and the matching caption. Fix any mismatched cursor coordinates in `src/timeline/cursor.ts` (the sidebar item y-positions are ~ `220 + index*50`; the top bar is 0–72px) and re-render.

- [ ] **Step 6: Commit**

```bash
git add packages/demo-video/src/DemoVideo.tsx packages/demo-video/src/Root.tsx packages/demo-video/src/timeline/voiceover.md packages/demo-video/public/music.mp3
git commit -m "feat(demo-video): assemble timeline, audio bed and voiceover script"
```

---

## Task 14: Full render + final verification

**Files:**
- Output: `packages/demo-video/out/aeroinsights-demo.mp4`

- [ ] **Step 1: Run the full render**

Run (from `packages/demo-video/`): `npm run render`
Expected: Remotion renders 4800 frames and writes `out/aeroinsights-demo.mp4` (~2:40, 1920×1080, H.264). No `delayRender` timeouts.

- [ ] **Step 2: Spot-check the output**

Open `out/aeroinsights-demo.mp4` and confirm against the spec §4 script:
- Scene order, sidebar highlight tracking the cursor, captions timed to scenes.
- Count-ups land on $2.41B / 12 / 67.3% / $47.2M; globe shows India+Mexico red.
- Scenario builder slider → +40%, JSON mode, results $47.2M/$58.9M/$71.4M, tree branches.
- AI panel types the question and streams the answer.
- CTA shows sign-up + URL + partners + your contact.

- [ ] **Step 3: Run the logic test suite**

Run (from `packages/demo-video/`): `npm test`
Expected: all Vitest suites pass (data, cursor, captions, CountUp).

- [ ] **Step 4: Final commit**

```bash
git add -A packages/demo-video
git commit -m "chore(demo-video): render aeroinsights-demo.mp4 and finalise"
```

---

## Self-review notes (coverage vs spec)

- Spec §4 scenes 1–8 → Tasks 10–13 (every scene has a screen + a caption cue + a VO line).
- Dashboard globe ("Lessee Intelligence Map") → Task 9 (Globe) + Task 10.
- Scenarios Library **and** Custom Builder → Task 11 + Task 13 sub-sequencing.
- Determinism constraint (no framer-motion/recharts) → all charts hand-built in Tasks 8–9.
- Founder VO (scripted, recorded later) → `voiceover.md` (Task 13); build paced to captions now.
- Real sample data → Task 3 generator + tests.
- 16:9 master, ~2:40 → Composition 1920×1080 / 4800 frames (Tasks 1, 13).
- Render + verification → Task 14.

Open follow-ups (from spec §7, intentionally outside this plan): final music selection/licence, founder VO recording, optional far-side globe-marker culling polish.
```
