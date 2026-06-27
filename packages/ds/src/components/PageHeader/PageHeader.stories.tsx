import type { Meta, StoryObj } from '@storybook/react';
import { DsPageHeader } from './PageHeader';

const meta: Meta<typeof DsPageHeader> = {
  component: DsPageHeader,
  title: 'Layout/PageHeader',
};
export default meta;
type Story = StoryObj<typeof DsPageHeader>;

export const Default: Story = {
  args: {
    eyebrow: 'Design System',
    title: 'Ganatri',
    description: 'Component library for the Ganatri multiplayer card game.',
  },
};

export const WithActions: Story = {
  args: {
    eyebrow: 'Room Lobby',
    title: 'Waiting Room',
    description: 'Share the room code with friends to fill the remaining seats.',
    actions: 'Action buttons here',
  },
};

export const Short: Story = {
  args: {
    eyebrow: 'Game Over',
    title: 'Round 1 Complete',
    description: 'Results are in. Check the scoreboard below.',
  },
};
