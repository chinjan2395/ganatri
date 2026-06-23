import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ADMIN_EVENTS,
  AdminExportDataAck,
  AdminGetKpiStatsAck,
  AdminGetStatsAck,
  AdminGetUserStatsAck,
  AdminKpiStats,
  AdminSearchUsersAck,
  AdminServerStats,
  AdminUserStatsView,
  AdminUserView,
  GameConfig,
} from '../protocol';
import './AdminScreen.css';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:4000';

const LABELS: Record<keyof GameConfig, string> = {
  turnTimeoutMs: 'Turn timeout (ms)',
  maxPlayers:    'Max players per room',
  gracePeriodMs: 'Disconnect grace period (ms)',
  roomExpiryMs:  'Completed room expiry (ms)',
};

const LIMITS: Record<keyof GameConfig, { min: number; max: number; step: number }> = {
  turnTimeoutMs: { min: 3000,  max: 60000,    step: 1000  },
  maxPlayers:    { min: 2,     max: 8,         step: 1     },
  gracePeriodMs: { min: 5000,  max: 300000,    step: 5000  },
  roomExpiryMs:  { min: 60000, max: 86400000,  step: 60000 },
};

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatDate(dateStr: string): string {
  // "YYYY-MM-DD" → abbreviated e.g. "Jun 20"
  const parts = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthIndex = parseInt(parts[1] ?? '1', 10) - 1;
  const dayNum = parseInt(parts[2] ?? '1', 10);
  return `${months[monthIndex]} ${dayNum}`;
}

interface KpiSectionProps {
  loading: boolean;
  stats: AdminKpiStats | null;
  error: string | null;
}

