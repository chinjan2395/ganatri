import type { Meta, StoryObj } from '@storybook/react';
import { RoomHeaderMobile } from './RoomHeaderMobile';

const meta: Meta<typeof RoomHeaderMobile> = {
  component: RoomHeaderMobile,
  title: 'Layout/RoomHeaderMobile',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof RoomHeaderMobile>;

export const Default: Story = {
  args: { roomCode: 'GNTRI' },
};

export const ShortCode: Story = {
  args: { roomCode: 'ABCDE' },
};

export const LongCode: Story = {
  args: { roomCode: 'XYZQRS' },
};
