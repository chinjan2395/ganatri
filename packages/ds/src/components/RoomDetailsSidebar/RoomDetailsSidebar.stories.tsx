import type { Meta, StoryObj } from '@storybook/react';
import { RoomDetailsSidebar } from './RoomDetailsSidebar';

const meta: Meta<typeof RoomDetailsSidebar> = {
  component: RoomDetailsSidebar,
  title: 'Layout/RoomDetailsSidebar',
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof RoomDetailsSidebar>;

export const Default: Story = {
  args: {
    roomCode: 'GNTRI',
    gameMode: 'Classic',
    maxPlayers: 4,
    hostName: 'Priya Patel',
  },
};

export const LongHostName: Story = {
  args: {
    roomCode: 'ABCDE',
    gameMode: 'Classic',
    maxPlayers: 4,
    hostName: 'Champaklal Gada',
  },
};

export const TwoPlayer: Story = {
  args: {
    roomCode: 'XYZQR',
    gameMode: 'Classic',
    maxPlayers: 2,
    hostName: 'Tapu Sena',
  },
};
