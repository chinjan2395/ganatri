/**
 * Ganatri server entry point.
 *
 * Creates the HTTP + Socket.io server, wires up handlers, and starts listening.
 * Server factory is in createApp.ts so tests can spin it up on a random port.
 */

import { runMigrations } from '@ganatri/db';
import { createApp } from './createApp.js';

const port = Number(process.env['PORT'] ?? 4000);

void (async () => {
  if (process.env['DATABASE_URL']) {
    await runMigrations();
  }

  const app = createApp();
  const boundPort = await app.listen(port);
  console.log(`Ganatri server listening on 0.0.0.0:${boundPort}`);
})().catch((err: unknown) => {
  console.error('[server] startup failed:', err);
  process.exit(1);
});
