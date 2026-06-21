import React from 'react';
import {AbsoluteFill, Audio, staticFile} from 'remotion';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {slide} from '@remotion/transitions/slide';
import {fade} from '@remotion/transitions/fade';
import {FONT_FAMILY} from '../theme/fonts';
import {HookScene, LogoScene, CTAScene} from './Scenes';
import {ZoomScreen} from './ZoomScreen';
import {PanScreen} from './PanScreen';
import {LaptopMockup} from './LaptopMockup';

// Sequence durations sum to 1710; twelve 9-frame transitions overlap -> net
// 1602 frames (~53s @ 30fps).
export const LAUNCH_TOTAL = 1602;

const lin = (d: number) => linearTiming({durationInFrames: d});
const T = 9;

export const LaunchVideo: React.FC = () => (
  <AbsoluteFill style={{fontFamily: FONT_FAMILY, background: '#000'}}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={78}>
        <HookScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={76}>
        <LogoScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={150}>
        <LaptopMockup src="captures/01-dashboard.png" label="Run your entire leasing book" durationInFrames={150} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={140}>
        <ZoomScreen src="captures/01-dashboard.png" cx={0.582} cy={0.379} scale={1.45} mode="in" label="Your whole book, live" durationInFrames={140} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-left'})} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={130}>
        <PanScreen src="captures/01-dashboard.png" label="Every workflow, one sidebar" durationInFrames={130} cx={0.12} scale={1.75} cyFrom={0.17} cyTo={0.85} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-bottom'})} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={140}>
        <ZoomScreen src="captures/03-risk.png" cx={0.582} cy={0.558} scale={1.5} mode="in" label="IFRS 9 ECL, automated" accent="#e0533d" durationInFrames={140} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={125}>
        <ZoomScreen src="captures/04-scenarios.png" cx={0.55} cy={0.48} scale={1.32} mode="in" label="Macro · Distress · Insolvency" durationInFrames={125} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={145}>
        <ZoomScreen src="captures/05-builder.png" cx={0.858} cy={0.43} scale={2.25} mode="in" label="Stress-test in one click" durationInFrames={145} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-right'})} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={130}>
        <ZoomScreen src="captures/06-intelligence.png" cx={0.582} cy={0.428} scale={1.45} mode="out" label="Live counterparty signals" accent="#e0a23d" durationInFrames={130} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={150}>
        <PanScreen src="captures/09-ai.png" label="Generate reports · export data · run scenarios" durationInFrames={150} cx={0.83} scale={1.65} cyFrom={0.1} cyTo={0.9} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-right'})} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={140}>
        <PanScreen src="captures/07-rate.png" label="Forward-rate outlook" durationInFrames={140} cx={0.58} scale={1.5} cyFrom={0.17} cyTo={0.86} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={130}>
        <ZoomScreen src="captures/08-reports.png" cx={0.45} cy={0.52} scale={1.4} mode="in" label="Audit-ready reports, one click" durationInFrames={130} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin(T)} />

      <TransitionSeries.Sequence durationInFrames={176}>
        <CTAScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>

    <Audio src={staticFile('music.mp3')} volume={0.3} />
  </AbsoluteFill>
);
