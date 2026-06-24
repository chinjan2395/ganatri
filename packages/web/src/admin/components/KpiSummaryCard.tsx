import type { KpiCardData } from '../mockData';

import type { ReactNode } from 'react';

const ICONS: Record<string, ReactNode> = {
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  game: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      <circle cx="16" cy="10" r="1.5" fill="currentColor" />
    </svg>
  ),
  room: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  alert: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  ),
  clock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  mic: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    </svg>
  ),
};

interface KpiSummaryCardProps {
  data: KpiCardData;
}

export function KpiSummaryCard({ data }: KpiSummaryCardProps) {
  const isPositive = data.delta > 0;
  const isNegativeGood = data.label === 'Abandonment Rate' && data.delta < 0;
  const deltaClass = isNegativeGood || (isPositive && data.label !== 'Abandonment Rate')
    ? 'admin-kpi-card__delta--up'
    : data.delta < 0
      ? 'admin-kpi-card__delta--down-good'
      : 'admin-kpi-card__delta--up';

  return (
    <div className="admin-kpi-card">
      <div className="admin-kpi-card__icon">{ICONS[data.icon] ?? ICONS.users}</div>
      <span className="admin-kpi-card__label">{data.label}</span>
      <span className="admin-kpi-card__value">{data.value}</span>
      <span className={`admin-kpi-card__delta ${deltaClass}`}>
        {data.delta > 0 ? '▲' : '▼'} {Math.abs(data.delta)}% {data.deltaLabel}
      </span>
    </div>
  );
}
