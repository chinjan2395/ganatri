import type { Meta, StoryObj } from '@storybook/react';
import { DsPlayTimeBar } from './PlayTimeBar';

const meta: Meta<typeof DsPlayTimeBar> = {
  component: DsPlayTimeBar,
  title: 'Data/DsPlayTimeBar',
  argTypes: {
    ms: { control: 'number' },
  },
};
export default meta;
type Story = StoryObj<typeof DsPlayTimeBar>;

export const Default: Story = {
  args: {
    ms: 42 * 60 * 1000,
  },
};

export const LongSession: Story = {
  args: {
    ms: (3 * 3600 + 14 * 60) * 1000,
  },
};

export const Empty: Story = {
  args: {
    ms: 0,
  },
};
