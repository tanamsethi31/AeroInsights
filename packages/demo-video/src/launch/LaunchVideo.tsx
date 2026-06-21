import React from 'react';
import {AbsoluteFill, Audio, staticFile} from 'remotion';
import {TransitionSeries, springTiming, linearTiming} from '@remotion/transitions';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {fade} from '@remotion/transitions/fade';
import {clockWipe} from '@remotion/transitions/clock-wipe';
import {iris} from '@remotion/transitions/iris';
import {FONT_FAMILY} from '../theme/fonts';
import {HookScene, LogoScene, CTAScene} from './Scenes';
import {ZoomScreen} from './ZoomScreen';

// Durations sum to 968; transitions overlap by 68 -> net 900 frames (30s @30fps).
export const LAUNCH_TOTAL = 900;

const lin = (d: number) => linearTiming({durationInFrames: d});
const snap = springTiming({config: {damping: 200}, durationInFrames: 9});
const DIM = {width: 1920, height: 1080};

export const LaunchVideo: React.FC = () => (
  <AbsoluteFill style={{fontFamily: FONT_FAMILY, background: '#000'}}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={78}>
        <HookScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={lin(8)} />

      <TransitionSeries.Sequence durationInFrames={76}>
        <LogoScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-right'})} timing={snap} />

      <TransitionSeries.Sequence durationInFrames={108}>
        <ZoomScreen src="captures/01-dashboard.png" cx={0.582} cy={0.379} scale={1.4} mode="in" label="Your whole book, live" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({direction: 'from-left'})} timing={lin(8)} />

      <TransitionSeries.Sequence durationInFrames={104}>
        <ZoomScreen src="captures/03-risk.png" cx={0.582} cy={0.558} scale={1.45} mode="in" label="IFRS 9 ECL, automated" accent="#e0533d" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-bottom'})} timing={lin(8)} />

      <TransitionSeries.Sequence durationInFrames={110}>
        <ZoomScreen src="captures/05-builder.png" cx={0.858} cy={0.430} scale={2.25} mode="in" label="Stress-test in one click" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={clockWipe(DIM)} timing={lin(9)} />

      <TransitionSeries.Sequence durationInFrames={104}>
        <ZoomScreen src="captures/06-intelligence.png" cx={0.582} cy={0.428} scale={1.4} mode="out" label="Live counterparty signals" accent="#e0a23d" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: 'from-right'})} timing={lin(8)} />

      <TransitionSeries.Sequence durationInFrames={116}>
        <ZoomScreen src="captures/09-ai.png" cx={0.85} cy={0.415} scale={2.35} mode="in" label="Just ask. It answers." />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({direction: 'from-right'})} timing={lin(8)} />

      <TransitionSeries.Sequence durationInFrames={100}>
        <ZoomScreen src="captures/07-rate.png" cx={0.5} cy={0.3425} scale={1.5} mode="in" label="Forward-rate outlook" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={iris(DIM)} timing={lin(10)} />

      <TransitionSeries.Sequence durationInFrames={172}>
        <CTAScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>

    <Audio src={staticFile('music.mp3')} volume={0.3} />
  </AbsoluteFill>
);
