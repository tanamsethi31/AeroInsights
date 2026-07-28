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
