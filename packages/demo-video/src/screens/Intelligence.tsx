import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS, statusColor, RiskStatus} from '../theme/tokens';

const RADAR: {name: string; score: number; status: RiskStatus; signal: string}[] = [
  {name: 'IndiGo Airlines', score: 82, status: 'red', signal: 'Covenant breach risk · 47 DPD'},
  {name: 'Aeromexico', score: 88, status: 'red', signal: 'Insolvency filed · Concurso'},
  {name: 'Pacific Wings', score: 54, status: 'amber', signal: 'Fleet expansion · new RFP'},
  {name: 'SkyWave Air', score: 33, status: 'green', signal: 'Traffic recovery +18% MoM'},
];

export const Intelligence: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 16}}>
      <p style={{color: COLORS.ink, fontWeight: 700, fontSize: 18, margin: 0}}>Lessee Radar</p>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
        {RADAR.map((l, i) => {
          const reveal = interpolate(frame, [localStart + 10 + i * 8, localStart + 10 + i * 8 + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <div key={l.name} style={{opacity: reveal, background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16}}>
              <div style={{width: 56, height: 56, borderRadius: 9999, border: `4px solid ${statusColor(l.status)}`, color: statusColor(l.status), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0}}>{l.score}</div>
              <div style={{flex: 1}}>
                <p style={{color: COLORS.ink, fontWeight: 700, margin: 0}}>{l.name}</p>
                <p style={{color: COLORS.muted, fontSize: 14, margin: '2px 0 0'}}>{l.signal}</p>
              </div>
              <span style={{background: statusColor(l.status), color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 9999, padding: '4px 12px', textTransform: 'uppercase'}}>{l.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
