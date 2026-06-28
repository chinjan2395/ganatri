import type { ReactNode } from 'react';
import { DsIcon } from '../Icon';
import type { DsIconName } from '../Icon';
import './BottomNav.css';

export interface DsBottomNavTab {
  id: string;
  label: string;
  icon: DsIconName;
}

export interface DsBottomNavProps {
  tabs: DsBottomNavTab[];
  activeId: string;
  onTab: (id: string) => void;
}

export function DsBottomNav({
  tabs,
  activeId,
  onTab,
}: DsBottomNavProps): ReactNode {
  return (
    <nav className="ds-bottom-nav" aria-label="Main navigation">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            className={`ds-bottom-nav__tab${isActive ? ' ds-bottom-nav__tab--active' : ''}`}
            onClick={() => onTab(tab.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <DsIcon name={tab.icon} size={22} aria-hidden />
            <span className="ds-bottom-nav__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
