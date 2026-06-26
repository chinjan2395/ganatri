import './Tabs.css';

export interface TabsProps {
  items: string[];
  active: string;
  onSelect?: (item: string) => void;
}

export function Tabs({ items, active, onSelect }: TabsProps) {
  return (
    <div className="ds-tabs" role="tablist" aria-label="Tabs">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={item === active}
          className={`ds-tab${item === active ? ' is-active' : ''}`}
          onClick={() => onSelect?.(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
