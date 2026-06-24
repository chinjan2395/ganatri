import type { AdminSection } from './types';

export interface AdminPageMeta {
  title: string;
  subtitle: string;
  statusLabel?: string;
}

export const ADMIN_PAGE_META: Record<AdminSection, AdminPageMeta> = {
  dashboard: {
    title: 'Admin Control Center',
    subtitle: 'Welcome back — monitor live operations and platform health',
    statusLabel: 'All systems operational',
  },
  'live-operations': {
    title: 'Live Operations',
    subtitle: 'Real-time game rooms, sessions, and server activity',
    statusLabel: 'Live monitoring active',
  },
  analytics: {
    title: 'Analytics',
    subtitle: 'Historical KPIs, trends, and performance insights',
    statusLabel: 'Data refreshed every 15s',
  },
  'user-management': {
    title: 'User Management',
    subtitle: 'Search, view and manage all players',
  },
  'room-management': {
    title: 'Room Management',
    subtitle: 'View, monitor and manage all active and recent rooms',
  },
  leaderboards: {
    title: 'Leaderboards',
    subtitle: 'Weekly and monthly player rankings',
  },
  'social-management': {
    title: 'Social Management',
    subtitle: 'Friends, invitations, and blocked users overview',
  },
  'voice-monitoring': {
    title: 'Voice Monitoring',
    subtitle: 'Voice chat sessions, quality, and adoption metrics',
  },
  'data-exports': {
    title: 'Data Exports',
    subtitle: 'Download platform data for offline analysis',
  },
  security: {
    title: 'Security & Compliance',
    subtitle: 'Manage admin security, access control and compliance',
    statusLabel: 'All systems secure',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Game configuration and platform parameters',
    statusLabel: 'Live config — no restart needed',
  },
};
