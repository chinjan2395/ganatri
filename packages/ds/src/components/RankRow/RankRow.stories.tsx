import type { Meta, StoryObj } from '@storybook/react';
import { DsRankRow } from './RankRow';

const meta: Meta<typeof DsRankRow> = {
  component: DsRankRow,
  title: 'Data/DsRankRow',
  argTypes: {
    rank: { control: 'number' },
    displayName: { control: 'text' },
    isMe: { control: 'boolean' },
    compact: { control: 'boolean' },
    gamesWon: { control: 'number' },
    gamesPlayed: { control: 'number' },
    winRate: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof DsRankRow>;

export const Default: Story = {
  args: {
    rank: 4,
    displayName: 'Alice',
    gamesWon: 12,
    gamesPlayed: 20,
    winRate: '60%',
  },
};

export const Gold: Story = {
  args: {
    rank: 1,
    displayName: 'Bob',
    isMe: true,
    gamesWon: 42,
    gamesPlayed: 66,
    winRate: '64%',
  },
};

export const Silver: Story = {
  args: {
    rank: 2,
    displayName: 'Carol',
    gamesWon: 35,
    gamesPlayed: 58,
    winRate: '60%',
  },
};

export const Bronze: Story = {
  args: {
    rank: 3,
    displayName: 'Dave',
    gamesWon: 28,
    gamesPlayed: 50,
    winRate: '56%',
  },
};

export const Compact: Story = {
  args: {
    rank: 7,
    displayName: 'Eve',
    compact: true,
    gamesWon: 8,
    gamesPlayed: 15,
    winRate: '53%',
    avatarUrl: 'https://i.pravatar.cc/80?img=7',
  },
};
