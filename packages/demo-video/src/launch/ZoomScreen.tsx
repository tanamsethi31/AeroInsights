import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';
import {COLORS} from '../theme/tokens';

const IMG_ASPECT = 2828 / 1640;

// A real screenshot with a fast spring zoom toward (cx,cy) and a kinetic label.
// mode 'in' punches from wide -> focus; 'out' pulls from focus -> wide.
export const ZoomScreen: React.FC<{
  src: string;
  cx: number;
  cy: number;
  scale: number;
  label: string;
  mode?: 'in' | 'out';
  accent?: string;
}> = ({src, cx, cy, scale, label, mode = 'in', accent = '#5b8fd8'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const wrapperH = 1080;
  const wrapperW = Math.round(wrapperH * IMG_ASPECT);

  const entry = spring({frame, fps, config: {damping: 18, stiffness: 120, mass: 0.7}});
  const entryScale = interpolate(entry, [0, 1], [0.97, 1]);

  const zp = spring({frame: frame - 6, fps, config: {damping: 22, stiffness: 80, mass: 0.9}});
  const s = interpolate(zp, [0, 1], mode === 'in' ? [1.02, scale] : [scale, 1.02]);
  const beta = interpolate(zp, [0, 1], mode === 'in' ? [0, 1] : [1, 0]);
  // Clamp the pan so the scaled image always fully covers the frame (no gaps
  // when focusing on a region near an edge).
  const maxTx = (wrapperW * (s - 1)) / 2;
  const maxTy = (wrapperH * (s - 1)) / 2;
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  const Tx = clamp(beta * (-s * wrapperW * (cx - 0.5)), maxTx);
  const Ty = clamp(beta * (-s * wrapperH * (cy - 0.5)), maxTy);

  const labelIn = spring({frame: frame - 14, fps, config: {damping: 15, stiffness: 130}});

  return (
    <AbsoluteFill style={{background: `radial-gradient(130% 130% at 50% 0%, ${COLORS.darkBg}, ${COLORS.brandDeep})`, alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          width: wrapperW,
          height: wrapperH,
          overflow: 'hidden',
          borderRadius: 18,
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 50px 140px rgba(0,0,0,0.55)',
          transform: `scale(${entryScale})`,
        }}
      >
        <div style={{position: 'relative', width: '100%', height: '100%', transform: `translate(${Tx}px, ${Ty}px) scale(${s})`, transformOrigin: 'center center'}}>
          <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 92, display: 'flex', justifyContent: 'center', opacity: labelIn, transform: `translateY(${interpolate(labelIn, [0, 1], [22, 0])}px)`}}>
        <div style={{background: 'rgba(255,255,255,0.97)', borderRadius: 9999, padding: '14px 32px', boxShadow: '0 14px 44px rgba(0,33,71,0.28)', display: 'flex', alignItems: 'center', gap: 12}}>
          <span style={{width: 11, height: 11, borderRadius: 9999, background: accent}} />
          <span style={{color: COLORS.brand, fontSize: 32, fontWeight: 700, letterSpacing: '-0.01em'}}>{label}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
