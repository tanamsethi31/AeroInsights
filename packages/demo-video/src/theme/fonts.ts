import '@fontsource-variable/geist';
import {cancelRender, continueRender, delayRender} from 'remotion';

export const FONT_FAMILY = "'Geist Variable', system-ui, -apple-system, sans-serif";

const handle = delayRender('Loading Geist');
// In the browser bundle, wait for the webfont to be ready; in non-DOM
// contexts resolve immediately.
if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
  (document as any).fonts.ready.then(() => continueRender(handle)).catch((e: unknown) => cancelRender(e));
} else {
  continueRender(handle);
}
