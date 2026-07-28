import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';
import {AnimatedBars} from '../components/charts/AnimatedBars';
import {COLORS} from '../theme/tokens';
import {ECL_HIGHLIGHT} from '../data/portfolio';

export const RiskECL: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  const expand = interpolate(frame, [localStart + 120, localStart + 150], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const card: React.CSSProperties = {background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 24};
  return (
    <div style={{height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20}}>
      <div style={{...card, display: 'flex', flexDirection: 'column'}}>
        <p style={{color: COLORS.ink, fontWeight: 700, margin: 0}}>Stage Distribution</p>
        <p style={{color: COLORS.muted, fontSize: 14, margin: '4px 0 16px'}}>ECL by IFRS 9 stage ($M)</p>
        <AnimatedBars start={localStart + 20} height={220} data={[
          {label: 'Stage 1', value: 12.1, color: COLORS.green},
          {label: 'Stage 2', value: 13.8, color: COLORS.amber},
          {label: 'Stage 3', value: 21.3, color: COLORS.red},
        ]} />
      </div>
      <div style={{...card, display: 'flex', flexDirection: 'column', gap: 16}}>
        <div style={{background: COLORS.softBg, borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 15}}>
          <span style={{color: COLORS.brand, fontWeight: 700}}>ECL = PD × LGD × EAD</span>
        </div>
        <div style={{border: `1px solid ${COLORS.red}`, borderRadius: 8, padding: 16, opacity: 0.4 + expand * 0.6}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span style={{color: COLORS.ink, fontWeight: 600}}>{ECL_HIGHLIGHT.lessee}</span>
            <span style={{color: COLORS.red, fontSize: 14, fontWeight: 700}}>{ECL_HIGHLIGHT.stage}</span>
          </div>
          <div style={{maxHeight: expand * 120, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12, fontSize: 14}}>
            {[['EAD', ECL_HIGHLIGHT.ead], ['PD (lifetime)', ECL_HIGHLIGHT.pdLifetime], ['LGD', ECL_HIGHLIGHT.lgd], ['ECL', ECL_HIGHLIGHT.eclLifetime]].map(([k, v]) => (
              <div key={String(k)}>
                <p style={{color: COLORS.muted, fontSize: 12, margin: 0}}>{k}</p>
                <p style={{color: COLORS.ink, fontWeight: 700, margin: 0}}>{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
          {[`${ECL_HIGHLIGHT.dpd} DPD backstop`, 'Country watchlist', 'SICR — Active'].map((t) => (
            <span key={t} style={{background: 'rgba(185,28,28,0.10)', color: COLORS.red, borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 600}}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
};
