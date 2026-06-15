import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS} from '../theme/tokens';

const TEMPLATES = [
  {name: 'Fuel Spike +40%', tag: 'Macro', desc: 'Jet fuel shock across the book'},
  {name: 'Global Recession', tag: 'Severe', desc: 'Demand collapse, RPK −18%'},
  {name: 'Deferral Wave', tag: 'Liquidity', desc: '6-month rent deferrals'},
  {name: 'Rate Shock +200bps', tag: 'Rates', desc: 'Discount-rate stress'},
  {name: 'Single-Lessee Default', tag: 'Idiosyncratic', desc: 'Largest exposure fails'},
  {name: 'Sanctions Event', tag: 'Geopolitical', desc: 'Jurisdiction freeze'},
];

export const ScenarioLibrary: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 16}}>
      <p style={{color: COLORS.ink, fontWeight: 700, fontSize: 18, margin: 0}}>Scenario Library <span style={{color: COLORS.muted, fontWeight: 400, fontSize: 14}}>· 50+ templates</span></p>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16}}>
        {TEMPLATES.map((t, i) => {
          const reveal = interpolate(frame, [localStart + 10 + i * 5, localStart + 10 + i * 5 + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const picked = i === 0 && frame > localStart + 180;
          return (
            <div key={t.name} style={{opacity: reveal, background: COLORS.surface, border: `${picked ? 2 : 1}px solid ${picked ? COLORS.brand : COLORS.line}`, borderRadius: 12, padding: 20}}>
              <span style={{background: COLORS.softBg, color: COLORS.brand, borderRadius: 9999, padding: '4px 10px', fontSize: 12, fontWeight: 600}}>{t.tag}</span>
              <p style={{color: COLORS.ink, fontWeight: 700, margin: '12px 0 0'}}>{t.name}</p>
              <p style={{color: COLORS.muted, fontSize: 14, margin: '4px 0 0'}}>{t.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
