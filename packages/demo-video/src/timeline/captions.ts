export interface CaptionCue { from: number; to: number; text: string; }

// Frames at 30fps. Captions for the real-platform screen tour. Scene layout
// (see DemoVideo): intro 0-90, then nine 270-frame screen scenes, outro from 2520.
export const CAPTIONS: CaptionCue[] = [
  {from: 110, to: 350, text: 'The dashboard — your whole book at a glance'},
  {from: 380, to: 620, text: '173 leases, 48 lessees — live, not a spreadsheet'},
  {from: 650, to: 890, text: 'IFRS 9 ECL — automatic staging, audit-ready'},
  {from: 920, to: 1160, text: 'Stress-test the entire book in one click'},
  {from: 1190, to: 1430, text: 'Build any scenario — sliders or JSON, Monte Carlo'},
  {from: 1460, to: 1700, text: 'Lessee Radar — operational & credit signals'},
  {from: 1730, to: 1970, text: 'Ask in plain English — the AI reads your book'},
  {from: 2000, to: 2240, text: 'Lease-rate outlook — forward curves'},
  {from: 2270, to: 2500, text: 'Audit-ready reports — board, audit, disclosure'},
];

export function captionAt(frame: number): string | null {
  const cue = CAPTIONS.find((c) => frame >= c.from && frame <= c.to);
  return cue ? cue.text : null;
}
