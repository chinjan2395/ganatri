import { useGame } from './state/GameProvider';
import { VoiceChatProvider } from './state/VoiceChatProvider';
import { LobbyScreen } from './screens/LobbyScreen';
import { RoomScreen } from './screens/RoomScreen';
import { GameScreen } from './screens/GameScreen';
import { AdminScreen } from './screens/AdminScreen';
import { Toast } from './components/Toast';
import { ConnectionBanner } from './components/ConnectionBanner';

export function App(): React.ReactNode {
  if (window.location.pathname === '/admin') {
    return <AdminScreen />;
  }

  const { session, room, view, error, clearError, toastMessage, clearToast } = useGame();

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
    <VoiceChatProvider>
      <div className="app-shell">
        <ConnectionBanner />
        {screen}
        <Toast message={error} onDismiss={clearError} />
        <Toast message={toastMessage} onDismiss={clearToast} />
      </div>
    </VoiceChatProvider>
  );
}
