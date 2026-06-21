import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Easing} from 'remotion';
import {COLORS} from '../theme/tokens';
import {FramedScreen, LabelChip} from './FramedScreen';

// Refined slow zoom: shows the page (nearly) full briefly, then eases into the
// focus region with an ease-in-out so the move decelerates rather than snapping
// or pausing. mode 'out' reverses (focus -> wide).
export const ZoomScreen: React.FC<{
  src: string;
  cx: number;
  cy: number;
  scale: number;
  label: string;
  durationInFrames: number;
  mode?: 'in' | 'out';
  hold?: number;
  accent?: string;
}> = ({src, cx, cy, scale, label, durationInFrames, mode = 'in', hold = 18, accent = '#5b8fd8'}) => {
  const frame = useCurrentFrame();
  const entry = interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  const entryScale = interpolate(entry, [0, 1], [0.985, 1]);

  const zp = interpolate(frame, [hold, durationInFrames - 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const s = interpolate(zp, [0, 1], mode === 'in' ? [1.02, scale] : [scale, 1.02]);

  const labelIn = interpolate(frame, [14, 28], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: `radial-gradient(130% 130% at 50% 0%, ${COLORS.darkBg}, ${COLORS.brandDeep})`, alignItems: 'center', justifyContent: 'center'}}>
      <FramedScreen src={src} s={s} cx={cx} cy={cy} entryScale={entryScale} />
      <LabelChip label={label} opacity={labelIn} y={interpolate(labelIn, [0, 1], [22, 0])} accent={accent} />
    </AbsoluteFill>
  );
};
