import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Sidebar, Route} from './Sidebar';
import {COLORS} from '../theme/tokens';
import {LESSOR, REPORTING_DATE} from '../data/portfolio';

export const AppShell: React.FC<{active: Route; title: string; children: React.ReactNode}> = ({active, title, children}) => (
  <AbsoluteFill style={{background: COLORS.softBg}}>
    <div style={{display: 'flex', height: '100%', width: '100%'}}>
      <Sidebar active={active} />
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
        {/* Top bar */}
        <div style={{background: COLORS.surface, borderBottom: `1px solid ${COLORS.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px'}}>
          <div>
            <p style={{color: COLORS.ink, fontSize: 20, fontWeight: 700, margin: 0}}>{title}</p>
            <p style={{color: COLORS.muted, fontSize: 14, margin: 0}}>{LESSOR} · {REPORTING_DATE}</p>
          </div>
          <div style={{background: COLORS.brand, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 9999, padding: '8px 16px', color: '#fff', fontSize: 14, fontWeight: 600}}>
            <span style={{width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block'}} /> AI
          </div>
        </div>
        {/* Content */}
        <div style={{flex: 1, overflow: 'hidden', padding: 28}}>{children}</div>
      </div>
    </div>
  </AbsoluteFill>
);
