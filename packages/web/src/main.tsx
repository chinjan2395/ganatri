import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { GameProvider } from './state/GameProvider';
import { App } from './App';
import { setToken, socket } from './net/socket';
import './styles/theme.css';
import './styles/casino.css';

// Extract auth_token from URL after OAuth callback.
// The socket auto-connects at module load with the old token, so we must
// disconnect and reconnect with the new auth token.
const params = new URLSearchParams(window.location.search);
const authToken = params.get('auth_token');
if (authToken) {
  setToken(authToken);
  window.history.replaceState(null, '', window.location.pathname);
  socket.disconnect().connect();
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <GameProvider>
        <App />
      </GameProvider>
    </MotionConfig>
  </StrictMode>,
);
