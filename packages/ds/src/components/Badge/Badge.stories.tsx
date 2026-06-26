import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  component: Badge,
  title: 'Primitives/Badge',
  argTypes: {
    tone: { control: 'select', options: ['default', 'success', 'warning', 'danger', 'info'] },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = { args: { label: 'Lobby', tone: 'default' } };
export const Success: Story = { args: { label: 'Online', tone: 'success' } };
export const Warning: Story = { args: { label: 'Pending', tone: 'warning' } };
export const Danger: Story  = { args: { label: 'Offline', tone: 'danger' } };
export const Info: Story    = { args: { label: '4 Players', tone: 'info' } };
