import type { Meta, StoryObj } from '@storybook/react';
import { PageHeader } from './PageHeader';

const meta: Meta<typeof PageHeader> = {
  component: PageHeader,
  title: 'Layout/PageHeader',
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    eyebrow: 'Design System',
    title: 'Ganatri UI',
    description: 'Component library for the Ganatri card game. All primitives authored and tested here.',
  },
};

export const WithActions: Story = {
  args: {
    eyebrow: 'Admin',
    title: 'Control Center',
    description: 'Manage rooms, players, and server configuration.',
    actions: 'Action buttons here',
  },
};

export const ShortTitle: Story = {
  args: {
    eyebrow: 'Phase 9',
    title: 'Scoring',
    description: 'Match Score, Ranked Rating, and XP progression.',
  },
};
