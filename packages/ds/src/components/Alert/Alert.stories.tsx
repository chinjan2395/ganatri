import type { Meta, StoryObj } from '@storybook/react';
import { DsAlert } from './Alert';

const meta: Meta<typeof DsAlert> = {
  component: DsAlert,
  title: 'Feedback/Alert',
};
export default meta;
type Story = StoryObj<typeof DsAlert>;

export const Success: Story = {
  args: {
    tone: 'success',
    title: 'Game started',
    description: 'All 4 players have joined. Part 1 has begun.',
  },
};

export const Warning: Story = {
  args: {
    tone: 'warning',
    title: 'Waiting for players',
    description: 'Need at least 2 players to start the game.',
  },
};

export const Danger: Story = {
  args: {
    tone: 'danger',
    title: 'Connection lost',
    description: 'Attempting to reconnect. Your game state is preserved.',
  },
};

export const Info: Story = {
  args: {
    tone: 'info',
    title: 'Your turn',
    description: 'Play a card from your hand to continue.',
  },
};
