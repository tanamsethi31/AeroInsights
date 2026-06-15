import {interpolate} from 'remotion';
import {EASE} from '../theme/tokens';

export interface CursorKey { frame: number; x: number; y: number; click?: boolean; }

// Coordinates are in 1920x1080 space. These map to the sidebar items and the
// interactive controls each scene touches. Exact pixels get tuned in the
// timeline-assembly task once screens exist; these give a valid timeline.
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
