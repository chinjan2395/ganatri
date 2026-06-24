import type { ReactNode } from 'react';

export type AdminSection =
  | 'dashboard'
  | 'live-operations'
  | 'analytics'
  | 'user-management'
  | 'room-management'
  | 'leaderboards'
  | 'social-management'
  | 'voice-monitoring'
  | 'data-exports'
  | 'security'
  | 'settings';

export interface NavItem {
  id: AdminSection;
  label: string;
  icon: ReactNode;
}
