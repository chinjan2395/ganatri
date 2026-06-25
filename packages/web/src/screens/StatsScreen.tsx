import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../state/GameProvider';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { GameHistoryEntry, PlayerStatsView } from '../protocol';
import logo from '../assets/ganatri-logo.png';
import './StatsScreen.css';

type NavScreen = 'main' | 'history' | 'stats' | 'leaderboard';
type BottomNavTab = 'home' | 'history' | 'stats' | 'leaderboard' | 'profile';

type StatsLoadState =
  | { status: 'loading' }
  | { status: 'error'; error: 'NOT_LOGGED_IN' | 'UNAVAILABLE' }
  | { status: 'ready'; stats: PlayerStatsView };

type HistoryLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; games: GameHistoryEntry[] };

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function formatPct(rate: number): string {
  if (!Number.isFinite(rate)) return '0%';
  return `${Math.round(rate * 100)}%`;
}

function formatAvgFinish(avg: number): string {
  if (!Number.isFinite(avg) || avg === 0) return '—';
  return avg.toFixed(1);
}

function formatPlayTimeBar(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '— TOTAL PLAY TIME';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}H ${m}M ${s}S TOTAL PLAY TIME`;
  return `${m}M ${s}S TOTAL PLAY TIME`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function rankSuffix(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}

function finishLabel(entry: GameHistoryEntry): { text: string; className: string } {
  if (entry.isAbandoned) return { text: 'Abandoned', className: 'st__result--abandoned' };
  const { finalRank } = entry.you;
  if (finalRank === 1) return { text: '1st', className: 'st__result--won' };
  if (finalRank != null) return { text: rankSuffix(finalRank), className: 'st__result--lost' };
  return { text: '—', className: 'st__result--neutral' };
}

function TitleFlourish(): React.ReactNode {
  return (
    <svg className="st__flourish" viewBox="0 0 48 12" aria-hidden="true">
      <path d="M0 6c8-6 16-6 24 0M24 6c8 6 16 6 24 0" stroke="currentColor" strokeWidth="1" fill="none" />
      <circle cx="24" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}

function CrownIcon(): React.ReactNode {
  return (
    <svg className="st__crown" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 18h18v2H3v-2zm2.5-9L7 12l5-7 5 7 1.5-3L21 14H3l2.5-5z" fill="currentColor" />
    </svg>
  );
}

function StatIcon({ name }: { name: string }): React.ReactNode {
  const props = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true as const };
  switch (name) {
    case 'games':
      return (
        <svg {...props}>
          <path d="M4 6h16v12H4V6zm2 2v8h12V8H6zm2 2h2v4H8v-4zm6 0h2v4h-2v-4z" fill="currentColor" />
        </svg>
      );
    case 'winrate':
      return (
        <svg {...props}>
          <path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" fill="currentColor" />
        </svg>
      );
    case 'podium':
      return (
        <svg {...props}>
          <path d="M8 21h8v-9H8v9zm-4-6H2v6h2v-6zm18 0h-2v6h2v-6zM12 3L7 10h10L12 3z" fill="currentColor" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
        </svg>
      );
    case 'x':
      return (
        <svg {...props}>
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor" />
        </svg>
      );
    case 'flag':
      return (
        <svg {...props}>
          <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z" fill="currentColor" />
        </svg>
      );
    case 'cards':
      return (
        <svg {...props}>
          <path d="M4 4h16v2H4V4zm0 4h10v2H4V8zm0 4h14v2H4v-2zm0 4h8v2H4v-2z" fill="currentColor" />
        </svg>
      );
    case 'scissors':
      return (
        <svg {...props}>
          <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-3L13.64 10.36zM6 20c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm12-8c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" fill="currentColor" />
        </svg>
      );
    case 'cut':
      return (
        <svg {...props}>
          <path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5zm-11 0C5.12 13 4 14.12 4 15.5S5.12 18 6.5 18 9 16.88 9 15.5 7.88 13 6.5 13z" fill="currentColor" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...props}>
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.11v5.71c0 4.54-3.07 8.83-7 9.93-3.93-1.1-7-5.39-7-9.93V6.29l7-3.11z" fill="currentColor" />
        </svg>
      );
    case 'flame':
      return (
        <svg {...props}>
          <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" fill="currentColor" />
        </svg>
      );
    case 'streak':
      return (
        <svg {...props}>
          <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  accent?: boolean;
  index: number;
}

function StatCard({ label, value, icon, accent, index }: StatCardProps): React.ReactNode {
  return (
    <motion.div
      className={`st__card${accent ? ' st__card--accent' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26, delay: index * 0.03 }}
    >
      <span className="st__card-icon"><StatIcon name={icon} /></span>
      <span className="st__card-value">{value}</span>
      <span className="st__card-label">{label}</span>
    </motion.div>
  );
}

