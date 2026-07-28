import {describe, it, expect} from 'vitest';
import {AIRCRAFT, LESSEES, KPIS, SCENARIOS, LESSOR, ECL_HIGHLIGHT} from './portfolio';

describe('portfolio data', () => {
  it('has the Aer Capital sample loaded', () => {
    expect(LESSOR).toBe('Aer Capital Partners Ltd.');
    expect(AIRCRAFT.length).toBeGreaterThanOrEqual(10);
    expect(KPIS.fleetSize).toBe(AIRCRAFT.length);
  });
  it('includes the distressed lessees used in the script', () => {
    const names = LESSEES.map((l) => l.name);
    expect(names).toContain('IndiGo Airlines');
    expect(names).toContain('Aeromexico');
  });
  it('exposes the three weighted scenarios summing to 100', () => {
    expect(SCENARIOS.map((s) => s.label)).toEqual(['Base', 'Adverse', 'Severe']);
    expect(SCENARIOS.reduce((a, s) => a + s.weight, 0)).toBe(100);
  });
  it('keeps the ECL highlight consistent with the spec', () => {
    expect(ECL_HIGHLIGHT.eclLifetime).toBe('$4.2M');
    expect(ECL_HIGHLIGHT.stage).toBe('Stage 3');
  });
});
