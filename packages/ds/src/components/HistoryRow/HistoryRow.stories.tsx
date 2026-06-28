import type { Meta, StoryObj } from '@storybook/react';
import { DsHistoryRow } from './HistoryRow';
import type { DsHistoryRowPlayer } from './HistoryRow';

const SAMPLE_PLAYERS: DsHistoryRowPlayer[] = [
  { seatIndex: 0, displayName: 'Alice', finalRank: 1, captureCount: 18, wasCut: false, matchScore: 120, isYou: true },
  { seatIndex: 1, displayName: 'Bob', finalRank: 2, captureCount: 12, wasCut: false, matchScore: 80, isYou: false },
  { seatIndex: 2, displayName: 'Carol', finalRank: 3, captureCount: 8, wasCut: true, matchScore: 40, isYou: false },
];

const meta: Meta<typeof DsHistoryRow> = {
  component: DsHistoryRow,
  title: 'Data/DsHistoryRow',
};
export default meta;
type Story = StoryObj<typeof DsHistoryRow>;

export const Won: Story = {
  args: {
    outcome: 'won',
    outcomeLabel: 'Won',
    date: 'Jun 28, 2026',
    opponents: ['Bob', 'Carol'],
    playerCount: 3,
    duration: '12m 34s',
    matchScore: 120,
    xpEarned: 85,
    rankedRatingDelta: 15,
    players: SAMPLE_PLAYERS,
    isWin: true,
  },
};

export const Lost: Story = {
  args: {
    outcome: 'lost',
    outcomeLabel: 'Lost',
    date: 'Jun 27, 2026',
    opponents: ['Dave', 'Eve'],
    playerCount: 3,
    duration: '9m 12s',
    matchScore: 40,
    xpEarned: 20,
    rankedRatingDelta: -8,
    players: [
      { seatIndex: 0, displayName: 'Dave', finalRank: 1, captureCount: 20, wasCut: false, matchScore: 130, isYou: false },
      { seatIndex: 1, displayName: 'You', finalRank: 2, captureCount: 10, wasCut: false, matchScore: 40, isYou: true },
      { seatIndex: 2, displayName: 'Eve', finalRank: 3, captureCount: 5, wasCut: true, matchScore: 20, isYou: false },
    ],
    isWin: false,
  },
};

export const Abandoned: Story = {
  args: {
    outcome: 'abandoned',
    outcomeLabel: 'Abandoned',
    date: 'Jun 26, 2026',
    opponents: ['Frank'],
    playerCount: 2,
    duration: '2m 05s',
    matchScore: 0,
    xpEarned: 0,
    rankedRatingDelta: 0,
    players: [
      { seatIndex: 0, displayName: 'You', finalRank: null, captureCount: 3, wasCut: false, matchScore: 0, isYou: true },
      { seatIndex: 1, displayName: 'Frank', finalRank: null, captureCount: 2, wasCut: false, matchScore: 0, isYou: false },
    ],
    isWin: false,
  },
};

export const WithOnePlayer: Story = {
  args: {
    outcome: 'neutral',
    outcomeLabel: '—',
    date: 'Jun 25, 2026',
    opponents: [],
    playerCount: 1,
    duration: '5m 00s',
    matchScore: 0,
    xpEarned: 5,
    rankedRatingDelta: 0,
    players: [
      { seatIndex: 0, displayName: 'Solo', finalRank: 1, captureCount: 20, wasCut: false, matchScore: 0, isYou: true },
    ],
    isWin: false,
  },
};
