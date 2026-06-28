import type { ReactNode } from 'react';
import { DsIcon } from '../Icon';
import type { DsIconName } from '../Icon';
import './TopNav.css';

export interface DsTopNavItem {
  id: string;
  label: string;
  icon: DsIconName;
}

export interface DsTopNavProps {
  /** Logo element rendered at header-left */
  logo: ReactNode;
  /** Navigation items */
  items: DsTopNavItem[];
  /** Currently active item id */
  activeId: string;
  /** Called with the item id when user clicks a nav button */
  onNavigate: (id: string) => void;
  /** Avatar URL — if null/undefined, show initials fallback */
  avatarUrl?: string | null;
  /** Single uppercase initial to show when no avatarUrl */
  avatarInitial: string;
  /** aria-label for avatar button */
  avatarLabel: string;
  /** Called when avatar button is clicked */
  onAvatarClick: () => void;
}

export function DsTopNav({
  logo,
  items,
  activeId,
  onNavigate,
  avatarUrl,
  avatarInitial,
  avatarLabel,
  onAvatarClick,
}: DsTopNavProps): ReactNode {
  return (
    <header className="ds-top-nav">
      <div className="ds-top-nav__left">{logo}</div>

      <nav className="ds-top-nav__nav" aria-label="Main navigation">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              className={`ds-top-nav__btn${isActive ? ' ds-top-nav__btn--active' : ''}`}
              onClick={() => (isActive ? undefined : onNavigate(item.id))}
              aria-current={isActive ? 'page' : undefined}
            >
              <DsIcon name={item.icon} size={18} aria-hidden />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="ds-top-nav__right">
        <button
          type="button"
          className="ds-top-nav__avatar-btn"
          onClick={onAvatarClick}
          aria-label={avatarLabel}
        >
          {avatarUrl ? (
            <img
              className="ds-top-nav__avatar-img"
              src={avatarUrl}
              referrerPolicy="no-referrer"
              alt=""
            />
          ) : (
            <span className="ds-top-nav__avatar-initials" aria-hidden="true">
              {avatarInitial}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
