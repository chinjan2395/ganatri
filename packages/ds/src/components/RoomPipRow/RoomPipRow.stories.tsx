import type { Meta, StoryObj } from '@storybook/react';
import { RoomPipRow } from './RoomPipRow';

const meta: Meta<typeof RoomPipRow> = {
  title: 'Room/RoomPipRow',
  component: RoomPipRow,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

type Story = StoryObj<typeof RoomPipRow>;

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
