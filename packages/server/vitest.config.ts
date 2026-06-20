import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    // Run tests sequentially since each test spins up a server.
    sequence: {
      concurrent: false,
    },
    testTimeout: 30_000,
    hookTimeout: 10_000,
    // Use the vite transform pipeline (handles TS + ESM interop natively).
    pool: 'forks',
    // Set ADMIN_EMAILS so config._adminEmails is populated when tests run.
    // This is the test admin email used by admin.test.ts.
    env: {
      ADMIN_EMAILS: 'admin@test.com',
    },
  },
  resolve: {
    // Mirror the tsconfig paths so vitest resolves @ganatri/engine to source.
    alias: {
      '@ganatri/engine': new URL('../engine/src/index.ts', import.meta.url).pathname,
      '@ganatri/db': new URL('../db/src/index.ts', import.meta.url).pathname,
    },
  },
});
