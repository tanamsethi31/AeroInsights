import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {COLORS} from '../theme/tokens';

const CELLS = [
  ['Metric', 'Formula', 'Value'],
  ['Fleet size', '=AI.Portfolio("fleet_size")', '10'],
  ['Portfolio value', '=AI.Portfolio("nbv")', '$2.41B'],
  ['ECL reserve', '=AI.Portfolio("ecl")', '$47.2M'],
  ['Stage 3 count', '=AI.Portfolio("stage3")', '4'],
];

export const ExcelView: React.FC<{localStart: number}> = ({localStart}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: '#f3f3f3', padding: 64, justifyContent: 'center'}}>
      <div style={{background: '#fff', borderRadius: 8, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden', border: '1px solid #d0d0d0'}}>
        <div style={{background: '#217346', color: '#fff', padding: '10px 20px', fontSize: 14, fontWeight: 600}}>Excel · AeroInsights Add-In</div>
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 15}}>
          <tbody>
            {CELLS.map((row, r) => {
              const reveal = interpolate(frame, [localStart + 10 + r * 12, localStart + 10 + r * 12 + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
              return (
                <tr key={r} style={{opacity: r === 0 ? 1 : reveal, background: r === 0 ? '#f7f7f7' : '#fff'}}>
                  {row.map((c, ci) => (
                    <td key={ci} style={{borderBottom: '1px solid #e6e6e6', borderRight: '1px solid #e6e6e6', color: ci === 1 ? COLORS.brand : '#1f1f1f', fontFamily: ci === 1 ? 'monospace' : undefined, padding: '12px 20px'}}>{c}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AbsoluteFill>
  );
};
