import React from 'react';
import {Composition, AbsoluteFill} from 'remotion';

const Placeholder: React.FC = () => (
  <AbsoluteFill className="bg-[#002147] items-center justify-center">
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
