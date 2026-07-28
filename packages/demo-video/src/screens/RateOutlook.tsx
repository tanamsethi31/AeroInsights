import React from 'react';
import {AnimatedLine} from '../components/charts/AnimatedLine';
import {COLORS} from '../theme/tokens';

export const RateOutlook: React.FC<{localStart: number}> = ({localStart}) => (
  <div style={{height: '100%', background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column'}}>
    <p style={{color: COLORS.ink, fontWeight: 700, fontSize: 18, margin: 0}}>Lease Rate Outlook</p>
    <p style={{color: COLORS.muted, fontSize: 14, margin: '4px 0 24px'}}>Forward lease-rate curve · A320neo · $/month (000s)</p>
    <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <AnimatedLine start={localStart + 15} width={900} height={300} points={[285, 292, 300, 311, 318, 322, 330, 341, 349, 356]} />
    </div>
    <div style={{display: 'flex', gap: 32, fontSize: 14}}>
      {[['Spot', '$285k'], ['12m fwd', '$318k'], ['24m fwd', '$356k']].map(([k, v]) => (
        <div key={k}><span style={{color: COLORS.muted}}>{k} </span><span style={{color: COLORS.ink, fontWeight: 700}}>{v}</span></div>
      ))}
    </div>
  </div>
);
