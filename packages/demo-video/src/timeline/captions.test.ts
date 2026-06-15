import {describe, it, expect} from 'vitest';
import {CAPTIONS, captionAt} from './captions';

describe('caption track', () => {
  it('opens with the approved dashboard caption', () => {
    expect(captionAt(60)).toBe('AeroInsights: The Dashboard, portfolio summary');
  });
  it('returns null in gaps between captions', () => {
    const sorted = [...CAPTIONS].sort((a, b) => a.from - b.from);
    const last = sorted[sorted.length - 1];
    expect(captionAt(last.to + 1)).toBeNull();
  });
  it('shows the Custom Builder caption during Scene 4', () => {
    const any = CAPTIONS.some((c) => c.text.includes('Custom Scenario Builder'));
    expect(any).toBe(true);
  });
});
