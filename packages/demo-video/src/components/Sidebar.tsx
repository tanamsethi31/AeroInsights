import React from 'react';
import {staticFile} from 'remotion';
import {LayoutGrid, Table2, ShieldCheck, SlidersHorizontal, BrainCircuit, LineChart, FileText} from 'lucide-react';
import {COLORS} from '../theme/tokens';

export type Route = 'dashboard' | 'portfolio' | 'risk' | 'scenarios' | 'intelligence' | 'rate' | 'reports';

const ITEMS: {key: Route; label: string; Icon: React.FC<any>}[] = [
  {key: 'dashboard', label: 'Dashboard', Icon: LayoutGrid},
  {key: 'portfolio', label: 'Portfolio', Icon: Table2},
  {key: 'risk', label: 'Risk & ECL', Icon: ShieldCheck},
  {key: 'scenarios', label: 'Scenarios', Icon: SlidersHorizontal},
  {key: 'intelligence', label: 'Intelligence', Icon: BrainCircuit},
  {key: 'rate', label: 'Rate Outlook', Icon: LineChart},
  {key: 'reports', label: 'Reports', Icon: FileText},
];

export const Sidebar: React.FC<{active: Route}> = ({active}) => (
  <div style={{width: 240, background: COLORS.surface, borderRight: `1px solid ${COLORS.line}`, display: 'flex', flexDirection: 'column', padding: 12, gap: 4, flexShrink: 0}}>
    {/* Logo + wordmark */}
    <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '12px 8px', marginBottom: 8}}>
      <div style={{background: COLORS.brand, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
        <img src={staticFile('logo.png')} alt="" style={{width: 20, height: 20, objectFit: 'contain'}} />
      </div>
      <span style={{color: COLORS.ink, fontWeight: 800, letterSpacing: '-0.5px', fontSize: 18}}>AeroInsights</span>
    </div>
    {ITEMS.map(({key, label, Icon}) => {
      const on = key === active;
      return (
        <div
          key={key}
          style={{
            background: on ? COLORS.brand : 'transparent',
            color: on ? '#fff' : COLORS.muted,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          <Icon size={18} />
          {label}
        </div>
      );
    })}
  </div>
);
