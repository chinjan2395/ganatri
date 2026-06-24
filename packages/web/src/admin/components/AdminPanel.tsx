import type { ReactNode } from 'react';

interface AdminPanelProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function AdminPanel({ title, children, className = '', action }: AdminPanelProps) {
  return (
    <section className={`admin-panel ${className}`.trim()}>
      <div className="admin-panel__header">
        <h3 className="admin-panel__title">{title}</h3>
        {action}
      </div>
      <div className="admin-panel__body">{children}</div>
    </section>
  );
}
