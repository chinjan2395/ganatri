import type { ReactNode } from 'react';
import { DsProfileCard } from '../ProfileCard';
import type { DsProfileStat } from '../ProfileCard';
import './ProfileSidebar.css';

export type { DsProfileStat };

export interface DsProfileNavItem {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface DsProfileSidebarProps {
  displayName: string;
  avatarUrl?: string | null;
  playerId?: string | null;
  showCrown?: boolean;
  stats?: DsProfileStat[];
  navItems: DsProfileNavItem[];
  className?: string;
}

export function DsProfileSidebar({
  displayName,
  avatarUrl,
  playerId,
  showCrown,
  stats,
  navItems,
  className,
}: DsProfileSidebarProps): ReactNode {
  const rootClass = `ds-profile-sidebar${className ? ` ${className}` : ''}`;

  return (
    <aside className={rootClass}>
      <DsProfileCard
        displayName={displayName}
        avatarUrl={avatarUrl}
        playerId={playerId}
        showCrown={showCrown}
        stats={stats}
      />

      {navItems.length > 0 && (
        <nav className="ds-profile-sidebar__nav">
          {navItems.map((item) => {
            const btnClass = [
              'ds-profile-sidebar__nav-btn',
              item.active ? 'ds-profile-sidebar__nav-btn--active' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={item.label}
                type="button"
                className={btnClass}
                disabled={item.disabled ?? false}
                onClick={item.active ? undefined : item.onClick}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
