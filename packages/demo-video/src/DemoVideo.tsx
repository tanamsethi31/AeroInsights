import React from 'react';
import {AbsoluteFill, Series, Audio, staticFile} from 'remotion';
import {ScreenShot} from './components/ScreenShot';
import {TitleCard} from './components/TitleCard';
import {CTA} from './screens/CTA';
import {Caption} from './components/Caption';
import {FONT_FAMILY} from './theme/fonts';

const INTRO = 90;
const SCENE = 270;
const OUTRO = 210;

// Real-platform screen tour. Each scene is a captured screenshot of the live
// AeroInsights app (public/captures) presented with a Ken-Burns move; captions
// and the music bed are global overlays timed in absolute frames.
const SCREENS = [
  'captures/01-dashboard.png',
  'captures/02-portfolio.png',
  'captures/03-risk.png',
  'captures/04-scenarios.png',
  'captures/05-builder.png',
  'captures/06-intelligence.png',
  'captures/09-ai.png',
  'captures/07-rate.png',
  'captures/08-reports.png',
];

export const TOTAL = INTRO + SCREENS.length * SCENE + OUTRO; // 2730

export const DemoVideo: React.FC = () => (
  <AbsoluteFill style={{fontFamily: FONT_FAMILY, background: '#000'}}>
    <Series>
      <Series.Sequence durationInFrames={INTRO}>
        <TitleCard durationInFrames={INTRO} />
      </Series.Sequence>
      {SCREENS.map((src, i) => (
        <Series.Sequence key={src} durationInFrames={SCENE}>
          <ScreenShot src={src} durationInFrames={SCENE} index={i} />
        </Series.Sequence>
      ))}
      <Series.Sequence durationInFrames={OUTRO}>
        <CTA localStart={0} />
      </Series.Sequence>
    </Series>

    {/* Global overlays — absolute-frame timed. */}
    <Caption />
    <Audio src={staticFile('music.mp3')} volume={0.22} />
  </AbsoluteFill>
);
