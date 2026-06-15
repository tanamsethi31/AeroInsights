export interface CaptionCue { from: number; to: number; text: string; }

// Frames at 30fps. Text per the video spec (captions column).
export const CAPTIONS: CaptionCue[] = [
  {from: 30, to: 410, text: 'AeroInsights: The Dashboard, portfolio summary'},
  {from: 440, to: 1000, text: 'Lease register · Fleet & valuations · Concentration · Maturity'},
  {from: 1040, to: 1690, text: 'IFRS 9 ECL · automatic staging · SICR triggers · audit trail'},
  {from: 1730, to: 1990, text: 'Scenario Library · ready-made stress templates'},
  {from: 2000, to: 2320, text: 'Custom Scenario Builder · sliders or JSON (DSL)'},
  {from: 2330, to: 2560, text: 'One-click run · immutable, branchable history'},
  {from: 2600, to: 3370, text: 'Lessee Radar · live risk scoring · AI: ask · summarise · draft'},
  {from: 3410, to: 3820, text: 'Lease Rate Outlook · forward-curve analytics'},
  {from: 3860, to: 4180, text: 'Excel Add-In · live data, =AI.Portfolio(…)'},
  {from: 4230, to: 4780, text: 'Sign up in seconds · aeroinsights.vercel.app · Book a demo'},
];

export function captionAt(frame: number): string | null {
  const cue = CAPTIONS.find((c) => frame >= c.from && frame <= c.to);
  return cue ? cue.text : null;
}
