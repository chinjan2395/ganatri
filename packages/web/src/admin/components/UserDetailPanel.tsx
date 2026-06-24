import type { AdminUserStatsView } from '../../protocol';
import type { UserDetail } from '../mockData';

interface UserDetailPanelProps {
  user: UserDetail | AdminUserStatsView;
  loading?: boolean;
  error?: string | null;
  isMock?: boolean;
  onBack: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatPlayTime(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatHumanDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function isUserDetail(user: UserDetail | AdminUserStatsView): user is UserDetail {
  return 'joinedOn' in user;
}

function toDisplayFields(user: UserDetail | AdminUserStatsView) {
  if (isUserDetail(user)) {
    return {
      displayName: user.displayName,
      email: user.email,
      isGuest: user.isGuest,
      isOnline: user.isOnline,
      userId: user.userId,
      joinedOn: user.joinedOn,
      lastActive: user.lastActive,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      winRate: user.winRate,
      avgFinish: user.avgFinish,
      totalCuts: user.totalCuts,
      totalCaptures: user.totalCaptures,
      timesSafe: user.timesSafe,
      totalPlayTimeMs: user.totalPlayTimeMs,
      longestWinStreak: user.longestWinStreak,
      avatarUrl: null as string | null,
      initials: user.initials,
    };
  }

  return {
    displayName: user.displayName,
    email: user.email,
    isGuest: user.isGuest,
    isOnline: false,
    userId: user.userId,
    joinedOn: '—',
    lastActive: formatHumanDate(user.updatedAt),
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    winRate: user.winRate,
    avgFinish: user.gamesPlayed > 0
      ? (user.gamesWon * 1 + user.gamesLost * 2.5 + user.gamesAbandoned * 3.5) / user.gamesPlayed
      : 0,
    totalCuts: user.cutsGiven + user.cutsReceived,
    totalCaptures: user.totalCaptures,
    timesSafe: user.timesSafe,
    totalPlayTimeMs: user.totalPlayTimeMs,
    longestWinStreak: user.longestWinStreak,
    avatarUrl: user.avatarUrl,
    initials: getInitials(user.displayName),
  };
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard unavailable — ignore
  }
}

const STAT_ICONS: Record<string, string> = {
  games: '🎮',
  wins: '🏆',
  rate: '📊',
  finish: '🎯',
  cuts: '✂️',
  captures: '🃏',
  safe: '🛡️',
  time: '⏱️',
  streak: '🔥',
};

const ADMIN_ACTIONS = [
  { id: 'history', label: 'View History', desc: 'Game history & stats', icon: '📜', danger: false },
  { id: 'matches', label: 'View Matches', desc: 'Detailed match list', icon: '📋', danger: false },
  { id: 'reset', label: 'Reset Stats', desc: 'Clear user statistics', icon: '🔄', danger: false },
  { id: 'suspend', label: 'Suspend User', desc: 'Restrict user access', icon: '🚫', danger: true },
  { id: 'delete', label: 'Delete User', desc: 'Permanently delete', icon: '🗑️', danger: true },
  { id: 'export', label: 'Export User Data', desc: 'Export user data', icon: '📤', danger: false },
] as const;

export function UserDetailPanel({ user, loading, error, onBack }: UserDetailPanelProps) {
  const fields = toDisplayFields(user);

  return (
    <aside className="admin-user-detail">
      <button type="button" className="admin-user-detail__back" onClick={onBack}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Users
      </button>

      {loading && <p className="admin-user-detail__loading">Loading user stats…</p>}
      {error && <p className="admin-user-detail__error">{error}</p>}

      <div className="admin-user-detail__identity">
        {fields.avatarUrl ? (
          <img
            className="admin-user-detail__avatar-img"
            src={fields.avatarUrl}
            alt={fields.displayName}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="admin-user-detail__avatar">{fields.initials}</div>
        )}
        <div className="admin-user-detail__identity-text">
          <div className="admin-user-detail__name-row">
            <h3 className="admin-user-detail__name">{fields.displayName}</h3>
            <span className={`admin-users__type-tag${fields.isGuest ? ' admin-users__type-tag--guest' : ''}`}>
              {fields.isGuest ? 'Guest User' : 'Registered User'}
            </span>
          </div>
          <span className={`admin-user-detail__status${fields.isOnline ? ' admin-user-detail__status--on' : ''}`}>
            <span className="admin-status-pill__dot" />
            {fields.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <dl className="admin-user-detail__meta">
        <div className="admin-user-detail__meta-row">
          <dt>User ID</dt>
          <dd>
            <code>{fields.userId}</code>
            <button type="button" className="admin-user-detail__copy" onClick={() => copyText(fields.userId)} aria-label="Copy user ID">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </dd>
        </div>
        <div className="admin-user-detail__meta-row">
          <dt>Email</dt>
          <dd>
            {fields.email ?? '—'}
            {fields.email && (
              <button type="button" className="admin-user-detail__copy" onClick={() => copyText(fields.email!)} aria-label="Copy email">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            )}
          </dd>
        </div>
        <div className="admin-user-detail__meta-row">
          <dt>Joined On</dt>
          <dd>{fields.joinedOn}</dd>
        </div>
        <div className="admin-user-detail__meta-row">
          <dt>Last Active</dt>
          <dd>{fields.lastActive}</dd>
        </div>
      </dl>

      <section className="admin-user-detail__section">
        <h4 className="admin-user-detail__section-title">Player Statistics</h4>
        <div className="admin-user-detail__stats">
          <div className="admin-user-detail__stat">
            <span className="admin-user-detail__stat-icon">{STAT_ICONS.games}</span>
            <span className="admin-user-detail__stat-value">{fields.gamesPlayed}</span>
            <span className="admin-user-detail__stat-label">Games Played</span>
          </div>
          <div className="admin-user-detail__stat">
            <span className="admin-user-detail__stat-icon">{STAT_ICONS.wins}</span>
            <span className="admin-user-detail__stat-value">{fields.gamesWon}</span>
            <span className="admin-user-detail__stat-label">Games Won</span>
          </div>
          <div className="admin-user-detail__stat">
            <span className="admin-user-detail__stat-icon">{STAT_ICONS.rate}</span>
            <span className="admin-user-detail__stat-value">{(fields.winRate * 100).toFixed(1)}%</span>
            <span className="admin-user-detail__stat-label">Win Rate</span>
          </div>
          <div className="admin-user-detail__stat">
            <span className="admin-user-detail__stat-icon">{STAT_ICONS.finish}</span>
            <span className="admin-user-detail__stat-value">{fields.avgFinish.toFixed(1)}</span>
            <span className="admin-user-detail__stat-label">Avg Finish</span>
          </div>
          <div className="admin-user-detail__stat">
            <span className="admin-user-detail__stat-icon">{STAT_ICONS.cuts}</span>
            <span className="admin-user-detail__stat-value">{fields.totalCuts}</span>
            <span className="admin-user-detail__stat-label">Total Cuts</span>
          </div>
          <div className="admin-user-detail__stat">
            <span className="admin-user-detail__stat-icon">{STAT_ICONS.captures}</span>
            <span className="admin-user-detail__stat-value">{fields.totalCaptures}</span>
            <span className="admin-user-detail__stat-label">Total Captures</span>
          </div>
          <div className="admin-user-detail__stat">
            <span className="admin-user-detail__stat-icon">{STAT_ICONS.safe}</span>
            <span className="admin-user-detail__stat-value">{fields.timesSafe}</span>
            <span className="admin-user-detail__stat-label">Safe Counts</span>
          </div>
          <div className="admin-user-detail__stat">
            <span className="admin-user-detail__stat-icon">{STAT_ICONS.time}</span>
            <span className="admin-user-detail__stat-value">{formatPlayTime(fields.totalPlayTimeMs)}</span>
            <span className="admin-user-detail__stat-label">Total Play Time</span>
          </div>
          <div className="admin-user-detail__stat admin-user-detail__stat--wide">
            <span className="admin-user-detail__stat-icon">{STAT_ICONS.streak}</span>
            <span className="admin-user-detail__stat-value">{fields.longestWinStreak} Wins</span>
            <span className="admin-user-detail__stat-label">Longest Winning Streak</span>
          </div>
        </div>
      </section>

      <section className="admin-user-detail__section">
        <h4 className="admin-user-detail__section-title">Admin Actions</h4>
        <div className="admin-user-detail__actions">
          {ADMIN_ACTIONS.map(action => (
            <button
              key={action.id}
              type="button"
              className={`admin-user-detail__action${action.danger ? ' admin-user-detail__action--danger' : ''}`}
            >
              <span className="admin-user-detail__action-icon">{action.icon}</span>
              <span className="admin-user-detail__action-text">
                <span className="admin-user-detail__action-label">{action.label}</span>
                <span className="admin-user-detail__action-desc">{action.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
