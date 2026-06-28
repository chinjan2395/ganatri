import type { Meta, StoryObj } from '@storybook/react';
import { DsSummaryBar } from './SummaryBar';

const meta: Meta<typeof DsSummaryBar> = {
  component: DsSummaryBar,
  title: 'Data/DsSummaryBar',
  argTypes: {
    total: { control: 'number' },
    wins: { control: 'number' },
    winRate: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof DsSummaryBar>;

export const Default: Story = {
  args: {
    total: 12,
    wins: 8,
    winRate: '67%',
  },
};

export const AllLoss: Story = {
  args: {
    total: 10,
    wins: 0,
    winRate: '0%',
  },
};

export const PerfectRecord: Story = {
  args: {
    total: 6,
    wins: 6,
    winRate: '100%',
  },
};
