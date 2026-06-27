import type { Meta, StoryObj } from '@storybook/react';
import { PipRow } from './PipRow';

const meta: Meta<typeof PipRow> = {
  title: 'Room/PipRow',
  component: PipRow,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

type Story = StoryObj<typeof PipRow>;

export const OneOfFour: Story = {
  args: { filled: 1, max: 4 },
};

export const ThreeOfFour: Story = {
  args: { filled: 3, max: 4 },
};

export const Full: Story = {
  args: { filled: 4, max: 4 },
};

export const Empty: Story = {
  args: { filled: 0, max: 4 },
};
