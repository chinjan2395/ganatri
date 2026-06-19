import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    sequence: {
      // Each test builds a fresh PGlite instance; keep them serial.
      concurrent: false,
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@ganatri/engine': new URL('../engine/src/index.ts', import.meta.url).pathname,
    },
  },
});
