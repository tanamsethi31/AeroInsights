import React from 'react';
import {Composition, AbsoluteFill} from 'remotion';
import {FONT_FAMILY} from './theme/fonts';
import {COLORS} from './theme/tokens';

const Placeholder: React.FC = () => (
  <AbsoluteFill
    style={{fontFamily: FONT_FAMILY, background: COLORS.brand}}
    className="items-center justify-center"
  >
    <span className="text-white text-6xl font-black">AeroInsights</span>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <Composition
    id="AeroInsightsDemo"
    component={Placeholder}
    durationInFrames={4800}
    fps={30}
    width={1920}
    height={1080}
  />
);
