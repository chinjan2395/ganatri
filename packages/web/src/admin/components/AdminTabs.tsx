interface AdminTabsProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}

export function AdminTabs({ tabs, active, onChange }: AdminTabsProps) {
  return (
    <div className="admin-tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          className={`admin-tabs__tab ${active === tab ? 'admin-tabs__tab--active' : ''}`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
