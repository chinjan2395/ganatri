import type { Meta, StoryObj } from '@storybook/react';
import { ScoreCard } from './ScoreCard';
import type { ScoreCardEntry } from './ScoreCard';

const meta: Meta<typeof ScoreCard> = {
  title: 'Game/ScoreCard',
  component: ScoreCard,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark-felt' },
  },
};
export default meta;

type Story = StoryObj<typeof ScoreCard>;

const captureEntries: ScoreCardEntry[] = [
  { id: 'p1', name: 'You', isYou: true, score: 5, isLeader: true, isTurn: true },
  { id: 'p2', name: 'Alice', isYou: false, score: 3 },
  { id: 'p3', name: 'Bob', isYou: false, score: 2 },
];

const safeRankEntries: ScoreCardEntry[] = [
  { id: 'p1', name: 'Alice', isYou: false, score: 1, isLeader: true },
  { id: 'p2', name: 'You', isYou: true, score: 0, isTurn: true },
  { id: 'p3', name: 'Bob', isYou: false, score: 0 },
];

export const Captures: Story = {
  args: {
    title: 'CAPTURES',
    entries: captureEntries,
  },
};

export const SafeRank: Story = {
  args: {
    title: 'SAFE RANK',
    entries: safeRankEntries,
  },
};

export const NoLeader: Story = {
  args: {
    title: 'CAPTURES',
    entries: captureEntries.map((e) => ({ ...e, isLeader: false, score: 0 })),
  },
};
