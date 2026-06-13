/**
 * createApp.ts — factory for the HTTP + Socket.io server.
 *
 * Separated from index.ts so tests can create the server without
 * immediately calling listen().
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './handlers.js';

export interface AppInstance {
  io: Server;
  httpServer: ReturnType<typeof createServer>;
  /** Start listening. Returns the bound port. */
  listen(port?: number): Promise<number>;
  /** Gracefully close all connections. */
  close(): Promise<void>;
}

export function createApp(): AppInstance {
  const httpServer = createServer((req, res) => {
    // Render (and other PaaS) probe HTTP on 0.0.0.0:PORT during deploy.
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  const io = new Server(httpServer, {
    cors: { origin: process.env['CORS_ORIGIN'] ?? '*', methods: ['GET', 'POST'] },
    pingInterval: 10_000,
    pingTimeout: 5_000,
  });

  setupSocketHandlers(io);

  const host = process.env['HOST'] ?? '0.0.0.0';

  return {
    io,
    httpServer,
    listen(port = 0): Promise<number> {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => {
          const addr = httpServer.address();
          const boundPort = typeof addr === 'object' && addr !== null ? addr.port : port;
          resolve(boundPort);
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        io.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
