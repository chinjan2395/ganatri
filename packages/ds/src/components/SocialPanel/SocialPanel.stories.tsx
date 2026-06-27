import type { Meta, StoryObj } from '@storybook/react';
import { SocialPanel } from './SocialPanel';

const meta: Meta<typeof SocialPanel> = {
  component: SocialPanel,
  title: 'Social/SocialPanel',
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof SocialPanel>;

const sampleOnlineFriends = [
  { userId: 'u1', displayName: 'Priya Patel', gamesPlayedTogether: 12, isOnline: true },
  { userId: 'u2', displayName: 'Rajan Kumar', gamesPlayedTogether: 8, isOnline: true },
];

const sampleOpponents = [
  { userId: 'u3', displayName: 'Champaklal', gamesPlayedTogether: 3, isOnline: false },
  { userId: 'u4', displayName: 'Sunita Sharma', gamesPlayedTogether: 1, isOnline: true },
];

const noop = async (): Promise<{ ok: boolean }> => ({ ok: true });

export const Default: Story = {
  args: {
    onlineFriends: sampleOnlineFriends,
    recentOpponents: sampleOpponents,
    isLoggedIn: true,
    isLoading: false,
    onInvite: noop,
  },
};

export const Loading: Story = {
  args: {
    onlineFriends: [],
    recentOpponents: [],
    isLoggedIn: true,
    isLoading: true,
    onInvite: noop,
  },
};

export const LoggedOut: Story = {
  args: {
    onlineFriends: [],
    recentOpponents: [],
    isLoggedIn: false,
    isLoading: false,
    onInvite: noop,
  },
};

export const Empty: Story = {
  args: {
    onlineFriends: [],
    recentOpponents: [],
    isLoggedIn: true,
    isLoading: false,
    onInvite: noop,
  },
};
