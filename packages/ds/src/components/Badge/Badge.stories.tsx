import type { Meta, StoryObj } from '@storybook/react';
import { DsBadge } from './Badge';

const meta: Meta<typeof DsBadge> = {
  component: DsBadge,
  title: 'Primitives/Badge',
};
export default meta;
type Story = StoryObj<typeof DsBadge>;

export const Default: Story = {
  args: { label: 'Classic', tone: 'default' },
};

export const Success: Story = {
  args: { label: 'Ready', tone: 'success' },
};

export const Warning: Story = {
  args: { label: 'Waiting', tone: 'warning' },
};

export const Danger: Story = {
  args: { label: 'Disconnected', tone: 'danger' },
};

export const Info: Story = {
  args: { label: '4 Players', tone: 'info' },
};