interface StatsHeaderProps {
  account: ReturnType<typeof useGame>['account'];
  isDesktop: boolean;
  onNavigate: (screen: NavScreen) => void;
  onProfile: () => void;
}

function StatsHeader({ account, isDesktop, onNavigate, onProfile }: StatsHeaderProps): React.ReactNode {
  const displayName = account?.displayName ?? (account?.loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  const topNav: { id: NavScreen; label: string; icon: React.ReactNode }[] = [
    { id: 'main', label: 'Home', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" /></svg> },
    { id: 'history', label: 'History', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill="currentColor" /></svg> },
    { id: 'stats', label: 'Stats', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z" fill="currentColor" /></svg> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" fill="currentColor" /></svg> },
  ];

  if (!isDesktop) {
    return (
      <header className="st__header st__header--mobile">
        <button type="button" className="st__back-btn" onClick={() => onNavigate('main')} aria-label="Back to home">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
          </svg>
        </button>
        <div className="st__mobile-title-wrap">
          <TitleFlourish />
          <h1 className="st__mobile-title">YOUR STATS</h1>
          <TitleFlourish />
        </div>
        <button type="button" className="st__profile-icon-btn" onClick={onProfile} aria-label="Profile">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />
          </svg>
        </button>
      </header>
    );
  }

  return (
    <header className="st__header">
      <div className="st__header-left">
        <img src={logo} alt="Ganatri" className="st__header-logo-sm" />
      </div>
      <nav className="st__top-nav" aria-label="Main navigation">
        {topNav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`st__top-nav-btn${item.id === 'stats' ? ' st__top-nav-btn--active' : ''}`}
            onClick={() => (item.id === 'stats' ? undefined : onNavigate(item.id))}
            aria-current={item.id === 'stats' ? 'page' : undefined}
            disabled={item.id === 'stats'}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" className="st__top-nav-btn" onClick={onProfile}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />
          </svg>
          <span>Profile</span>
        </button>
      </nav>
      <div className="st__header-right">
        <button type="button" className="st__header-avatar-btn" onClick={onProfile} aria-label={`Profile: ${displayName}`}>
          {avatarUrl ? (
            <img className="st__header-avatar-img" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="st__header-avatar-initials" aria-hidden="true">{initial}</span>
          )}
        </button>
      </div>
    </header>
  );
}

interface ProfileSidebarProps {
  account: ReturnType<typeof useGame>['account'];
  playerId: string | null;
  loggedIn: boolean;
  onNavigate: (screen: 'history' | 'leaderboard') => void;
}

function StatsProfileSidebar({ account, playerId, loggedIn, onNavigate }: ProfileSidebarProps): React.ReactNode {
  const displayName = account?.displayName ?? (loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="st__sidebar">
      <div className="st__profile-card">
        <div className="st__profile-crown" aria-hidden="true"><CrownIcon /></div>
        <div className="st__profile-avatar-wrap">
          {avatarUrl ? (
            <img className="st__profile-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="st__profile-avatar st__profile-avatar--placeholder" aria-hidden="true">{initial}</span>
          )}
        </div>
        <h2 className="st__profile-name">{displayName}</h2>
        {playerId && <p className="st__profile-id">Player ID: {truncateId(playerId)}</p>}
      </div>
      <nav className="st__sidebar-nav" aria-label="Account navigation">
        <button type="button" className="st__sidebar-nav-btn st__sidebar-nav-btn--active" disabled>Stats</button>
        <button type="button" className="st__sidebar-nav-btn" onClick={() => onNavigate('history')}>Game History</button>
        <button type="button" className="st__sidebar-nav-btn" onClick={() => onNavigate('leaderboard')}>Leaderboard</button>
      </nav>
    </aside>
  );
}

function MobileProfileStrip({
  account, playerId, loggedIn,
}: { account: ReturnType<typeof useGame>['account']; playerId: string | null; loggedIn: boolean }): React.ReactNode {
  const displayName = account?.displayName ?? (loggedIn ? 'User' : 'Guest');
  const avatarUrl = account?.avatarUrl ?? null;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="st__mobile-profile">
      <div className="st__mobile-profile-avatar-wrap">
        {avatarUrl ? (
          <img className="st__mobile-profile-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="st__mobile-profile-avatar st__mobile-profile-avatar--placeholder" aria-hidden="true">{initial}</span>
        )}
      </div>
      <div className="st__mobile-profile-info">
        <span className="st__mobile-profile-name">{displayName}</span>
        {playerId && <span className="st__mobile-profile-id">ID: {truncateId(playerId)}</span>}
      </div>
    </div>
  );
}

function StatsBottomNav({ onTab }: { onTab: (tab: BottomNavTab) => void }): React.ReactNode {
  const tabs: { id: BottomNavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'HOME', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" /></svg> },
    { id: 'history', label: 'HISTORY', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill="currentColor" /></svg> },
    { id: 'stats', label: 'STATS', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z" fill="currentColor" /></svg> },
    { id: 'leaderboard', label: 'BOARD', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" fill="currentColor" /></svg> },
    { id: 'profile', label: 'PROFILE', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" /></svg> },
  ];

  return (
    <nav className="st__bottom-nav" aria-label="Main navigation">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`st__bottom-nav-tab${tab.id === 'stats' ? ' st__bottom-nav-tab--active' : ''}`}
          onClick={() => onTab(tab.id)}
          aria-current={tab.id === 'stats' ? 'page' : undefined}
        >
          {tab.icon}
          <span className="st__bottom-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function PlayTimeBar({ ms }: { ms: number }): React.ReactNode {
  return (
    <div className="st__playtime-bar">
      <svg className="st__playtime-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" fill="currentColor" />
      </svg>
      <span className="st__playtime-text">{formatPlayTimeBar(ms)}</span>
    </div>
  );
}

function PerformancePlaceholder(): React.ReactNode {
  return (
    <div className="st__panel st__panel--placeholder">
      <div className="st__panel-head">
        <h3 className="st__panel-title">Performance Over Time</h3>
        <span className="st__panel-dropdown" aria-disabled="true">Last 7 Days ▾</span>
      </div>
      <div className="st__chart-placeholder">
        <svg className="st__chart-silhouette" viewBox="0 0 200 80" aria-hidden="true">
          <polyline points="0,60 40,45 80,55 120,30 160,40 200,20" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        </svg>
        <span className="st__coming-soon">Coming soon</span>
      </div>
    </div>
  );
}

function FavoriteCardsPlaceholder(): React.ReactNode {
  return (
    <div className="st__panel st__panel--placeholder">
      <h3 className="st__panel-title">Favorite Cards</h3>
      <div className="st__cards-placeholder">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="st__card-silhouette" aria-hidden="true" />
        ))}
      </div>
      <span className="st__coming-soon">Coming soon</span>
    </div>
  );
}

function GameModesPlaceholder(): React.ReactNode {
  const modes = ['Classic', 'Points', 'Practice'];
  return (
    <div className="st__panel st__panel--placeholder">
      <h3 className="st__panel-title">Game Modes Played</h3>
      <div className="st__modes-row">
        {modes.map((m) => (
          <div key={m} className="st__mode-chip">
            <div className="st__mode-circle" aria-hidden="true" />
            <span className="st__mode-label">{m}</span>
          </div>
        ))}
      </div>
      <span className="st__coming-soon">Coming soon</span>
    </div>
  );
}

function AchievementsPlaceholder(): React.ReactNode {
  const badges = ['First Win', 'Sharp Shooter', 'Safe Player'];
  return (
    <div className="st__panel st__panel--placeholder">
      <h3 className="st__panel-title">Achievements</h3>
      <div className="st__badges-row">
        {badges.map((b) => (
          <div key={b} className="st__badge-silhouette">
            <div className="st__badge-shield" aria-hidden="true" />
            <span className="st__badge-label">{b}</span>
          </div>
        ))}
      </div>
      <span className="st__coming-soon">Coming soon</span>
      <button type="button" className="st__panel-link" disabled>View All Achievements</button>
    </div>
  );
}

function RecentResults({
  historyState,
  onViewAll,
}: {
  historyState: HistoryLoadState;
  onViewAll: () => void;
}): React.ReactNode {
  return (
    <div className="st__panel st__panel--recent">
      <h3 className="st__panel-title">Recent Results</h3>
      {historyState.status === 'loading' && <p className="st__panel-muted">Loading…</p>}
      {historyState.status === 'error' && <p className="st__panel-muted">History unavailable</p>}
      {(historyState.status === 'idle' || (historyState.status === 'ready' && historyState.games.length === 0)) && (
        <p className="st__panel-muted">No games yet</p>
      )}
      {historyState.status === 'ready' && historyState.games.length > 0 && (
        <ul className="st__recent-list">
          {historyState.games.slice(0, 4).map((game) => {
            const finish = finishLabel(game);
            return (
              <li key={game.id} className="st__recent-row">
                <span className="st__recent-date">{formatDate(game.startedAt)}</span>
                <span className={`st__recent-finish ${finish.className}`}>{finish.text}</span>
                <span className="st__recent-score">Score {game.matchScore ?? 0}</span>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="st__panel-link" onClick={onViewAll}>View All History</button>
    </div>
  );
}

function buildStatCards(stats: PlayerStatsView): { label: string; value: string | number; icon: string; accent?: boolean }[] {
  return [
    { label: 'Games Played', value: stats.gamesPlayed, icon: 'games' },
    { label: 'Win Rate', value: formatPct(stats.winRate), icon: 'winrate' },
    { label: 'Avg Finish', value: formatAvgFinish(stats.avgFinish), icon: 'podium' },
    { label: 'Wins', value: stats.gamesWon, icon: 'check' },
    { label: 'Losses', value: stats.gamesLost, icon: 'x' },
    { label: 'Abandoned', value: stats.gamesAbandoned, icon: 'flag' },
    { label: 'Total Captures', value: stats.totalCaptures, icon: 'cards' },
    { label: 'Cuts Given', value: stats.cutsGiven, icon: 'scissors' },
    { label: 'Cuts Received', value: stats.cutsReceived, icon: 'cut' },
    { label: 'Times Safe', value: stats.timesSafe, icon: 'shield' },
    { label: 'Best Match', value: stats.highestMatchScore, icon: 'cards' },
    { label: 'Avg Match Score', value: stats.averageMatchScore.toFixed(1), icon: 'podium' },
    { label: 'Ghost Finishes', value: stats.ghostFinishes, icon: 'shield' },
    { label: 'Total Match Score', value: stats.totalMatchScore, icon: 'games' },
    { label: 'Current Streak', value: stats.currentWinStreak, icon: 'flame', accent: true },
    { label: 'Longest Streak', value: stats.longestWinStreak, icon: 'streak' },
  ];
}

export function StatsScreen(): React.ReactNode {
  const { requestMyStats, requestHistory, setScreen, session, account } = useGame();
  const isDesktop = useIsDesktop();
  const loggedIn = account?.loggedIn ?? false;
  const playerId = session?.playerId ?? null;

  const [state, setState] = useState<StatsLoadState>({ status: 'loading' });
  const [historyState, setHistoryState] = useState<HistoryLoadState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    void requestMyStats().then((ack) => {
      if (cancelled) return;
      if (ack.ok) {
        setState({ status: 'ready', stats: ack.stats });
      } else {
        setState({ status: 'error', error: ack.error });
      }
    });
    return () => { cancelled = true; };
  }, [requestMyStats]);

  useEffect(() => {
    if (!loggedIn) {
      setHistoryState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setHistoryState({ status: 'loading' });
    void requestHistory().then((ack) => {
      if (cancelled) return;
      if (ack.ok) {
        setHistoryState({ status: 'ready', games: ack.games });
      } else {
        setHistoryState({ status: 'error' });
      }
    });
    return () => { cancelled = true; };
  }, [loggedIn, requestHistory]);

  function handleNavigate(screen: NavScreen): void {
    setScreen(screen);
  }

  function handleBottomNav(tab: BottomNavTab): void {
    if (tab === 'home' || tab === 'profile') setScreen('main');
    else if (tab === 'history') setScreen('history');
    else if (tab === 'leaderboard') setScreen('leaderboard');
  }

  const hasStats = state.status === 'ready' && state.stats.gamesPlayed > 0;

  return (
    <div className="st__root">
      <StatsHeader
        account={account}
        isDesktop={isDesktop}
        onNavigate={handleNavigate}
        onProfile={() => setScreen('main')}
      />

      <div className="st__layout">
        {isDesktop && (
          <StatsProfileSidebar
            account={account}
            playerId={playerId}
            loggedIn={loggedIn}
            onNavigate={(s) => setScreen(s)}
          />
        )}

        <main className="st__main">
          {!isDesktop && loggedIn && (
            <MobileProfileStrip account={account} playerId={playerId} loggedIn={loggedIn} />
          )}

          {isDesktop && (
            <div className="st__title-block">
              <div className="st__title-row">
                <TitleFlourish />
                <h1 className="st__page-title">YOUR STATS</h1>
                <TitleFlourish />
              </div>
            </div>
          )}

          {state.status === 'loading' && (
            <div className="st__center">
              <div className="spinner" />
              <p className="muted">Loading your stats…</p>
            </div>
          )}

          {state.status === 'error' && (
            <div className="card-surface st__message">
              <p>
                {state.error === 'NOT_LOGGED_IN'
                  ? 'Log in with Google to see your stats.'
                  : 'Stats are currently unavailable. Please try again later.'}
              </p>
              <button type="button" className="secondary" onClick={() => setScreen('main')}>
                Back to lobby
              </button>
            </div>
          )}

          {state.status === 'ready' && state.stats.gamesPlayed === 0 && (
            <div className="card-surface st__message">
              <p>No games played yet. Play a round and your stats will show up here!</p>
              <button type="button" className="secondary" onClick={() => setScreen('main')}>
                Back to lobby
              </button>
            </div>
          )}

          {hasStats && (
            <>
              <div className="st__grid">
                {buildStatCards(state.stats).map((card, i) => (
                  <StatCard key={card.label} {...card} index={i} />
                ))}
              </div>

              <PlayTimeBar ms={state.stats.totalPlayTimeMs} />

              <div className="st__middle-row">
                <PerformancePlaceholder />
                <FavoriteCardsPlaceholder />
              </div>

              <div className="st__bottom-row">
                <GameModesPlaceholder />
                <RecentResults historyState={historyState} onViewAll={() => setScreen('history')} />
                <AchievementsPlaceholder />
              </div>
            </>
          )}
        </main>
      </div>

      <StatsBottomNav onTab={handleBottomNav} />

      {isDesktop && (
        <footer className="st__footer-bar">
          <span className="st__footer-suits">♠ ♥ ♦</span>
          <span className="st__footer-tagline">Play smart. Play sharp. Win with Ganatri.</span>
          <span className="st__footer-suits">♣ ♥ ♠</span>
        </footer>
      )}
    </div>
  );
}
