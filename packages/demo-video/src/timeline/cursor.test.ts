import {describe, it, expect} from 'vitest';
import {cursorAt, isClicking, CURSOR_KEYS} from './cursor';

describe('cursor timeline', () => {
  it('returns the first keyframe position before the timeline starts', () => {
    const p = cursorAt(0);
    expect(p.x).toBe(CURSOR_KEYS[0].x);
    expect(p.y).toBe(CURSOR_KEYS[0].y);
  });
  it('interpolates linearly between two keyframes', () => {
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
