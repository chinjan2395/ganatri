import type { Meta, StoryObj } from '@storybook/react';
import { DsEmptyState } from './EmptyState';

const meta: Meta<typeof DsEmptyState> = {
  component: DsEmptyState,
  title: 'Primitives/EmptyState',
  argTypes: {
    message: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof DsEmptyState>;

export const Default: Story = {
  args: { message: 'No games played yet.' },
};

export const Leaderboard: Story = {
  args: { message: 'No players on the leaderboard yet.' },
};

export const History: Story = {
  args: { message: 'Your match history will appear here.' },
};
