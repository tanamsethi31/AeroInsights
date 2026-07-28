import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';
import {COLORS, statusColor, RiskStatus} from '../../theme/tokens';

// A root run that sprouts child branches (sensitivity variants) over time.
export const ScenarioTree: React.FC<{
  nodes: {label: string; value: string; status: RiskStatus}[]; start: number;
}> = ({nodes, start}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'relative', height: 220, width: 360}}>
      {/* Root */}
      <div style={{position: 'absolute', left: 0, top: 90, background: COLORS.brand, color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600}}>
        Run · Base
      </div>
      {nodes.map((n, i) => {
        const appear = interpolate(frame, [start + i * 14, start + i * 14 + 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const ty = (i - (nodes.length - 1) / 2) * 70;
        return (
          <div key={n.label} style={{opacity: appear}}>
            <svg style={{position: 'absolute', left: 130, top: 105}} width="90" height={Math.abs(ty) + 4}>
              <path d={`M 0 ${ty < 0 ? Math.abs(ty) : 0} C 45 ${ty < 0 ? Math.abs(ty) : 0}, 45 ${ty < 0 ? 0 : ty}, 90 ${ty < 0 ? 0 : ty}`}
                fill="none" stroke={COLORS.line} strokeWidth="2" />
            </svg>
            <div style={{position: 'absolute', left: 230, top: 96 + ty, border: `1px solid ${statusColor(n.status)}`, background: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500, boxShadow: '0 1px 3px rgba(0,0,0,0.08)'}}>
              <span style={{color: statusColor(n.status)}}>{n.label}</span> <b>{n.value}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
};
