import React from 'react';
import {Composition} from 'remotion';
import {DemoVideo, TOTAL} from './DemoVideo';
import './theme/fonts';

export const Root: React.FC = () => (
  <Composition
    id="AeroInsightsDemo"
    component={DemoVideo}
    durationInFrames={TOTAL}
    fps={30}
    width={1920}
    height={1080}
  />
);
