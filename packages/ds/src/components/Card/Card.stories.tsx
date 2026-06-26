import type { Meta, StoryObj } from '@storybook/react';
import { DsCard } from './Card';

const meta: Meta<typeof DsCard> = {
  component: DsCard,
  title: 'Layout/Card',
  argTypes: {
    tone: { control: 'select', options: ['default', 'success', 'warning', 'danger', 'info'] },
  },
};
export default meta;
type Story = StoryObj<typeof DsCard>;

export const Default: Story = {
  args: {
    title: 'Room Details',
    subtitle: 'Classic mode · 4 players',
    children: 'Room code ROOM-4X7Z. Created by Chinjan. Waiting for players.',
  },
};

export const NoHeader: Story = {
  args: {
    children: 'A simple card with no title or subtitle — useful for wrapping any grouped content.',
  },
};

export const TitleOnly: Story = {
  args: {
    title: 'Active Game',
    children: 'Phase 1 in progress · Turn 7 of 12 · 3 players seated.',
  },
};

export const WithSubtitle: Story = {
  args: {
    title: 'Player Stats',
    subtitle: 'Season totals',
    children: '24 wins · 61 games · 39% win rate.',
  },
};
