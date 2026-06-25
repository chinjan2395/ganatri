import { useState, type ReactNode } from 'react';
import { AdminFooter } from './AdminFooter';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import type { AdminSection } from './types';

interface AdminLayoutProps {
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
  email: string;
  onRefresh: () => void;
  refreshing: boolean;
  children: ReactNode;
  sidebar?: ReactNode;
  header?: ReactNode;
}

export function AdminLayout({
  activeSection,
  onNavigate,
  email,
  onRefresh,
  refreshing,
  children,
  sidebar,
  header,
}: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="admin-shell">
      {sidebar ?? (
        <AdminSidebar
          active={activeSection}
          onNavigate={onNavigate}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
      )}
      <div className="admin-main">
        {header ?? (
          <AdminHeader
            activeSection={activeSection}
            email={email}
            onRefresh={onRefresh}
            refreshing={refreshing}
            onMenuToggle={() => setMobileOpen(o => !o)}
          />
        )}
        <main className="admin-content">{children}</main>
        <AdminFooter />
      </div>
    </div>
  );
}
