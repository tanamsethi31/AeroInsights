import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, staticFile} from 'remotion';
import {COLORS} from '../theme/tokens';
import {KineticText} from './KineticText';

const BG = `linear-gradient(160deg, ${COLORS.darkBg}, ${COLORS.brand} 62%, ${COLORS.brandDeep})`;

export const HookScene: React.FC = () => (
  <AbsoluteFill style={{background: BG, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6}}>
    <KineticText text="The aircraft-leasing book" delay={0} size={68} color="#bcd4fb" weight={800} />
    <KineticText text="reimagined." delay={9} size={108} color="#ffffff" weight={900} />
  </AbsoluteFill>
);

export const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 11, stiffness: 150, mass: 0.6}});
  return (
    <AbsoluteFill style={{background: BG, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20}}>
      <img src={staticFile('logo.png')} alt="" style={{width: 120, filter: 'brightness(0) invert(1)', opacity: pop, transform: `scale(${interpolate(pop, [0, 1], [0.4, 1])})`}} />
      <KineticText text="AeroInsights" delay={6} size={94} color="#ffffff" weight={900} />
      <KineticText text="Aviation finance intelligence" delay={16} size={30} color="#9ec5ff" weight={500} />
    </AbsoluteFill>
  );
};

const PARTNERS = [
  {src: 'logos/aerfin.png', h: 36},
  {src: 'logos/elfc.png', h: 32},
  {src: 'logos/ey.png', h: 46},
  {src: 'logos/grant-thornton.png', h: 24},
  {src: 'logos/kpmg.png', h: 30},
];

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const f = (d: number) => spring({frame: frame - d, fps, config: {damping: 16, stiffness: 120}});
  const logo = spring({frame, fps, config: {damping: 12, stiffness: 150}});
  return (
    <AbsoluteFill style={{background: BG, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 22}}>
      <img src={staticFile('logo.png')} alt="" style={{width: 96, filter: 'brightness(0) invert(1)', opacity: logo, transform: `scale(${interpolate(logo, [0, 1], [0.5, 1])})`}} />
      <KineticText text="AeroInsights" delay={4} size={86} color="#ffffff" weight={900} />
      <div style={{opacity: f(16), transform: `translateY(${interpolate(f(16), [0, 1], [16, 0])}px)`}}>
        <span style={{color: '#9ec5ff', fontSize: 34, fontWeight: 600}}>Sign up in seconds — free to try</span>
      </div>
      <div style={{opacity: f(24), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 6}}>
        <span style={{color: '#9ec5ff', fontSize: 18, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase'}}>Demoed with &amp; refined by</span>
        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
          {PARTNERS.map((p, i) => (
            <div key={p.src} style={{opacity: f(28 + i * 3), background: '#fff', borderRadius: 12, height: 70, padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.25)'}}>
              <img src={staticFile(p.src)} alt="" style={{height: p.h, width: 'auto', objectFit: 'contain', display: 'block'}} />
            </div>
          ))}
        </div>
      </div>
      <div style={{opacity: f(34), transform: `scale(${interpolate(f(34), [0, 1], [0.9, 1])})`, marginTop: 8}}>
        <div style={{background: '#fff', color: COLORS.brand, borderRadius: 9999, padding: '16px 42px', fontSize: 30, fontWeight: 800}}>aeroinsights.vercel.app</div>
      </div>
    </AbsoluteFill>
  );
};
