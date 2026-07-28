import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, staticFile} from 'remotion';
import {COLORS} from '../theme/tokens';

// Brand intro card on the Oxford-Blue gradient.
export const TitleCard: React.FC<{durationInFrames: number}> = ({durationInFrames}) => {
  const frame = useCurrentFrame();
  const f = (s: number, e: number) => interpolate(frame, [s, e], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const out = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${COLORS.darkBg}, ${COLORS.brand} 60%, ${COLORS.brandDeep})`,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: out,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          opacity: f(0, 18),
          transform: `translateY(${interpolate(f(0, 18), [0, 1], [14, 0])}px)`,
        }}
      >
        <img src={staticFile('logo.png')} alt="" style={{width: 92, filter: 'brightness(0) invert(1)'}} />
        <p style={{color: '#fff', fontSize: 64, fontWeight: 900, letterSpacing: '-1.5px', margin: 0}}>AeroInsights</p>
        <p style={{color: '#9ec5ff', fontSize: 26, margin: 0, opacity: f(14, 30)}}>
          Aviation finance intelligence — a quick look at the platform
        </p>
      </div>
    </AbsoluteFill>
  );
};
