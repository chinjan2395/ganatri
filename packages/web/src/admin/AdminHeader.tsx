import { useEffect, useState } from 'react';
import { ADMIN_PAGE_META } from './adminPageMeta';
import { AdminFlourish } from './components/AdminFlourish';
import type { AdminSection } from './types';

interface AdminHeaderProps {
  activeSection: AdminSection;
  email: string;
  onRefresh: () => void;
  refreshing: boolean;
  onMenuToggle: () => void;
}

export function AdminHeader({
  activeSection,
  email,
  onRefresh,
  refreshing,
  onMenuToggle,
}: AdminHeaderProps) {
  const [now, setNow] = useState(() => new Date());
  const meta = ADMIN_PAGE_META[activeSection];

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const displayName = email.split('@')[0] ?? 'Admin';

  return (
    <header className="admin-header">
      <div className="admin-header__left">
        <button type="button" className="admin-header__menu-btn" onClick={onMenuToggle} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="admin-header__titles">
          <h1 className="admin-header__title">
            <AdminFlourish />
            <span>{meta.title}</span>
            <AdminFlourish mirrored />
          </h1>
          <p className="admin-header__welcome">
            {meta.subtitle}
            {meta.statusLabel && (
              <>
                {' '}&bull;{' '}
                <span className="admin-header__status">
                  <span className="admin-header__status-dot" />
                  {meta.statusLabel}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="admin-header__right">
        <button
          type="button"
          className="admin-header__refresh"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh All'}
        </button>

        <div className="admin-header__datetime">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
          </svg>
          {dateStr}, {timeStr} IST
        </div>

        <button type="button" className="admin-header__bell" aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="admin-header__badge">5</span>
        </button>

        <div className="admin-header__profile">
          <div className="admin-header__avatar">{displayName.charAt(0).toUpperCase()}</div>
          <div className="admin-header__profile-text">
            <span className="admin-header__profile-name">{displayName}</span>
            <span className="admin-header__profile-role">Super Admin</span>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </header>
  );
}