function KpiSection({ loading, stats, error }: KpiSectionProps) {
  const maxTotal = stats
    ? Math.max(...stats.dailyBreakdown.map(d => d.total), 1)
    : 1;
  const allZero = stats ? stats.dailyBreakdown.every(d => d.total === 0) : true;

  return (
    <div className="admin__section admin__kpi-section">
      <h2 className="admin__section-title">KPI — Last 7 Days</h2>

      {loading && <p className="admin__hint">Loading KPI…</p>}
      {!loading && error && <p className="admin__hint">Unavailable</p>}
      {!loading && !error && stats && (
        <>
          <div className="admin__stats-grid admin__kpi-tiles">
            <div className="admin__stat">
              <span className="admin__stat-value">{stats.totalGames}</span>
              <span className="admin__stat-label">Total Games</span>
            </div>
            <div className="admin__stat">
              <span className="admin__stat-value">
                {(stats.abandonmentRate * 100).toFixed(1)}%
              </span>
              <span className="admin__stat-label">Abandonment Rate</span>
            </div>
            <div className="admin__stat">
              <span className="admin__stat-value">
                {stats.avgDurationMs !== null ? formatDuration(stats.avgDurationMs) : '—'}
              </span>
              <span className="admin__stat-label">Avg Duration</span>
            </div>
          </div>

          <div className="admin__kpi-chart">
            <p className="admin__kpi-chart-title">Games per Day</p>
            {allZero ? (
              <p className="admin__kpi-empty">No games in this window</p>
            ) : (
              <div className="admin__kpi-bar-row">
                {stats.dailyBreakdown.map(day => {
                  const completedH = Math.round((day.completed / maxTotal) * 120);
                  const abandonedH = Math.round((day.abandoned / maxTotal) * 120);
                  return (
                    <div className="admin__kpi-bar-group" key={day.date}>
                      {day.total > 0 && (
                        <span className="admin__kpi-bar-count">{day.total}</span>
                      )}
                      <div className="admin__kpi-bar">
                        <div
                          className="admin__kpi-bar-abandoned"
                          style={{ height: `${abandonedH}px` }}
                        />
                        <div
                          className="admin__kpi-bar-completed"
                          style={{ height: `${completedH}px` }}
                        />
                      </div>
                      <span className="admin__kpi-bar-label">{formatDate(day.date)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- helpers ----

function formatAvgDuration(totalMs: number, gamesPlayed: number): string {
  if (gamesPlayed === 0) return '—';
  return formatDuration(totalMs / gamesPlayed);
}

function formatHumanDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ---- UserManagementSection ----

interface UserManagementSectionProps {
  socket: Socket | null;
}

function UserManagementSection({ socket }: UserManagementSectionProps) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AdminUserView[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserStatsView | null>(null);
  const [userStatsLoading, setUserStatsLoading] = useState(false);
  const [userStatsError, setUserStatsError] = useState<string | null>(null);

  const handleSearch = () => {
    if (!socket || query.trim() === '') return;
    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    setSelectedUser(null);
    socket.emit(ADMIN_EVENTS.SEARCH_USERS, { query: query.trim() }, (ack: AdminSearchUsersAck) => {
      setSearching(false);
      if (ack.ok) {
        setSearchResults(ack.users);
      } else {
        setSearchError(ack.error === 'NOT_AUTHORIZED' ? 'Not authorized.' : 'Unavailable, try again.');
      }
    });
  };

  const handleViewStats = (userId: string) => {
    if (!socket) return;
    setUserStatsLoading(true);
    setUserStatsError(null);
    socket.emit(ADMIN_EVENTS.GET_USER_STATS, { userId }, (ack: AdminGetUserStatsAck) => {
      setUserStatsLoading(false);
      if (ack.ok) {
        setSelectedUser(ack.stats);
      } else {
        const msg =
          ack.error === 'NOT_FOUND' ? 'User not found.' :
          ack.error === 'NOT_AUTHORIZED' ? 'Not authorized.' :
          'Unavailable, try again.';
        setUserStatsError(msg);
      }
    });
  };

  return (
    <div className="admin__section admin__user-search">
      <h2 className="admin__section-title">User Management</h2>

      {selectedUser ? (
        <div className="admin__user-detail">
          <div className="admin__user-detail-header">
            {selectedUser.avatarUrl ? (
              <img
                className="admin__user-avatar"
                src={selectedUser.avatarUrl}
                alt={selectedUser.displayName}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="admin__user-avatar-initials">
                {getInitials(selectedUser.displayName)}
              </div>
            )}
            <div className="admin__user-info">
              <span className="admin__user-name">{selectedUser.displayName}</span>
              <span className="admin__user-meta">
                {selectedUser.isGuest ? (
                  <span className="admin__user-guest-badge">Guest</span>
                ) : (
                  selectedUser.email ?? 'No email'
                )}
              </span>
            </div>
            <button
              className="admin__user-detail-back"
              onClick={() => setSelectedUser(null)}
            >
              &larr; Back
            </button>
          </div>

          {userStatsError && <p className="admin__error">{userStatsError}</p>}

          <div className="admin__user-stats-grid">
            <div className="admin__user-stat">
              <span className="admin__stat-value">{selectedUser.gamesPlayed}</span>
              <span className="admin__stat-label">Games Played</span>
            </div>
            <div className="admin__user-stat">
              <span className="admin__stat-value">{selectedUser.gamesWon}</span>
              <span className="admin__stat-label">Wins</span>
            </div>
            <div className="admin__user-stat">
              <span className="admin__stat-value">{selectedUser.gamesLost}</span>
              <span className="admin__stat-label">Losses</span>
            </div>
            <div className="admin__user-stat">
              <span className="admin__stat-value">{selectedUser.gamesAbandoned}</span>
              <span className="admin__stat-label">Abandoned</span>
            </div>
            <div className="admin__user-stat">
              <span className="admin__stat-value">{(selectedUser.winRate * 100).toFixed(1)}%</span>
              <span className="admin__stat-label">Win Rate</span>
            </div>
            <div className="admin__user-stat">
              <span className="admin__stat-value">
                {formatAvgDuration(selectedUser.totalPlayTimeMs, selectedUser.gamesPlayed)}
              </span>
              <span className="admin__stat-label">Avg Game Duration</span>
            </div>
            <div className="admin__user-stat">
              <span className="admin__stat-value">{selectedUser.totalCaptures}</span>
              <span className="admin__stat-label">Captures</span>
            </div>
            <div className="admin__user-stat">
              <span className="admin__stat-value">{selectedUser.cutsGiven}</span>
              <span className="admin__stat-label">Cuts Given</span>
            </div>
            <div className="admin__user-stat">
              <span className="admin__stat-value">{selectedUser.cutsReceived}</span>
              <span className="admin__stat-label">Cuts Received</span>
            </div>
            <div className="admin__user-stat">
              <span className="admin__stat-value">{selectedUser.timesSafe}</span>
              <span className="admin__stat-label">Times Safe</span>
            </div>
            <div className="admin__user-stat">
              <span className="admin__stat-value">{selectedUser.longestWinStreak}</span>
              <span className="admin__stat-label">Longest Streak</span>
            </div>
            <div className="admin__user-stat">
              <span className="admin__stat-value">{selectedUser.currentWinStreak}</span>
              <span className="admin__stat-label">Current Streak</span>
            </div>
          </div>

          <p className="admin__hint">
            Stats last updated:{' '}
            {selectedUser.updatedAt ? formatHumanDate(selectedUser.updatedAt) : 'Never'}
          </p>
        </div>
      ) : (
        <>
          <div className="admin__user-search-bar">
            <input
              className="admin__user-search-input admin__input"
              type="text"
              placeholder="Search by name or email…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !searching && query.trim() !== '' && handleSearch()}
            />
            <button
              className="admin__btn"
              onClick={handleSearch}
              disabled={searching || query.trim() === ''}
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {searchError && <p className="admin__error">{searchError}</p>}
          {userStatsError && <p className="admin__error">{userStatsError}</p>}
          {userStatsLoading && <p className="admin__hint">Loading user stats…</p>}

          {searchResults !== null && (
            <div className="admin__user-list">
              {searchResults.length === 0 ? (
                <p className="admin__hint">No users found.</p>
              ) : (
                searchResults.map(user => (
                  <div className="admin__user-row" key={user.userId}>
                    {user.avatarUrl ? (
                      <img
                        className="admin__user-avatar"
                        src={user.avatarUrl}
                        alt={user.displayName}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="admin__user-avatar-initials">
                        {getInitials(user.displayName)}
                      </div>
                    )}
                    <div className="admin__user-info">
                      <span className="admin__user-name">{user.displayName}</span>
                      <span className="admin__user-meta">
                        {user.isGuest ? (
                          <span className="admin__user-guest-badge">Guest</span>
                        ) : (
                          <span className="admin__user-email">{user.email ?? 'No email'}</span>
                        )}
                        {' '}&middot;{' '}
                        {user.gamesPlayed} played / {user.gamesWon} won
                      </span>
                    </div>
                    <div className="admin__user-actions">
                      <button
                        className="admin__btn"
                        onClick={() => handleViewStats(user.userId)}
                      >
                        View Stats
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type Screen = 'idle' | 'loading' | 'authed';

export function AdminScreen() {
  const [screen, setScreen] = useState<Screen>('idle');
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [draft, setDraft] = useState<GameConfig | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [stats, setStats] = useState<AdminServerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [kpiStats, setKpiStats] = useState<AdminKpiStats | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = io(SERVER_URL, { autoConnect: false });
    socketRef.current = s;
    s.connect();
    return () => { s.disconnect(); };
  }, []);

  const fetchStats = () => {
    const s = socketRef.current;
    if (!s) return;
    setStatsLoading(true);
    s.emit(ADMIN_EVENTS.GET_STATS, {}, (ack: AdminGetStatsAck) => {
      setStatsLoading(false);
      if (ack.ok) setStats(ack.stats);
    });
  };

  const fetchKpi = () => {
    const s = socketRef.current;
    if (!s) return;
    setKpiLoading(true);
    setKpiError(null);
    s.emit(ADMIN_EVENTS.GET_KPI_STATS, {}, (ack: AdminGetKpiStatsAck) => {
      setKpiLoading(false);
      if (ack.ok) {
        setKpiStats(ack.stats);
      } else {
        setKpiError('Unavailable');
      }
    });
  };

  useEffect(() => {
    if (screen !== 'authed') return;
    const id = setInterval(fetchStats, 15000);
    return () => { clearInterval(id); };
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAuth = () => {
    const s = socketRef.current;
    if (!s || !email.trim()) return;
    setScreen('loading');
    setError(null);
    s.emit(ADMIN_EVENTS.AUTH, { email, secret }, (ack: { ok: boolean; reason?: string }) => {
      if (!ack.ok) {
        setError(ack.reason === 'not_authorized' ? 'Email or secret is incorrect.' : 'Auth failed.');
        setScreen('idle');
        return;
      }
      s.emit(ADMIN_EVENTS.GET_CONFIG, {}, (res: { config: GameConfig }) => {
        setConfig(res.config);
        setDraft({ ...res.config });
        setScreen('authed');
        fetchStats();
        fetchKpi();
      });
    });
  };

  const handleSave = () => {
    const s = socketRef.current;
    if (!s || !draft) return;
    setSaveStatus('saving');
    s.emit(ADMIN_EVENTS.UPDATE_CONFIG, { config: draft }, (ack: { ok: boolean; reason?: string }) => {
      if (ack.ok) {
        setConfig({ ...draft });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    });
  };

  const handleExport = () => {
    const s = socketRef.current;
    if (!s) return;
    setExportLoading(true);
    setExportError(null);
    s.emit(ADMIN_EVENTS.EXPORT_DATA, {}, (ack: AdminExportDataAck) => {
      setExportLoading(false);
      if (ack.ok) {
        const json = JSON.stringify({ exportedAt: new Date().toISOString(), games: ack.games }, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ganatri-export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setExportError('Export failed: ' + ack.error);
      }
    });
  };

  if (screen === 'idle' || screen === 'loading') {
    return (
      <div className="admin">
        <div className="admin__card">
          <h1 className="admin__title">Admin</h1>
          <p className="admin__subtitle">Enter your admin email and secret to access game configuration.</p>
          <input
            className="admin__input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            disabled={screen === 'loading'}
            autoFocus
          />
          <input
            className="admin__input"
            type="password"
            placeholder="Admin secret (leave blank if not configured)"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            disabled={screen === 'loading'}
          />
          {error && <p className="admin__error">{error}</p>}
          <button
            className="admin__btn"
            onClick={handleAuth}
            disabled={screen === 'loading' || !email.trim()}
          >
            {screen === 'loading' ? 'Verifying…' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="admin__card admin__card--wide">
        <h1 className="admin__title">Game Configuration</h1>
        <p className="admin__subtitle">
          Changes apply to new timers and actions immediately — no restart needed.
        </p>

        <div className="admin__section">
          <h2 className="admin__section-title">
            Live Ops
            <button
              className="admin__refresh-btn"
              onClick={() => { fetchStats(); fetchKpi(); }}
              disabled={statsLoading || kpiLoading}
            >
              {statsLoading || kpiLoading ? '…' : 'Refresh'}
            </button>
          </h2>
          {stats ? (
            <div className="admin__stats-grid">
              <div className="admin__stat">
                <span className="admin__stat-value">{stats.connectedPlayers}</span>
                <span className="admin__stat-label">Connected</span>
              </div>
              <div className="admin__stat">
                <span className="admin__stat-value">{stats.activeGames}</span>
                <span className="admin__stat-label">Active games</span>
              </div>
              <div className="admin__stat">
                <span className="admin__stat-value">{stats.lobbyRooms}</span>
                <span className="admin__stat-label">In lobby</span>
              </div>
              <div className="admin__stat">
                <span className="admin__stat-value">{stats.totalRooms}</span>
                <span className="admin__stat-label">Total rooms</span>
              </div>
            </div>
          ) : (
            <p className="admin__hint">Loading stats…</p>
          )}
        </div>

        <KpiSection loading={kpiLoading} stats={kpiStats} error={kpiError} />

        <UserManagementSection socket={socketRef.current} />

        <div className="admin__section admin__export-section">
          <h2 className="admin__section-title">Data Export</h2>
          <p className="admin__subtitle">Download all games data as JSON for offline analysis.</p>
          <div className="admin__actions">
            <button
              className="admin__btn admin__export-btn"
              onClick={handleExport}
              disabled={exportLoading}
            >
              {exportLoading ? 'Exporting...' : 'Export Games (JSON)'}
            </button>
          </div>
          {exportError && <p className="admin__error">{exportError}</p>}
        </div>

        <div className="admin__fields">
          {draft && (Object.keys(LABELS) as (keyof GameConfig)[]).map(key => (
            <div className="admin__field" key={key}>
              <label className="admin__label">{LABELS[key]}</label>
              <div className="admin__row">
                <input
                  className="admin__range"
                  type="range"
                  min={LIMITS[key].min}
                  max={LIMITS[key].max}
                  step={LIMITS[key].step}
                  value={draft[key]}
                  onChange={e => setDraft(d => d ? { ...d, [key]: Number(e.target.value) } : d)}
                />
                <input
                  className="admin__number"
                  type="number"
                  min={LIMITS[key].min}
                  max={LIMITS[key].max}
                  step={LIMITS[key].step}
                  value={draft[key]}
                  onChange={e => setDraft(d => d ? { ...d, [key]: Number(e.target.value) } : d)}
                />
              </div>
              {key === 'turnTimeoutMs' && (
                <span className="admin__hint">{(draft[key] / 1000).toFixed(0)}s per turn</span>
              )}
              {key === 'gracePeriodMs' && (
                <span className="admin__hint">{(draft[key] / 1000).toFixed(0)}s before disconnected player is removed</span>
              )}
              {key === 'roomExpiryMs' && (
                <span className="admin__hint">{(draft[key] / 3_600_000).toFixed(1)}h until finished rooms are purged</span>
              )}
            </div>
          ))}
        </div>

        <div className="admin__actions">
          <button
            className="admin__btn"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved!' : 'Save changes'}
          </button>
          {saveStatus === 'error' && (
            <span className="admin__error">Save failed — check server.</span>
          )}
        </div>

        {config && draft && JSON.stringify(config) !== JSON.stringify(draft) && (
          <p className="admin__hint">You have unsaved changes.</p>
        )}
      </div>
    </div>
  );
}
