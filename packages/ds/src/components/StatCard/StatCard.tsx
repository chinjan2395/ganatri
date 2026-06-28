import type { ReactNode, CSSProperties } from 'react';
import './StatCard.css';

export interface DsStatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: boolean;
  animationDelay?: number;
}

export function DsStatCard({
  label,
  value,
  icon,
  accent = false,
  animationDelay,
}: DsStatCardProps): ReactNode {
  const classes = ['ds-stat-card', accent ? 'ds-stat-card--accent' : '']
    .filter(Boolean)
    .join(' ');

  const style = {
    '--ds-stat-card-delay': `${animationDelay ?? 0}s`,
  } as CSSProperties & Record<string, string>;

  return (
    <div className={classes} style={style}>
      <span className="ds-stat-card__icon">{icon}</span>
      <span className="ds-stat-card__value">{value}</span>
      <span className="ds-stat-card__label">{label}</span>
    </div>
  );
}
