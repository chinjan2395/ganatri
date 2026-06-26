import type { Meta, StoryObj } from '@storybook/react';
import { DsTabs } from './Tabs';

const meta: Meta<typeof DsTabs> = {
  component: DsTabs,
  title: 'Navigation/Tabs',
};
export default meta;
type Story = StoryObj<typeof DsTabs>;

export const FirstActive: Story = {
  args: {
    items: ['Overview', 'Components', 'Tokens'],
    active: 'Overview',
  },
};

export const SecondActive: Story = {
  args: {
    items: ['Activity', 'Chat'],
    active: 'Chat',
  },
};

export const GamePhases: Story = {
  args: {
    items: ['Part 1', 'Part 2', 'Results'],
    active: 'Part 1',
  },
};
