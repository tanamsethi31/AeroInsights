import React from 'react';
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
