import { useEffect, useState } from 'react';
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

interface SessionsHeaderProps {
  onNavigate: (screen: NavScreen) => void;
}

function SessionsHeader({ onNavigate }: SessionsHeaderProps): React.ReactNode {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return (
      <header className="sess__header sess__header--mobile">
        <button type="button" className="sess__back-btn" onClick={() => onNavigate('main')} aria-label="Back to home">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
          </svg>
        </button>
        <div className="sess__title-wrap">
          <span className="sess__eyebrow">Security</span>
          <h1 className="sess__title">Sessions</h1>
        </div>
      </header>
    );
  }

  return (
    <header className="sess__header">
      <div className="sess__brand">
        <img src={logo} alt="Ganatri" className="sess__logo" />
      </div>
      <nav className="sess__nav" aria-label="Main navigation">
        <button type="button" className="sess__nav-btn" onClick={() => onNavigate('main')}>Home</button>
        <button type="button" className="sess__nav-btn" onClick={() => onNavigate('history')}>History</button>
        <button type="button" className="sess__nav-btn" onClick={() => onNavigate('stats')}>Stats</button>
        <button type="button" className="sess__nav-btn" onClick={() => onNavigate('leaderboard')}>Leaderboard</button>
        <button type="button" className="sess__nav-btn sess__nav-btn--active" disabled>Sessions</button>
      </nav>
    </header>
  );
}

interface SessionRowProps {
  session: AuthSessionView;
  busy: boolean;
  onRevoke: (sessionId: string) => void;
  onLogoutCurrent: () => void;
}

function SessionRow({ session, busy, onRevoke, onLogoutCurrent }: SessionRowProps): React.ReactNode {
  return (
    <article className={`sess__card${session.current ? ' sess__card--current' : ''}`}>
      <div className="sess__card-main">
        <div className="sess__card-topline">
          <span className="sess__device">{session.userAgent}</span>
          <span className={`sess__badge${session.current ? ' sess__badge--current' : ''}`}>
            {session.current ? 'Current device' : 'Active'}
          </span>
        </div>
        <div className="sess__meta">
          <span>Created {formatDate(session.createdAt)}</span>
          <span>Last seen {formatDate(session.lastSeenAt)}</span>
          <span>Expires {formatDate(session.expiresAt)}</span>
        </div>
      </div>
      <div className="sess__card-actions">
        {session.current ? (
          <button type="button" className="secondary" onClick={onLogoutCurrent}>
            Log out
          </button>
        ) : (
          <button type="button" className="secondary" onClick={() => onRevoke(session.id)} disabled={busy}>
            Revoke
          </button>
        )}
      </div>
    </article>
  );
}

export function SessionsScreen(): React.ReactNode {
  const {
    account,
    getAuthSessions,
    logout,
    revokeAuthSession,
    revokeOtherAuthSessions,
    setScreen,
  } = useGame();
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

  const currentSession = sessions.find((session) => session.current) ?? null;
  const otherSessions = sessions.filter((session) => !session.current);

  return (
    <div className="sess">
      <SessionsHeader onNavigate={setScreen} />
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
            <button
              type="button"
              className="secondary"
              onClick={() => void handleRevokeOthers()}
              disabled={bulkBusy || otherSessions.length === 0}
            >
              Log out other devices
            </button>
          </div>

          {loading && <div className="sess__empty">Loading sessions…</div>}
          {!loading && error && <div className="sess__error">{error}</div>}
          {!loading && !error && currentSession && (
            <div className="sess__section">
              <h4 className="sess__section-title">This device</h4>
              <SessionRow
                session={currentSession}
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
                <div className="sess__empty">No other active devices.</div>
              ) : (
                <div className="sess__list">
                  {otherSessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      busy={busySessionId === session.id}
                      onRevoke={(sessionId) => void handleRevoke(sessionId)}
                      onLogoutCurrent={logout}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
