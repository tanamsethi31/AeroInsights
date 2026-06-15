import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    exclude: ['**/node_modules/**', '**/out/**'],
  },
  resolve: {
    alias: {
      // Pure-logic tests import from 'remotion'; alias to a Node-safe mock.
      remotion: new URL('./src/test/remotion.mock.ts', import.meta.url).pathname,
    },
  },
});
