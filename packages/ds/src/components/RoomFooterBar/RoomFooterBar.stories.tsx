import type { Meta, StoryObj } from '@storybook/react';
import { RoomFooterBar } from './RoomFooterBar';

const meta: Meta<typeof RoomFooterBar> = {
  title: 'Room/RoomFooterBar',
  component: RoomFooterBar,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark-felt' },
  },
};
export default meta;

type Story = StoryObj<typeof RoomFooterBar>;

export const Default: Story = {};

export const CustomTagline: Story = {
  args: {
    tagline: 'The ultimate card game experience.',
  },
};
