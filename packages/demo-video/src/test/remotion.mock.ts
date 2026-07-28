// Test-only stand-in for `remotion`, aliased in by vitest.config.ts.
// Lets pure-logic unit tests run under Node without loading Remotion's
// browser bundle. `interpolate` mirrors Remotion's clamp/easing semantics;
// the other exports are inert no-ops sufficient for module import.
type ExtrapolateType = 'extend' | 'clamp' | 'identity';
interface InterpolateOptions {
  easing?: (input: number) => number;
  extrapolateLeft?: ExtrapolateType;
  extrapolateRight?: ExtrapolateType;
}

export function interpolate(
  input: number,
  inputRange: number[],
  outputRange: number[],
  opts: InterpolateOptions = {},
): number {
  const {easing = (x) => x, extrapolateLeft = 'extend', extrapolateRight = 'extend'} = opts;

  if (input < inputRange[0]) {
    if (extrapolateLeft === 'clamp') return outputRange[0];
    if (extrapolateLeft === 'identity') return input;
  }
  const lastIdx = inputRange.length - 1;
  if (input > inputRange[lastIdx]) {
    if (extrapolateRight === 'clamp') return outputRange[lastIdx];
    if (extrapolateRight === 'identity') return input;
  }

  // Find the bracketing segment.
  let i = 0;
  while (i < inputRange.length - 2 && input > inputRange[i + 1]) i++;
  const inMin = inputRange[i], inMax = inputRange[i + 1];
  const outMin = outputRange[i], outMax = outputRange[i + 1];
  const raw = inMax === inMin ? 0 : (input - inMin) / (inMax - inMin);
  const progress = easing(raw);
  return outMin + progress * (outMax - outMin);
}

export const useCurrentFrame = (): number => 0;
export const useVideoConfig = () => ({fps: 30, width: 1920, height: 1080, durationInFrames: 4800});
export const spring = (): number => 1;
export const staticFile = (p: string): string => p;
export const delayRender = (): number => 0;
export const continueRender = (): void => undefined;
export const cancelRender = (): void => undefined;
export const Easing = {bezier: () => (x: number) => x};
