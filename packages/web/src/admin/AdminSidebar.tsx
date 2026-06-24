import { ADMIN_NAV_ITEMS } from './adminNav';
import { AdminSidebarBrand } from './components/AdminSidebarBrand';
import { SystemStatusWidget } from './components/SystemStatusWidget';
import type { AdminSection } from './types';

interface AdminSidebarProps {
  active: AdminSection;
  onNavigate: (section: AdminSection) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AdminSidebar({ active, onNavigate, mobileOpen, onCloseMobile }: AdminSidebarProps) {
  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="admin-sidebar__backdrop"
          aria-label="Close menu"
          onClick={onCloseMobile}
        />
      )}
      <aside className={`admin-sidebar ${mobileOpen ? 'admin-sidebar--open' : ''}`}>
        <div className="admin-sidebar__rail" aria-hidden="true" />

        <AdminSidebarBrand />

        <div className="admin-sidebar__nav-section">
          <p className="admin-sidebar__nav-label">Navigation</p>
          <nav className="admin-sidebar__nav" aria-label="Admin navigation">
            {ADMIN_NAV_ITEMS.map(item => {
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-sidebar__link ${isActive ? 'admin-sidebar__link--active' : ''}`}
                  onClick={() => {
                    onNavigate(item.id);
                    onCloseMobile();
                  }}
                >
                  <span className="admin-sidebar__icon-box">{item.icon}</span>
                  <span className="admin-sidebar__link-text">{item.label}</span>
                  {isActive && <span className="admin-sidebar__active-bar" aria-hidden="true" />}
                </button>
              );
            })}
          </nav>
        </div>

        <SystemStatusWidget />
      </aside>
    </>
  );
}
