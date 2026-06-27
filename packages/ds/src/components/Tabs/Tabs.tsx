import type { ReactNode } from 'react';
import './Tabs.css';

export interface DsTabsProps {
  items: string[];
  active: string;
  onChange?: (item: string) => void;
}

export function DsTabs({ items, active, onChange }: DsTabsProps): ReactNode {
  return (
    <div className="ds-tabs" role="tablist" aria-label="Tabs">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={item === active}
          className={`ds-tab${item === active ? ' is-active' : ''}`}
          onClick={() => onChange?.(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
