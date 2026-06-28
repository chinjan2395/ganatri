import type { Meta, StoryObj } from '@storybook/react';
import { DsProfileCard } from './ProfileCard';
import type { DsProfileStat } from './ProfileCard';

const SAMPLE_STATS: DsProfileStat[] = [
  { label: 'Rank', value: '#12' },
  { label: 'Win Rate', value: '64%' },
  { label: 'Wins', value: '42' },
  { label: 'Games', value: '66' },
];

const meta: Meta<typeof DsProfileCard> = {
  component: DsProfileCard,
  title: 'Profile/DsProfileCard',
  argTypes: {
    displayName: { control: 'text' },
    playerId: { control: 'text' },
    showCrown: { control: 'boolean' },
    avatarUrl: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof DsProfileCard>;

export const Default: Story = {
  args: {
    displayName: 'Alice',
    playerId: 'user-1234',
    showCrown: false,
    stats: SAMPLE_STATS,
  },
};

export const WithCrown: Story = {
  args: {
    displayName: 'Bob',
    playerId: 'user-5678',
    showCrown: true,
    stats: SAMPLE_STATS,
  },
};

export const WithAvatar: Story = {
  args: {
    displayName: 'Charlie',
    avatarUrl: 'https://i.pravatar.cc/80?img=5',
    playerId: 'user-9012',
    showCrown: true,
    stats: SAMPLE_STATS,
  },
};

export const NoStats: Story = {
  args: {
    displayName: 'Diana',
    playerId: 'user-3456',
    showCrown: false,
  },
};

export const NoPlayerId: Story = {
  args: {
    displayName: 'Eve',
    showCrown: false,
    stats: SAMPLE_STATS.slice(0, 2),
  },
};

export const MinimalNoAvatar: Story = {
  args: {
    displayName: 'Frank',
  },
};
