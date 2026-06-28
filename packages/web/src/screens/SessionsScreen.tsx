// SCREEN SHELL: no reusable component definitions here.
// Components → packages/ds | Screens → packages/web/src/screens
import { useEffect, useState } from 'react';
import {
  DsTopNav,
  DsBottomNav,
  DsScreenHeader,
  DsSessionRow,
  DsButton,
  DsSpinner,
  DsEmptyState,
  DsAlert,
  FooterBar,
} from '@ganatri/ds';
import type { DsTopNavItem, DsBottomNavTab } from '@ganatri/ds';
import { useGame } from '../state/GameProvider';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { AuthSessionView } from '../protocol';
import logo from '../assets/ganatri-logo.png';
import './SessionsScreen.css';

type NavScreen = 'main' | 'history' | 'stats' | 'leaderboard' | 'sessions';

function formatDate(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '—';
  return value.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const NAV_ITEMS: DsTopNavItem[] = [
  { id: 'main', label: 'Home', icon: 'home' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'stats', label: 'Stats', icon: 'stats' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
  { id: 'sessions', label: 'Sessions', icon: 'settings' },
];

const BOTTOM_TABS: DsBottomNavTab[] = [
  { id: 'home', label: 'HOME', icon: 'home' },
  { id: 'history', label: 'HISTORY', icon: 'history' },
  { id: 'stats', label: 'STATS', icon: 'stats' },
  { id: 'leaderboard', label: 'BOARD', icon: 'leaderboard' },
  { id: 'profile', label: 'PROFILE', icon: 'profile' },
];

export function SessionsScreen(): React.ReactNode {
  const {
    account,
    getAuthSessions,
    logout,
    revokeAuthSession,
    revokeOtherAuthSessions,
    setScreen,
  } = useGame();
  const isDesktop = useIsDesktop();
  const [sessions, setSessions] = useState<AuthSessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      const ack = await getAuthSessions();
      if (cancelled) return;
      setLoading(false);
      if (ack.ok) {
        setSessions(ack.sessions);
      } else if (ack.error === 'NOT_LOGGED_IN') {
        setScreen('main');
      } else {
        setError('Unable to load active sessions right now.');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getAuthSessions, setScreen]);

  async function refreshSessions(): Promise<void> {
    const ack = await getAuthSessions();
    if (ack.ok) {
      setSessions(ack.sessions);
      setError(null);
    } else if (ack.error === 'NOT_LOGGED_IN') {
      setScreen('main');
    } else {
      setError('Unable to refresh sessions.');
    }
  }

  async function handleRevoke(sessionId: string): Promise<void> {
    setBusySessionId(sessionId);
    setError(null);
    const ack = await revokeAuthSession(sessionId);
    setBusySessionId(null);
    if (ack.ok) {
      if (!ack.revokedCurrent) await refreshSessions();
      return;
    }
    setError(ack.error === 'NOT_FOUND' ? 'That session is no longer active.' : 'Unable to revoke session.');
  }

  async function handleRevokeOthers(): Promise<void> {
    setBulkBusy(true);
    setError(null);
    const ack = await revokeOtherAuthSessions();
    setBulkBusy(false);
    if (ack.ok) {
      await refreshSessions();
      return;
    }
    setError('Unable to revoke other sessions.');
  }

  function handleNavigate(id: string): void {
    setScreen(id as NavScreen);
  }

  function handleBottomNav(tab: string): void {
    if (tab === 'home' || tab === 'profile') setScreen('main');
    else setScreen(tab as NavScreen);
  }

  const displayName = account?.displayName ?? 'User';
  const avatarUrl = account?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  const currentSession = sessions.find((session) => session.current) ?? null;
  const otherSessions = sessions.filter((session) => !session.current);

  return (
    <div className="sess">
      {!isDesktop && (
        <DsScreenHeader
          title="SESSIONS"
          onBack={() => setScreen('main')}
          backLabel="Back to home"
        />
      )}

      {isDesktop && (
        <DsTopNav
          logo={<img src={logo} alt="Ganatri" style={{ width: 'min(140px, 28vw)', height: 'auto' }} />}
          items={NAV_ITEMS}
          activeId="sessions"
          onNavigate={handleNavigate}
          avatarUrl={avatarUrl}
          avatarInitial={initial}
          avatarLabel={`Profile: ${displayName}`}
          onAvatarClick={() => setScreen('main')}
        />
      )}

      <main className="sess__main">
        <section className="sess__hero">
          <span className="sess__eyebrow">Account Security</span>
          <h2 className="sess__headline">Manage signed-in devices</h2>
          <p className="sess__summary">
            Review where your account is active and remove any device you do not recognize.
          </p>
          {account?.displayName && <p className="sess__account">Signed in as {account.displayName}</p>}
        </section>

        <section className="sess__panel">
          <div className="sess__panel-header">
            <div>
              <h3 className="sess__panel-title">Active Sessions</h3>
              <p className="sess__panel-copy">Sessions expire automatically after 30 days of inactivity.</p>
            </div>
            <DsButton
              tone="secondary"
              label="Log out other devices"
              disabled={bulkBusy || otherSessions.length === 0}
              onClick={() => void handleRevokeOthers()}
            />
          </div>

          {loading && <div className="sess__center"><DsSpinner /></div>}

          {!loading && error && (
            <DsAlert tone="danger" title="Error" description={error} />
          )}

          {!loading && !error && currentSession && (
            <div className="sess__section">
              <h4 className="sess__section-title">This device</h4>
              <DsSessionRow
                sessionId={currentSession.id}
                userAgent={currentSession.userAgent}
                current={currentSession.current}
                createdAt={formatDate(currentSession.createdAt)}
                lastSeenAt={formatDate(currentSession.lastSeenAt)}
                expiresAt={formatDate(currentSession.expiresAt)}
                busy={false}
                onRevoke={() => undefined}
                onLogoutCurrent={logout}
              />
            </div>
          )}

          {!loading && !error && (
            <div className="sess__section">
              <h4 className="sess__section-title">Other devices</h4>
              {otherSessions.length === 0 ? (
                <DsEmptyState message="No other active devices." />
              ) : (
                <div className="sess__list">
                  {otherSessions.map((session) => (
                    <DsSessionRow
                      key={session.id}
                      sessionId={session.id}
                      userAgent={session.userAgent}
                      current={session.current}
                      createdAt={formatDate(session.createdAt)}
                      lastSeenAt={formatDate(session.lastSeenAt)}
                      expiresAt={formatDate(session.expiresAt)}
                      busy={busySessionId === session.id}
                      onRevoke={(id) => void handleRevoke(id)}
                      onLogoutCurrent={logout}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <DsBottomNav tabs={BOTTOM_TABS} activeId="profile" onTab={handleBottomNav} />

      {isDesktop && <FooterBar />}
    </div>
  );
}
