import type { Meta, StoryObj } from '@storybook/react';
import { DsProfileSidebar } from './ProfileSidebar';
import type { DsProfileNavItem } from './ProfileSidebar';
import type { DsProfileStat } from '../ProfileCard';

const SAMPLE_STATS: DsProfileStat[] = [
  { label: 'Rank', value: '#12' },
  { label: 'Win Rate', value: '64%' },
  { label: 'Wins', value: '42' },
  { label: 'Games', value: '66' },
];

const NAV_ITEMS: DsProfileNavItem[] = [
  { label: 'Leaderboard', active: true },
  { label: 'My Stats', onClick: () => console.log('stats') },
  { label: 'History', onClick: () => console.log('history') },
];

const meta: Meta<typeof DsProfileSidebar> = {
  component: DsProfileSidebar,
  title: 'Profile/DsProfileSidebar',
  parameters: {
    // Force desktop viewport so the sidebar is visible
    viewport: { defaultViewport: 'desktop' },
  },
};
export default meta;
type Story = StoryObj<typeof DsProfileSidebar>;

export const Default: Story = {
  args: {
    displayName: 'Alice',
    playerId: 'user-1234',
    showCrown: true,
    stats: SAMPLE_STATS,
    navItems: NAV_ITEMS,
  },
};

export const WithAvatar: Story = {
  args: {
    displayName: 'Bob',
    avatarUrl: 'https://i.pravatar.cc/80?img=3',
    playerId: 'user-5678',
    showCrown: false,
    stats: SAMPLE_STATS,
    navItems: NAV_ITEMS,
  },
};

export const NoCrown: Story = {
  args: {
    displayName: 'Charlie',
    playerId: 'user-9012',
    showCrown: false,
    stats: SAMPLE_STATS,
    navItems: NAV_ITEMS,
  },
};

export const NoStats: Story = {
  args: {
    displayName: 'Diana',
    navItems: NAV_ITEMS,
  },
};

export const HistoryActive: Story = {
  args: {
    displayName: 'Eve',
    playerId: 'user-3456',
    stats: SAMPLE_STATS,
    navItems: [
      { label: 'Leaderboard', onClick: () => console.log('leaderboard') },
      { label: 'My Stats', onClick: () => console.log('stats') },
      { label: 'History', active: true },
    ],
  },
};
