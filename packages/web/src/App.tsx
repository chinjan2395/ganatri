import { lazy, Suspense } from 'react';
import { useGame } from './state/GameProvider';
import { VoiceChatProvider } from './state/VoiceChatProvider';
import { LobbyScreen } from './screens/LobbyScreen';
import { RoomScreen } from './screens/RoomScreen';
import { GameScreen } from './screens/GameScreen';
import { Toast } from './components/Toast';
import { ConnectionBanner } from './components/ConnectionBanner';
import { InviteToast } from './components/InviteToast';
import { CookieConsent } from './components/CookieConsent';

const AdminScreen = lazy(() => import('./screens/AdminScreen').then(m => ({ default: m.AdminScreen })));
const HistoryScreen = lazy(() => import('./screens/HistoryScreen').then(m => ({ default: m.HistoryScreen })));
const StatsScreen = lazy(() => import('./screens/StatsScreen').then(m => ({ default: m.StatsScreen })));
const LeaderboardScreen = lazy(() => import('./screens/LeaderboardScreen').then(m => ({ default: m.LeaderboardScreen })));
const SessionsScreen = lazy(() => import('./screens/SessionsScreen').then(m => ({ default: m.SessionsScreen })));
const DesignSystemScreen = lazy(() => import('./screens/DesignSystemScreen').then(m => ({ default: m.DesignSystemScreen })));

export function App(): React.ReactNode {
  if (window.location.pathname === '/admin') {
    return (
      <Suspense fallback={<div className="center-screen"><div className="spinner" /></div>}>
        <AdminScreen />
      </Suspense>
    );
  }

  const { session, room, view, error, clearError, screen: navScreen } = useGame();

  if (window.location.pathname === '/design-system') {
    return (
      <VoiceChatProvider>
        <div className="app-shell">
          <ConnectionBanner />
          <Suspense fallback={<div className="center-screen"><div className="spinner" /></div>}>
            <DesignSystemScreen />
          </Suspense>
          <Toast message={error} onDismiss={clearError} />
        </div>
      </VoiceChatProvider>
    );
  }

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
  } else if (navScreen === 'stats') {
    screen = <StatsScreen />;
  } else if (navScreen === 'leaderboard') {
    screen = <LeaderboardScreen />;
  } else if (navScreen === 'sessions') {
    screen = <SessionsScreen />;
  } else if (navScreen === 'history') {
    screen = <HistoryScreen />;
  } else {
    screen = <LobbyScreen />;
  }

  return (
    <VoiceChatProvider>
      <div className="app-shell">
        <ConnectionBanner />
        <Suspense fallback={<div className="center-screen"><div className="spinner" /></div>}>
          {screen}
        </Suspense>
        <Toast message={error} onDismiss={clearError} />
        <InviteToast />
        <CookieConsent />
      </div>
    </VoiceChatProvider>
  );
}
