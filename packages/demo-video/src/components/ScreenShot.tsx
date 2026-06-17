import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, staticFile, Img} from 'remotion';
import {COLORS} from '../theme/tokens';

// Captured app screenshots are ~2828x1640.
const IMG_ASPECT = 2828 / 1640;

const smooth = (t: number) => t * t * (3 - 2 * t); // ease-in-out

// A normalised region of the screenshot to draw attention to and zoom into.
export interface Focus { x: number; y: number; w: number; h: number; scale: number }

/**
 * Presents a real-platform screenshot. The scene opens showing the FULL,
 * uncropped page, briefly spotlights the contextual region (ring + dim), then
 * pushes in so that region fills the frame and holds. No initial cropping.
 */
export const ScreenShot: React.FC<{
  src: string;
  durationInFrames: number;
  focus?: Focus;
}> = ({src, durationInFrames, focus}) => {
  const frame = useCurrentFrame();
  const d = durationInFrames;

  // Clipped "viewport": exactly the screenshot's aspect, with a margin so it
  // reads as a framed screen. The image fills it 1:1 at scale 1 (no crop).
  const wrapperH = 1010;
  const wrapperW = Math.round(wrapperH * IMG_ASPECT);

  const enter = interpolate(frame, [0, 16], [0, 1], {extrapolateRight: 'clamp'});

  // Zoom blend: hold full page, ease into focus, hold focus.
  const zStart = Math.round(d * 0.30);
  const zEnd = Math.round(d * 0.62);
  const beta = focus ? smooth(interpolate(frame, [zStart, zEnd], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})) : 0;

  const S = focus ? focus.scale : 1.05;
  const cx = focus ? focus.x + focus.w / 2 : 0.5;
  const cy = focus ? focus.y + focus.h / 2 : 0.5;

  // No focus: a barely-there centred drift. With focus: 1 -> S blended by beta.
  const s = focus ? 1 + beta * (S - 1) : 1 + interpolate(frame, [0, d], [0, 0.05], {extrapolateRight: 'clamp'});
  const Tx = beta * (-s * wrapperW * (cx - 0.5));
  const Ty = beta * (-s * wrapperH * (cy - 0.5));

  // Spotlight ring: appears over the full page, then fades as the zoom lands.
  const ring = focus
    ? interpolate(frame, [Math.round(d * 0.10), Math.round(d * 0.24), Math.round(d * 0.50), Math.round(d * 0.62)], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;

  return (
    <AbsoluteFill style={{background: `radial-gradient(130% 130% at 50% 0%, ${COLORS.darkBg}, ${COLORS.brandDeep})`, alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          width: wrapperW,
          height: wrapperH,
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.5)',
          opacity: enter,
        }}
      >
        <div style={{position: 'relative', width: '100%', height: '100%', transform: `translate(${Tx}px, ${Ty}px) scale(${s})`, transformOrigin: 'center center'}}>
          <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
          {focus && (
            <div
              style={{
                position: 'absolute',
                left: `${focus.x * 100}%`,
                top: `${focus.y * 100}%`,
                width: `${focus.w * 100}%`,
                height: `${focus.h * 100}%`,
                border: '3px solid #5b8fd8',
                borderRadius: 10,
                boxShadow: '0 0 0 100vw rgba(3,12,28,0.45), 0 0 24px rgba(91,143,216,0.7)',
                opacity: ring,
              }}
            />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
