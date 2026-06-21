import React from 'react';
import {Composition} from 'remotion';
import {DemoVideo, TOTAL} from './DemoVideo';
import {LaunchVideo, LAUNCH_TOTAL} from './launch/LaunchVideo';
import './theme/fonts';

export const Root: React.FC = () => (
  <>
    <Composition
      id="AeroInsightsDemo"
      component={DemoVideo}
      durationInFrames={TOTAL}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="AeroInsightsLaunch"
      component={LaunchVideo}
      durationInFrames={LAUNCH_TOTAL}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
