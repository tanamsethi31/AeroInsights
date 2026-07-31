import React from 'react';
import {Img, staticFile} from 'remotion';
import {COLORS} from '../theme/tokens';

export const IMG_ASPECT = 2828 / 1640;

// A screenshot inside a clipped rounded frame, scaled by `s` and panned so the
// normalised point (cx,cy) is centred — clamped so the image always covers the
// frame (no background gaps). At s≈1 the whole page shows centred; as s grows
// it focuses on (cx,cy).
export const FramedScreen: React.FC<{
  src: string;
  s: number;
  cx: number;
  cy: number;
  entryScale?: number;
}> = ({src, s, cx, cy, entryScale = 1}) => {
  const wrapperH = 1080;
  const wrapperW = Math.round(wrapperH * IMG_ASPECT);
  const maxTx = (wrapperW * (s - 1)) / 2;
  const maxTy = (wrapperH * (s - 1)) / 2;
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  const Tx = clamp(-s * wrapperW * (cx - 0.5), maxTx);
  const Ty = clamp(-s * wrapperH * (cy - 0.5), maxTy);
  return (
    <div
      style={{
        width: wrapperW,
        height: wrapperH,
        overflow: 'hidden',
        borderRadius: 18,
        boxShadow: '0 50px 140px rgba(0,0,0,0.55)',
        transform: `scale(${entryScale})`,
        background: COLORS.surface,
      }}
    >
      <div style={{position: 'relative', width: '100%', height: '100%', transform: `translate(${Tx}px, ${Ty}px) scale(${s})`, transformOrigin: 'center center'}}>
        <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
      </div>
    </div>
  );
};

export const LabelChip: React.FC<{label: string; opacity: number; y: number; accent?: string}> = ({label, opacity, y, accent = '#5b8fd8'}) => (
  <div style={{position: 'absolute', left: 0, right: 0, bottom: 92, display: 'flex', justifyContent: 'center', opacity, transform: `translateY(${y}px)`}}>
    <div style={{background: 'rgba(255,255,255,0.97)', borderRadius: 9999, padding: '14px 32px', boxShadow: '0 14px 44px rgba(0,33,71,0.28)', display: 'flex', alignItems: 'center', gap: 12}}>
      <span style={{width: 11, height: 11, borderRadius: 9999, background: accent}} />
      <span style={{color: COLORS.brand, fontSize: 32, fontWeight: 700, letterSpacing: '-0.01em'}}>{label}</span>
    </div>
  </div>
);
