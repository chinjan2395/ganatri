import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { GameProvider } from './state/GameProvider';
import { App } from './App';
import { bootstrapAuth, captureAuthTokenFromUrl, socket } from './net/socket';
import './styles/theme.css';
import './styles/casino.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');
const mountEl = rootEl;

async function start(): Promise<void> {
  captureAuthTokenFromUrl();
  await bootstrapAuth();
  socket.connect();

  createRoot(mountEl).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <GameProvider>
          <App />
        </GameProvider>
      </MotionConfig>
    </StrictMode>,
  );
}

void start();
