import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS} from '../theme/tokens';
import {AIRCRAFT} from '../data/portfolio';

export const Portfolio: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  const rows = AIRCRAFT.slice(0, 8);
  const tabs = ['Lease Register', 'Fleet & Valuations', 'Lessees', 'Concentration', 'SD / MR', 'Performance'];
  const grid: React.CSSProperties = {display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', padding: '12px 24px'};
  return (
    <div style={{height: '100%', background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
      <div style={{display: 'flex', gap: 24, padding: '20px 24px 0', fontSize: 14, fontWeight: 600}}>
        {tabs.map((t, i) => (
          <span key={t} style={{color: i === 0 ? COLORS.brand : COLORS.muted, paddingBottom: 8, borderBottom: `2px solid ${i === 0 ? COLORS.brand : 'transparent'}`}}>{t}</span>
        ))}
      </div>
      <div style={{...grid, borderTop: `1px solid ${COLORS.line}`, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em'}}>
        {['Aircraft', 'Reg', 'Operator', 'Country', 'MV ($M)', 'Stage'].map((h) => <span key={h} style={{color: COLORS.muted}}>{h}</span>)}
      </div>
      {rows.map((a, i) => {
        const reveal = interpolate(frame, [localStart + 10 + i * 6, localStart + 10 + i * 6 + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const stageColor = a.stage >= 3 ? COLORS.red : a.stage === 2 ? COLORS.amber : COLORS.green;
        return (
          <div key={a.id} style={{...grid, opacity: reveal, borderTop: `1px solid ${COLORS.line}`, color: COLORS.ink, fontSize: 15}}>
            <span style={{fontWeight: 500}}>{a.type}</span>
            <span>{a.reg}</span>
            <span>{a.operator}</span>
            <span>{a.country}</span>
            <span>{a.mv}</span>
            <span style={{color: stageColor, fontWeight: 600}}>Stage {a.stage}</span>
          </div>
        );
      })}
    </div>
  );
};
