import type { ReactNode } from 'react';

interface AdminPlaceholderProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function AdminPlaceholder({ title, description, children }: AdminPlaceholderProps) {
  return (
    <div className="admin-placeholder">
      <h2 className="admin-placeholder__title">{title}</h2>
      <p className="admin-placeholder__desc">{description}</p>
      {children}
    </div>
  );
}
