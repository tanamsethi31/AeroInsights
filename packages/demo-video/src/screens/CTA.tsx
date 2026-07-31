import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, staticFile} from 'remotion';
import {COLORS} from '../theme/tokens';

const PARTNERS = ['Aerfin', 'ELFC', 'EY', 'Grant Thornton', 'KPMG'];

export const CTA: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  const f = (s: number, e: number) => interpolate(frame, [localStart + s, localStart + e], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: `linear-gradient(160deg, ${COLORS.darkBg}, ${COLORS.brand} 60%, ${COLORS.brandDeep})`, alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
      <div style={{opacity: f(0, 18), transform: `translateY(${interpolate(f(0, 18), [0, 1], [12, 0])}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
        <img src={staticFile('logo.png')} alt="" style={{width: 84, filter: 'brightness(0) invert(1)'}} />
        <p style={{color: '#fff', fontSize: 48, fontWeight: 900, letterSpacing: '-1px', margin: 0}}>AeroInsights</p>
        <p style={{color: '#9ec5ff', opacity: f(14, 30), fontSize: 24, margin: 0}}>Sign up in seconds — email or Google</p>
      </div>
      <div style={{opacity: f(34, 50), marginTop: 40, display: 'flex', alignItems: 'center', gap: 32}}>
        {PARTNERS.map((p) => <span key={p} style={{color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: 600}}>{p}</span>)}
      </div>
      <div style={{opacity: f(50, 66), marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
        <p style={{color: '#fff', fontSize: 20, fontWeight: 600, margin: 0}}>aeroinsights.vercel.app · Book a demo</p>
        <p style={{color: '#9ec5ff', fontSize: 16, margin: 0}}>Tanam Sethi · linkedin.com/in/tanamsethi</p>
      </div>
    </AbsoluteFill>
  );
};
