import React from 'react';
import {AbsoluteFill, Series, Sequence, Audio, staticFile} from 'remotion';
import {AppShell} from './components/AppShell';
import {Cursor} from './components/Cursor';
import {Caption} from './components/Caption';
import {Camera, CameraMove} from './components/Camera';
import {Dashboard} from './screens/Dashboard';
import {Portfolio} from './screens/Portfolio';
import {RiskECL} from './screens/RiskECL';
import {ScenarioLibrary} from './screens/ScenarioLibrary';
import {ScenarioBuilder} from './screens/ScenarioBuilder';
import {Intelligence} from './screens/Intelligence';
import {AIPanel} from './screens/AIPanel';
import {RateOutlook} from './screens/RateOutlook';
import {ExcelView} from './screens/ExcelView';
import {CTA} from './screens/CTA';
import {FONT_FAMILY} from './theme/fonts';

// Scene durations (frames). Sum MUST equal 4800.
const S = {dash: 420, port: 600, risk: 690, scen: 870, intel: 810, rate: 450, excel: 360, cta: 600};

const cameraMoves: CameraMove[] = [
  {from: 30, to: 120, scale: 1.06, x: 0, y: -10}, // gentle KPI emphasis on Scene 1
];

export const DemoVideo: React.FC = () => (
  <AbsoluteFill style={{fontFamily: FONT_FAMILY, background: '#ffffff'}}>
    <Series>
      <Series.Sequence durationInFrames={S.dash}>
        <Camera moves={cameraMoves}>
          <AppShell active="dashboard" title="Dashboard"><Dashboard localStart={0} /></AppShell>
        </Camera>
      </Series.Sequence>
      <Series.Sequence durationInFrames={S.port}>
        <AppShell active="portfolio" title="Portfolio"><Portfolio localStart={0} /></AppShell>
      </Series.Sequence>
      <Series.Sequence durationInFrames={S.risk}>
        <AppShell active="risk" title="Risk & ECL"><RiskECL localStart={0} /></AppShell>
      </Series.Sequence>
      <Series.Sequence durationInFrames={S.scen}>
        <AppShell active="scenarios" title="Scenarios">
          <Sequence durationInFrames={180}><ScenarioLibrary localStart={0} /></Sequence>
          <Sequence from={180}><ScenarioBuilder localStart={0} /></Sequence>
        </AppShell>
      </Series.Sequence>
      <Series.Sequence durationInFrames={S.intel}>
        <AppShell active="intelligence" title="Intelligence">
          <Intelligence localStart={0} />
          <AIPanel panelStart={320} />
        </AppShell>
      </Series.Sequence>
      <Series.Sequence durationInFrames={S.rate}>
        <AppShell active="rate" title="Rate Outlook"><RateOutlook localStart={0} /></AppShell>
      </Series.Sequence>
      <Series.Sequence durationInFrames={S.excel}><ExcelView localStart={0} /></Series.Sequence>
      <Series.Sequence durationInFrames={S.cta}><CTA localStart={0} /></Series.Sequence>
    </Series>

    {/* Global overlays — absolute-frame timed (NOT reset per Sequence). */}
    <Cursor />
    <Caption />
    <Audio src={staticFile('music.mp3')} volume={0.25} />
  </AbsoluteFill>
);
