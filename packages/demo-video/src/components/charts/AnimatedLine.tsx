import React from 'react';
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
