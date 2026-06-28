import type { Meta, StoryObj } from '@storybook/react';
import { DsBottomNav } from './BottomNav';
import type { DsBottomNavTab } from './BottomNav';

const DEFAULT_TABS: DsBottomNavTab[] = [
  { id: 'home', label: 'HOME', icon: 'home' },
  { id: 'history', label: 'HISTORY', icon: 'history' },
  { id: 'stats', label: 'STATS', icon: 'stats' },
  { id: 'leaderboard', label: 'BOARD', icon: 'leaderboard' },
  { id: 'profile', label: 'PROFILE', icon: 'profile' },
];

const meta: Meta<typeof DsBottomNav> = {
  component: DsBottomNav,
  title: 'Navigation/DsBottomNav',
};
export default meta;
type Story = StoryObj<typeof DsBottomNav>;

export const Default: Story = {
  args: {
    tabs: DEFAULT_TABS,
    activeId: 'home',
    onTab: (id) => console.log('tab', id),
  },
};

export const StatsActive: Story = {
  args: {
    tabs: DEFAULT_TABS,
    activeId: 'stats',
    onTab: (id) => console.log('tab', id),
  },
};
