import {describe, it, expect} from 'vitest';
import {CAPTIONS, captionAt} from './captions';

describe('caption track', () => {
  it('opens with the dashboard caption during the first screen scene', () => {
    expect(captionAt(120)).toBe('The dashboard — your whole book at a glance');
  });
  it('returns null in gaps between captions', () => {
    const sorted = [...CAPTIONS].sort((a, b) => a.from - b.from);
    const last = sorted[sorted.length - 1];
    expect(captionAt(last.to + 1)).toBeNull();
  });
  it('covers all nine feature scenes', () => {
    expect(CAPTIONS).toHaveLength(9);
    expect(CAPTIONS.some((c) => c.text.includes('Monte Carlo'))).toBe(true);
    expect(CAPTIONS.some((c) => c.text.includes('IFRS 9 ECL'))).toBe(true);
  });
  it('keeps cues in order without overlaps', () => {
    for (let i = 1; i < CAPTIONS.length; i++) {
      expect(CAPTIONS[i].from).toBeGreaterThan(CAPTIONS[i - 1].to);
    }
  });
});
