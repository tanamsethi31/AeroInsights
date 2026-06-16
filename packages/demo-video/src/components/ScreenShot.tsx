import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, staticFile, Img} from 'remotion';
import {COLORS} from '../theme/tokens';

// A real-platform screenshot presented in a framed card with a slow Ken-Burns
// zoom/pan. `index` alternates the pan direction so consecutive scenes differ.
export const ScreenShot: React.FC<{
  src: string;
  durationInFrames: number;
  zoom?: number;
  index?: number;
}> = ({src, durationInFrames, zoom = 0.09, index = 0}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], {extrapolateRight: 'clamp'});
  const scale = 1.04 + zoom * p;
  const dir = index % 2 === 0 ? 1 : -1;
  const tx = dir * interpolate(p, [0, 1], [-1.6, 1.6]);
  const ty = interpolate(p, [0, 1], [1.4, -1.4]);
  const enter = interpolate(frame, [0, 16], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: `radial-gradient(120% 120% at 50% 0%, ${COLORS.darkBg}, ${COLORS.brandDeep})`, alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          width: '92%',
          height: '88%',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.45)',
          opacity: enter,
          transform: `scale(${0.985 + 0.015 * enter})`,
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
            transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
