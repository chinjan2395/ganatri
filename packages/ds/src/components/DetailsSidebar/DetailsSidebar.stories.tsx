import type { Meta, StoryObj } from '@storybook/react';
import { DetailsSidebar } from './DetailsSidebar';

const meta: Meta<typeof DetailsSidebar> = {
  component: DetailsSidebar,
  title: 'Layout/DetailsSidebar',
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof DetailsSidebar>;

export const Default: Story = {
  args: {
    roomCode: 'GNTRI',
    gameMode: 'Classic',
    maxPlayers: 4,
    hostName: 'Priya Patel',
    voiceEnabled: true,
    copied: false,
  },
};

export const Copied: Story = {
  args: {
    roomCode: 'GNTRI',
    gameMode: 'Classic',
    maxPlayers: 4,
    hostName: 'Priya Patel',
    voiceEnabled: true,
    copied: true,
  },
};

export const VoiceDisabled: Story = {
  args: {
    roomCode: 'GNTRI',
    gameMode: 'Classic',
    maxPlayers: 4,
    hostName: 'Priya Patel',
    voiceEnabled: false,
    copied: false,
  },
};

export const WithHostAvatar: Story = {
  args: {
    roomCode: 'GNTRI',
    gameMode: 'Classic',
    maxPlayers: 4,
    hostName: 'Priya Patel',
    hostAvatarUrl: 'https://i.pravatar.cc/40?img=1',
    voiceEnabled: true,
    copied: false,
  },
};

export const LongHostName: Story = {
  args: {
    roomCode: 'ABCDE',
    gameMode: 'Classic',
    maxPlayers: 4,
    hostName: 'Champaklal Gada',
    voiceEnabled: true,
    copied: false,
  },
};

export const TwoPlayer: Story = {
  args: {
    roomCode: 'XYZQR',
    gameMode: 'Classic',
    maxPlayers: 2,
    hostName: 'Tapu Sena',
    voiceEnabled: false,
    copied: false,
  },
};
