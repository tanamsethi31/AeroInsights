// Brand tokens mirrored from .impeccable.md and src/styles/.
export const COLORS = {
  brand: '#002147',      // Oxford Blue
  brandDeep: '#001228',
  darkBg: '#0a1a33',
  softBg: '#f4f7fd',
  surface: '#ffffff',
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  red: '#B91C1C',        // Stage 3 / critical
  amber: '#B45309',      // watch
  green: '#15803D',      // healthy
  redFill: 'rgba(185,28,28,0.30)',
  amberFill: 'rgba(180,83,9,0.28)',
  greenFill: 'rgba(21,128,61,0.25)',
} as const;

// Conservative ease-out from the brand spec (zero bounce).
export const EASE = [0.23, 1, 0.32, 1] as const;

export type RiskStatus = 'red' | 'amber' | 'green';
export const statusColor = (s: RiskStatus) =>
  s === 'red' ? COLORS.red : s === 'amber' ? COLORS.amber : COLORS.green;
export const statusFill = (s: RiskStatus) =>
  s === 'red' ? COLORS.redFill : s === 'amber' ? COLORS.amberFill : COLORS.greenFill;
