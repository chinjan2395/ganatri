import type { Meta, StoryObj } from '@storybook/react';
import { RoomOvalTable } from './RoomOvalTable';
import type { SeatData } from '../RoomSeatSlot';

const meta: Meta<typeof RoomOvalTable> = {
  title: 'Room/RoomOvalTable',
  component: RoomOvalTable,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark-felt' },
  },
};
export default meta;

type Story = StoryObj<typeof RoomOvalTable>;

const emptySeat: SeatData = {
  initials: '',
  name: '',
  isYou: false,
  isHost: false,
  isSpeaking: false,
  avatarUrl: null,
  isEmpty: true,
};

export const FourPlayers: Story = {
  args: {
    seats: [
      { initials: 'AB', name: 'Alice', isYou: false, isHost: true, isSpeaking: false, avatarUrl: null, isEmpty: false },
      { initials: 'BC', name: 'Bob', isYou: false, isHost: false, isSpeaking: false, avatarUrl: null, isEmpty: false },
      { initials: 'CD', name: 'Carol', isYou: false, isHost: false, isSpeaking: true, avatarUrl: null, isEmpty: false },
      { initials: 'DE', name: 'Dave', isYou: false, isHost: false, isSpeaking: false, avatarUrl: null, isEmpty: false },
    ],
  },
};

export const TwoPlayers: Story = {
  args: {
    seats: [
      { initials: 'AB', name: 'Alice', isYou: false, isHost: true, isSpeaking: false, avatarUrl: null, isEmpty: false },
      emptySeat,
      { initials: 'CD', name: 'Carol', isYou: false, isHost: false, isSpeaking: false, avatarUrl: null, isEmpty: false },
      emptySeat,
    ],
  },
};

export const Empty: Story = {
  args: {
    seats: [emptySeat, emptySeat, emptySeat, emptySeat],
  },
};

export const WithYou: Story = {
  args: {
    seats: [
      { initials: 'ME', name: 'You', isYou: true, isHost: false, isSpeaking: false, avatarUrl: null, isEmpty: false },
      { initials: 'BC', name: 'Bob', isYou: false, isHost: true, isSpeaking: false, avatarUrl: null, isEmpty: false },
      emptySeat,
      emptySeat,
    ],
  },
};
