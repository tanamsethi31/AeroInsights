import React from 'react';
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
    <div style={{display: 'flex', alignItems: 'flex-end', gap: 12, height}}>
      {data.map((d, i) => {
        const grow = interpolate(frame, [start + i * 3, start + i * 3 + dur], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        return (
          <div key={d.label} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8, height: '100%'}}>
            <div style={{height: `${(d.value / max) * 100 * grow}%`, width: '100%', borderRadius: '6px 6px 0 0', background: d.color ?? COLORS.brand}} />
            <span style={{color: COLORS.muted, fontSize: 12}}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};
