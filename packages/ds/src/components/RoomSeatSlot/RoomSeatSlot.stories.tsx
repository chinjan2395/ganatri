import type { Meta, StoryObj } from '@storybook/react';
import { RoomSeatSlot } from './RoomSeatSlot';

const meta: Meta<typeof RoomSeatSlot> = {
  title: 'Room/RoomSeatSlot',
  component: RoomSeatSlot,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 120, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof RoomSeatSlot>;

export const Empty: Story = {
  args: {
    seat: {
      initials: '',
      name: '',
      isYou: false,
      isHost: false,
      isSpeaking: false,
      avatarUrl: null,
      isEmpty: true,
    },
    seatIndex: 0,
  },
};

export const Occupied: Story = {
  args: {
    seat: {
      initials: 'AB',
      name: 'AliceBob',
      isYou: false,
      isHost: false,
      isSpeaking: false,
      avatarUrl: null,
      isEmpty: false,
    },
    seatIndex: 0,
  },
};

export const IsYou: Story = {
  args: {
    seat: {
      initials: 'ME',
      name: 'You',
      isYou: true,
      isHost: false,
      isSpeaking: false,
      avatarUrl: null,
      isEmpty: false,
    },
    seatIndex: 2,
  },
};

export const IsHost: Story = {
  args: {
    seat: {
      initials: 'HP',
      name: 'HostPlayer',
      isYou: false,
      isHost: true,
      isSpeaking: false,
      avatarUrl: null,
      isEmpty: false,
    },
    seatIndex: 1,
  },
};

export const IsSpeaking: Story = {
  args: {
    seat: {
      initials: 'SP',
      name: 'Speaker',
      isYou: false,
      isHost: false,
      isSpeaking: true,
      avatarUrl: null,
      isEmpty: false,
    },
    seatIndex: 3,
  },
};
