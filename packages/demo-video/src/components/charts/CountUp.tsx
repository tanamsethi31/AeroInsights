import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';

// Pure helper (tested): value at `frame`, ramping target over [start, start+dur].
export function countValue(target: number, frame: number, start: number, dur: number): number {
  return interpolate(frame, [start, start + dur], [0, target], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export const CountUp: React.FC<{
  target: number; start: number; dur?: number;
  prefix?: string; suffix?: string; decimals?: number; style?: React.CSSProperties;
}> = ({target, start, dur = 30, prefix = '', suffix = '', decimals = 0, style}) => {
  const frame = useCurrentFrame();
  const v = countValue(target, frame, start, dur);
  return <span style={style}>{prefix}{v.toFixed(decimals)}{suffix}</span>;
};
