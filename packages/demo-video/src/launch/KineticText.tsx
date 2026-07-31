import React from 'react';
import {useCurrentFrame, useVideoConfig, spring, interpolate} from 'remotion';

// Word-by-word kinetic text: each word springs up + un-blurs, staggered.
export const KineticText: React.FC<{
  text: string;
  delay?: number;
  color?: string;
  size?: number;
  weight?: number;
  stagger?: number;
  style?: React.CSSProperties;
}> = ({text, delay = 0, color = '#fff', size = 64, weight = 900, stagger = 3, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.split(' ');
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: '0 0.28em', justifyContent: 'center', maxWidth: '90%', ...style}}>
      {words.map((w, i) => {
        const t = spring({frame: frame - delay - i * stagger, fps, config: {damping: 14, stiffness: 130, mass: 0.6}});
        const y = interpolate(t, [0, 1], [30, 0]);
        const blur = interpolate(t, [0, 1], [12, 0]);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              color,
              fontSize: size,
              fontWeight: weight,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              opacity: t,
              transform: `translateY(${y}px)`,
              filter: `blur(${blur}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
