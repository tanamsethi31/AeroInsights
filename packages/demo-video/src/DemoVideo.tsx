import React from 'react';
import {AbsoluteFill, Series, Audio, staticFile} from 'remotion';
import {ScreenShot, Focus} from './components/ScreenShot';
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
// Each screen opens full-page, then spotlights + zooms into `focus` (normalised
// region of the screenshot). Tuned against the captured frames.
const SCREENS: {src: string; focus: Focus}[] = [
  {src: 'captures/01-dashboard.png',    focus: {x: 0.17, y: 0.21, w: 0.82, h: 0.18, scale: 1.5}}, // KPI strip
  {src: 'captures/02-portfolio.png',    focus: {x: 0.17, y: 0.26, w: 0.64, h: 0.15, scale: 1.6}}, // KPI cards
  {src: 'captures/03-risk.png',         focus: {x: 0.17, y: 0.32, w: 0.82, h: 0.17, scale: 1.5}}, // ECL cards
  {src: 'captures/04-scenarios.png',    focus: {x: 0.28, y: 0.28, w: 0.60, h: 0.32, scale: 1.4}}, // engine
  {src: 'captures/05-builder.png',      focus: {x: 0.64, y: 0.22, w: 0.32, h: 0.32, scale: 1.7}}, // run config / Monte Carlo
  {src: 'captures/06-intelligence.png', focus: {x: 0.18, y: 0.28, w: 0.78, h: 0.24, scale: 1.5}}, // signals
  {src: 'captures/09-ai.png',           focus: {x: 0.71, y: 0.15, w: 0.27, h: 0.20, scale: 1.85}}, // AI answer
  {src: 'captures/07-rate.png',         focus: {x: 0.22, y: 0.28, w: 0.62, h: 0.42, scale: 1.4}}, // curve
  {src: 'captures/08-reports.png',      focus: {x: 0.17, y: 0.30, w: 0.56, h: 0.30, scale: 1.5}}, // template cards
];

export const TOTAL = INTRO + SCREENS.length * SCENE + OUTRO; // 2730

export const DemoVideo: React.FC = () => (
  <AbsoluteFill style={{fontFamily: FONT_FAMILY, background: '#000'}}>
    <Series>
      <Series.Sequence durationInFrames={INTRO}>
        <TitleCard durationInFrames={INTRO} />
      </Series.Sequence>
      {SCREENS.map(({src, focus}) => (
        <Series.Sequence key={src} durationInFrames={SCENE}>
          <ScreenShot src={src} durationInFrames={SCENE} focus={focus} />
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
