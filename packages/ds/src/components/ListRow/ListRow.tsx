import type { ReactNode } from 'react';
import './ListRow.css';

export interface DsListRowProps {
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}

export function DsListRow({
  title,
  subtitle,
  trailing,
}: DsListRowProps): ReactNode {
  return (
    <div className="ds-list-row">
      <div className="ds-list-row__avatar" aria-hidden="true">
        {title.charAt(0).toUpperCase()}
      </div>
      <div className="ds-list-row__copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {trailing !== undefined ? (
        <div className="ds-list-row__trailing">{trailing}</div>
      ) : null}
    </div>
  );
}
