import type { Meta, StoryObj } from '@storybook/react';
import { DsStat } from './Stat';

const meta: Meta<typeof DsStat> = {
  component: DsStat,
  title: 'Primitives/Stat',
};
export default meta;
type Story = StoryObj<typeof DsStat>;

export const Default: Story = {
  args: { label: 'Games Played', value: '42' },
};

export const WithDelta: Story = {
  args: { label: 'Win Rate', value: '68%', delta: '+4% this week' },
};

export const Large: Story = {
  args: { label: 'Total Score', value: '12,840', delta: '+320 today' },
};
