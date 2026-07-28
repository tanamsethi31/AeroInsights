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
// Focus rectangles measured against #root in the live app (the captures are
// #root at 2x, so these normalised coords map 1:1 onto the screenshots).
const SCREENS: {src: string; focus: Focus}[] = [
  {src: 'captures/01-dashboard.png',    focus: {x: 0.2008, y: 0.2735, w: 0.7631, h: 0.2104, scale: 1.20}}, // KPI strip
  {src: 'captures/02-portfolio.png',    focus: {x: 0.2008, y: 0.2826, w: 0.7631, h: 0.1642, scale: 1.24}}, // KPI cards
  {src: 'captures/03-risk.png',         focus: {x: 0.2008, y: 0.4623, w: 0.7631, h: 0.1915, scale: 1.22}}, // ECL stat cards
  {src: 'captures/04-scenarios.png',    focus: {x: 0.2016, y: 0.4958, w: 0.3745, h: 0.2153, scale: 1.80}}, // Baseline scenario card
  {src: 'captures/05-builder.png',      focus: {x: 0.7518, y: 0.2735, w: 0.2122, h: 0.3059, scale: 1.95}}, // Run Configuration panel
  {src: 'captures/06-intelligence.png', focus: {x: 0.2008, y: 0.3833, w: 0.7631, h: 0.0899, scale: 1.30}}, // signal counts row
  {src: 'captures/09-ai.png',           focus: {x: 0.7100, y: 0.3200, w: 0.2800, h: 0.1900, scale: 2.05}}, // AI answer bubble
  {src: 'captures/07-rate.png',         focus: {x: 0.2050, y: 0.2750, w: 0.5900, h: 0.1350, scale: 1.50}}, // rate KPI cards
  {src: 'captures/08-reports.png',      focus: {x: 0.2008, y: 0.4025, w: 0.5050, h: 0.3737, scale: 1.50}}, // template cards
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
