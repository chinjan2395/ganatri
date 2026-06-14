import { useState } from 'react';
import { useGame } from './state/GameProvider';
import { IntroScreen } from './screens/IntroScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { RoomScreen } from './screens/RoomScreen';
import { GameScreen } from './screens/GameScreen';
import { AdminScreen } from './screens/AdminScreen';
import { Toast } from './components/Toast';
import { ConnectionBanner } from './components/ConnectionBanner';

export function App(): React.ReactNode {
  const introDone = sessionStorage.getItem('intro_done') === '1';
  const [showIntro, setShowIntro] = useState(!introDone);

  if (window.location.pathname === '/admin') {
    return <AdminScreen />;
  }

  function handleIntroDone() {
    sessionStorage.setItem('intro_done', '1');
    setShowIntro(false);
  }

  const { session, room, view, error, clearError } = useGame();

  let screen: React.ReactNode;
  if (!session) {
    // Initial connect — no session yet. A mid-session drop keeps the current
    // screen and surfaces ConnectionBanner instead of blanking the UI.
    screen = (
      <div className="center-screen">
        <div className="spinner" />
        <p className="muted">Connecting…</p>
      </div>
    );
  } else if (room && room.phase !== 'LOBBY' && view) {
    // Active or finished game.
    screen = <GameScreen />;
  } else if (room && room.phase !== 'LOBBY' && !view) {
    // Game in progress but view not yet restored (reconnect).
    screen = (
      <div className="center-screen">
        <div className="spinner" />
        <p className="muted">Rejoining game…</p>
      </div>
    );
  } else if (room) {
    screen = <RoomScreen />;
  } else {
    screen = <LobbyScreen />;
  }

  return (
    <>
      {showIntro && <IntroScreen onDone={handleIntroDone} />}
      <div className="app-shell">
        <ConnectionBanner />
        {screen}
        <Toast message={error} onDismiss={clearError} />
      </div>
    </>
  );
}
