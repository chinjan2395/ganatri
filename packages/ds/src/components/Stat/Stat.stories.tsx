import type { Meta, StoryObj } from '@storybook/react';
import { Stat } from './Stat';

const meta: Meta<typeof Stat> = {
  component: Stat,
  title: 'Primitives/Stat',
};

export default meta;
type Story = StoryObj<typeof Stat>;

export const Default: Story = {
  args: { label: 'Games Won', value: '42' },
};

export const WithDelta: Story = {
  args: { label: 'Win Rate', value: '68%', delta: '+4% this week' },
};

export const LargeNumber: Story = {
  args: { label: 'Cards Captured', value: '1,284' },
};

export const RankedRating: Story = {
  args: { label: 'Rated', value: '1,240', delta: '+20 last match' },
};
