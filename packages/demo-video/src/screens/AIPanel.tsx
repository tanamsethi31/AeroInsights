import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS} from '../theme/tokens';

const QUESTION = 'Which lessees are highest risk and why?';
const ANSWER = 'IndiGo and Aeromexico are your two highest-risk counterparties. Both are Stage 3: IndiGo is 47 days past due with a country-watchlist flag (India, IBC); Aeromexico has filed under Concurso. Combined lifetime ECL is $7.6M — 16% of reserves. Recommend prioritising both for restructuring review.';

// `panelStart` is the local frame at which the AI panel begins to open.
export const AIPanel: React.FC<{panelStart: number}> = ({panelStart}) => {
  const frame = useCurrentFrame();
  const open = interpolate(frame, [panelStart, panelStart + 16], [100, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const typed = Math.floor(interpolate(frame, [panelStart + 30, panelStart + 70], [0, QUESTION.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const answered = Math.floor(interpolate(frame, [panelStart + 90, panelStart + 230], [0, ANSWER.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  return (
    <div style={{position: 'absolute', top: 0, right: 0, bottom: 0, width: 520, transform: `translateX(${open}%)`, background: COLORS.surface, borderLeft: `1px solid ${COLORS.line}`, boxShadow: '-12px 0 40px rgba(0,33,71,0.10)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, zIndex: 30}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <span style={{background: COLORS.brand, borderRadius: 9999, padding: '6px 12px', color: '#fff', fontSize: 14, fontWeight: 600}}>AeroInsights AI</span>
      </div>
      <div style={{background: COLORS.softBg, borderRadius: 8, padding: 12, fontSize: 14}}>
        <span style={{color: COLORS.ink}}>{QUESTION.slice(0, typed)}</span>
        {typed < QUESTION.length && <span style={{color: COLORS.brand}}>|</span>}
      </div>
      {answered > 0 && (
        <div style={{color: COLORS.ink, fontSize: 15, lineHeight: 1.6}}>{ANSWER.slice(0, answered)}</div>
      )}
      {answered >= ANSWER.length && (
        <div style={{marginTop: 'auto', background: COLORS.softBg, color: COLORS.brand, borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600}}>↳ Drafted for board pack</div>
      )}
    </div>
  );
};
