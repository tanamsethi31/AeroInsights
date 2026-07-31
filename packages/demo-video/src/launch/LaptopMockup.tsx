import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate, Easing} from 'remotion';
import {COLORS} from '../theme/tokens';
import {IMG_ASPECT, LabelChip} from './FramedScreen';

// A 3D laptop (lid + keyboard deck) showing a screenshot, with the viewing
// angle slowly rotating from a 3/4 view toward near-front.
export const LaptopMockup: React.FC<{src: string; label: string; durationInFrames: number}> = ({src, label, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 20, stiffness: 80, mass: 1}});
  const ry = interpolate(frame, [0, durationInFrames], [-28, -7], {extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease)});
  const rx = interpolate(frame, [0, durationInFrames], [18, 10], {extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease)});
  const lift = interpolate(enter, [0, 1], [90, 0]);

  const W = 1180;
  const H = Math.round(W / IMG_ASPECT);
  const deckH = Math.round(W * 0.6);
  const labelIn = interpolate(frame, [16, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: `radial-gradient(130% 130% at 50% 8%, ${COLORS.darkBg}, ${COLORS.brandDeep})`, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{perspective: 2400, opacity: enter}}>
        <div style={{transformStyle: 'preserve-3d', transform: `translateY(${lift}px) rotateX(${rx}deg) rotateY(${ry}deg)`}}>
          {/* lid / screen */}
          <div style={{width: W, height: H, background: '#0a0e16', borderRadius: '18px 18px 6px 6px', padding: 12, boxShadow: '0 50px 120px rgba(0,0,0,0.55)', position: 'relative', transformStyle: 'preserve-3d'}}>
            <div style={{position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: 9999, background: '#1b2430'}} />
            <div style={{width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden', background: '#fff'}}>
              <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center'}} />
            </div>
          </div>
          {/* keyboard deck, hinged at the lid's bottom edge and laid flat */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: H,
              width: W,
              height: deckH,
              transform: 'rotateX(-90deg)',
              transformOrigin: 'top center',
              transformStyle: 'preserve-3d',
              background: 'linear-gradient(180deg,#dadee5,#b4b9c5)',
              borderRadius: '0 0 22px 22px',
              boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6)',
            }}
          >
            <div style={{position: 'absolute', top: 0, left: '12%', width: '76%', height: 10, background: '#9aa0ad', borderRadius: '0 0 6px 6px'}} />
            <div style={{position: 'absolute', top: deckH * 0.15, left: '9%', width: '82%', height: deckH * 0.44, display: 'flex', flexDirection: 'column', gap: 6}}>
              {Array.from({length: 5}).map((_, r) => (
                <div key={r} style={{display: 'flex', gap: 6, flex: 1}}>
                  {Array.from({length: 14}).map((_, c) => (
                    <div key={c} style={{flex: 1, background: '#aeb4c0', borderRadius: 4, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.12)'}} />
                  ))}
                </div>
              ))}
            </div>
            <div style={{position: 'absolute', bottom: deckH * 0.08, left: '50%', transform: 'translateX(-50%)', width: '34%', height: deckH * 0.26, background: '#c6cad3', borderRadius: 10, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)'}} />
          </div>
        </div>
      </div>
      <LabelChip label={label} opacity={labelIn} y={interpolate(labelIn, [0, 1], [22, 0])} />
    </AbsoluteFill>
  );
};
