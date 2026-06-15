import React from 'react';
import {CountUp} from '../components/charts/CountUp';
import {Globe} from '../components/charts/Globe';
import {AnimatedBars} from '../components/charts/AnimatedBars';
import {COLORS} from '../theme/tokens';
import {KPIS} from '../data/portfolio';

export const Dashboard: React.FC<{localStart: number}> = ({localStart}) => {
  const card: React.CSSProperties = {background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 12};
  const kpis = [
    {label: 'Portfolio Value', node: <CountUp target={2.41} decimals={2} prefix="$" suffix="B" start={localStart + 10} />},
    {label: 'Fleet Size', node: <CountUp target={KPIS.fleetSize} suffix=" Aircraft" start={localStart + 10} />},
    {label: 'Avg LTV', node: <CountUp target={67.3} decimals={1} suffix="%" start={localStart + 10} />},
    {label: 'ECL Reserve', node: <CountUp target={47.2} decimals={1} prefix="$" suffix="M" start={localStart + 10} />},
  ];
  return (
    <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 20}}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16}}>
        {kpis.map((k) => (
          <div key={k.label} style={{...card, padding: 20}}>
            <p style={{color: COLORS.muted, fontSize: 14, margin: 0}}>{k.label}</p>
            <p style={{color: COLORS.ink, fontSize: 30, fontWeight: 900, margin: '4px 0 0'}}>{k.node}</p>
          </div>
        ))}
      </div>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flex: 1, minHeight: 0}}>
        <div style={{...card, padding: 20, display: 'flex', flexDirection: 'column'}}>
          <p style={{color: COLORS.ink, fontWeight: 700, margin: 0}}>Lessee Intelligence Map</p>
          <p style={{color: COLORS.muted, fontSize: 14, margin: '4px 0 8px'}}>Counterparty risk by jurisdiction</p>
          <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Globe size={360} markers={[
              {country: 'India', status: 'red'}, {country: 'Mexico', status: 'red'},
              {country: 'Ireland', status: 'green'}, {country: 'United Kingdom', status: 'amber'},
              {country: 'Singapore', status: 'green'}, {country: 'United States', status: 'green'},
            ]} />
          </div>
        </div>
        <div style={{...card, padding: 20, display: 'flex', flexDirection: 'column'}}>
          <p style={{color: COLORS.ink, fontWeight: 700, margin: '0 0 12px'}}>Lease Maturity Profile</p>
          <div style={{flex: 1}}>
            <AnimatedBars start={localStart + 20} height={220}
              data={[2025, 2026, 2027, 2028, 2029, 2030].map((y, i) => ({label: String(y), value: [55, 88, 63, 95, 70, 42][i]}))} />
          </div>
        </div>
      </div>
    </div>
  );
};
