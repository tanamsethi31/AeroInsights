import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';
import {ScenarioTree} from '../components/charts/ScenarioTree';
import {COLORS} from '../theme/tokens';
import {SCENARIOS} from '../data/portfolio';

export const ScenarioBuilder: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  const fuel = Math.round(interpolate(frame, [localStart + 40, localStart + 110], [0, 40], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const dslMode = frame > localStart + 140;
  const ran = frame > localStart + 230;
  const validTicks = interpolate(frame, [localStart + 120, localStart + 160], [0, 3], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const card: React.CSSProperties = {background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 24};
  return (
    <div style={{height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20}}>
      <div style={{...card, display: 'flex', flexDirection: 'column', gap: 20}}>
        <div style={{display: 'flex', gap: 12, fontSize: 14, fontWeight: 600}}>
          <span style={{color: !dslMode ? COLORS.brand : COLORS.muted}}>Form</span>
          <span style={{color: dslMode ? COLORS.brand : COLORS.muted}}>JSON (DSL)</span>
        </div>
        {!dslMode ? (
          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <div>
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 14}}><span style={{color: COLORS.ink}}>Jet Fuel</span><span style={{color: COLORS.brand, fontWeight: 700}}>+{fuel}%</span></div>
              <div style={{background: COLORS.line, height: 8, borderRadius: 9999, marginTop: 8}}><div style={{width: `${(fuel / 60) * 100}%`, background: COLORS.brand, height: 8, borderRadius: 9999}} /></div>
            </div>
            {[['Probability — Base', '60%'], ['Probability — Adverse', '25%'], ['Probability — Severe', '15%']].map(([k, v]) => (
              <div key={k} style={{display: 'flex', justifyContent: 'space-between', fontSize: 14}}><span style={{color: COLORS.muted}}>{k}</span><span style={{color: COLORS.ink, fontWeight: 600}}>{v}</span></div>
            ))}
          </div>
        ) : (
          <pre style={{background: COLORS.brandDeep, color: '#9ec5ff', borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.6, overflow: 'hidden', margin: 0}}>{`{
  "shock": { "fuel": 0.40 },
  "weights": { "base": 0.6, "adv": 0.25, "sev": 0.15 },
  "lgd_regime": "stressed"
}`}</pre>
        )}
        <div style={{marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6}}>
          {['Macro inputs set', 'Weights sum to 100%', 'LGD regime valid'].map((c, i) => (
            <div key={c} style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, opacity: i < validTicks ? 1 : 0.3}}>
              <span style={{background: i < validTicks ? COLORS.green : COLORS.line, width: 16, height: 16, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10}}>✓</span>
              <span style={{color: COLORS.ink}}>{c}</span>
            </div>
          ))}
          <div style={{background: ran ? COLORS.brand : COLORS.muted, alignSelf: 'flex-start', marginTop: 8, borderRadius: 8, padding: '10px 24px', color: '#fff', fontSize: 14, fontWeight: 600}}>{ran ? 'Running…' : 'Run scenario'}</div>
        </div>
      </div>
      <div style={{...card, display: 'flex', flexDirection: 'column', gap: 20}}>
        <p style={{color: COLORS.ink, fontWeight: 700, margin: 0}}>Results <span style={{color: COLORS.muted, fontWeight: 400, fontSize: 14}}>· probability-weighted ECL</span></p>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12}}>
          {SCENARIOS.map((s) => (
            <div key={s.label} style={{border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 12, textAlign: 'center'}}>
              <p style={{color: COLORS.muted, fontSize: 12, margin: 0}}>{s.label} · {s.weight}%</p>
              <p style={{color: COLORS.ink, fontSize: 20, fontWeight: 900, margin: '4px 0 0'}}>{ran ? s.value : '—'}</p>
            </div>
          ))}
        </div>
        <p style={{color: COLORS.muted, fontSize: 14, margin: 0}}>Run history</p>
        {ran && <ScenarioTree start={localStart + 240} nodes={SCENARIOS.map((s) => ({label: s.label, value: s.value, status: s.status}))} />}
      </div>
    </div>
  );
};
