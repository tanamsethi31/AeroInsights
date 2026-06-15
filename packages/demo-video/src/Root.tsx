import React from 'react';
import {Composition} from 'remotion';
import {DemoVideo} from './DemoVideo';
import './theme/fonts';

export const Root: React.FC = () => (
  <Composition
    id="AeroInsightsDemo"
    component={DemoVideo}
    durationInFrames={4800}
    fps={30}
    width={1920}
    height={1080}
  />
);
