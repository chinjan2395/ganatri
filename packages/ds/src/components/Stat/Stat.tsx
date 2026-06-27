import type { ReactNode } from 'react';
import './Stat.css';

export interface DsStatProps {
  label: string;
  value: string;
  delta?: string;
}

export function DsStat({ label, value, delta }: DsStatProps): ReactNode {
  return (
    <div className="ds-stat">
      <span className="ds-stat__label">{label}</span>
      <strong className="ds-stat__value">{value}</strong>
      {delta !== undefined ? (
        <span className="ds-stat__delta">{delta}</span>
      ) : null}
    </div>
  );
}
