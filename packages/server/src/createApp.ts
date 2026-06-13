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
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  setupSocketHandlers(io);

  return {
    io,
    httpServer,
    listen(port = 0): Promise<number> {
      return new Promise((resolve) => {
        httpServer.listen(port, () => {
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
