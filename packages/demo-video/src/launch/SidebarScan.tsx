import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Easing} from 'remotion';
import {COLORS} from '../theme/tokens';
import {FramedScreen, LabelChip} from './FramedScreen';

// Slowly travels top -> bottom down the left navigation rail of the app.
export const SidebarScan: React.FC<{
  src: string;
  label: string;
  durationInFrames: number;
}> = ({src, label, durationInFrames}) => {
  const frame = useCurrentFrame();
  const s = 1.75;
  const cx = 0.12; // sidebar column
  const cy = interpolate(frame, [10, durationInFrames - 10], [0.17, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });
  const labelIn = interpolate(frame, [14, 28], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: `radial-gradient(130% 130% at 50% 0%, ${COLORS.darkBg}, ${COLORS.brandDeep})`, alignItems: 'center', justifyContent: 'center'}}>
      <FramedScreen src={src} s={s} cx={cx} cy={cy} />
      <LabelChip label={label} opacity={labelIn} y={interpolate(labelIn, [0, 1], [22, 0])} accent="#5b8fd8" />
    </AbsoluteFill>
  );
};
