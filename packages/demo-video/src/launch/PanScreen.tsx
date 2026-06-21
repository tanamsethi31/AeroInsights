import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Easing} from 'remotion';
import {COLORS} from '../theme/tokens';
import {FramedScreen, LabelChip} from './FramedScreen';

// Slowly travels vertically (top -> bottom by default) across a zoomed screen.
export const PanScreen: React.FC<{
  src: string;
  label: string;
  durationInFrames: number;
  cx?: number;
  scale?: number;
  cyFrom?: number;
  cyTo?: number;
  accent?: string;
}> = ({src, label, durationInFrames, cx = 0.5, scale = 1.6, cyFrom = 0.17, cyTo = 0.85, accent = '#5b8fd8'}) => {
  const frame = useCurrentFrame();
  const cy = interpolate(frame, [10, durationInFrames - 10], [cyFrom, cyTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });
  const labelIn = interpolate(frame, [14, 28], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: `radial-gradient(130% 130% at 50% 0%, ${COLORS.darkBg}, ${COLORS.brandDeep})`, alignItems: 'center', justifyContent: 'center'}}>
      <FramedScreen src={src} s={scale} cx={cx} cy={cy} />
      <LabelChip label={label} opacity={labelIn} y={interpolate(labelIn, [0, 1], [22, 0])} accent={accent} />
    </AbsoluteFill>
  );
};
