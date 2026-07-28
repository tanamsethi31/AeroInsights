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
