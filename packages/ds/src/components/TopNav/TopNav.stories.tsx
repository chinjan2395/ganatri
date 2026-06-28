import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DsTopNav } from './TopNav';
import type { DsTopNavItem } from './TopNav';

const NAV_ITEMS: DsTopNavItem[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'stats', label: 'Stats', icon: 'stats' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
];

const LogoPlaceholder = (): ReactNode => (
  <span
    style={{
      fontFamily: 'serif',
      fontWeight: 700,
      fontSize: 18,
      color: 'var(--accent)',
      letterSpacing: '0.08em',
    }}
  >
    GANATRI
  </span>
);

const meta: Meta<typeof DsTopNav> = {
  component: DsTopNav,
  title: 'Navigation/DsTopNav',
};
export default meta;
type Story = StoryObj<typeof DsTopNav>;

export const Default: Story = {
  args: {
    logo: <LogoPlaceholder />,
    items: NAV_ITEMS,
    activeId: 'leaderboard',
    onNavigate: (id) => console.log('navigate', id),
    avatarUrl: null,
    avatarInitial: 'A',
    avatarLabel: 'Profile: Alice',
    onAvatarClick: () => console.log('avatar clicked'),
  },
};

export const DifferentActive: Story = {
  args: {
    logo: <LogoPlaceholder />,
    items: NAV_ITEMS,
    activeId: 'home',
    onNavigate: (id) => console.log('navigate', id),
    avatarUrl: 'https://i.pravatar.cc/80?img=3',
    avatarInitial: 'B',
    avatarLabel: 'Profile: Bob',
    onAvatarClick: () => console.log('avatar clicked'),
  },
};
