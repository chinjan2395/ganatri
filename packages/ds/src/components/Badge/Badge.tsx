import './Badge.css';

export type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = 'default' }: BadgeProps) {
  return <span className={`ds-badge ds-badge--${tone}`}>{label}</span>;
}
