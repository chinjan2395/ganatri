import type { Meta, StoryObj } from '@storybook/react';
import { RoomStatusPanel } from './RoomStatusPanel';

const meta: Meta<typeof RoomStatusPanel> = {
  title: 'Room/RoomStatusPanel',
  component: RoomStatusPanel,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320, padding: 16, background: 'rgba(10,21,14,0.9)', border: '1px solid rgba(198,160,63,0.34)', borderRadius: 10 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof RoomStatusPanel>;

export const Waiting: Story = {
  args: {
    playerCount: 1,
    maxPlayers: 4,
    elapsedSeconds: 10,
  },
};

export const Ready: Story = {
  args: {
    playerCount: 2,
    maxPlayers: 4,
    elapsedSeconds: 65,
  },
};

export const Full: Story = {
  args: {
    playerCount: 4,
    maxPlayers: 4,
    elapsedSeconds: 302,
  },
};
