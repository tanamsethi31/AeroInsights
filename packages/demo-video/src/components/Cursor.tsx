import React from 'react';
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
