/**
 * Ganatri server entry point.
 *
 * Creates the HTTP + Socket.io server, wires up handlers, and starts listening.
 * Server factory is in createApp.ts so tests can spin it up on a random port.
 */

import { createApp } from './createApp.js';

const app = createApp();
const port = Number(process.env['PORT'] ?? 4000);

app.listen(port).then((boundPort) => {
  console.log(`Ganatri server listening on 0.0.0.0:${boundPort}`);
});
