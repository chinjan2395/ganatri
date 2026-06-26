import type { Meta, StoryObj } from '@storybook/react';
import { RoomFriendsPanel } from './RoomFriendsPanel';

const meta: Meta<typeof RoomFriendsPanel> = {
  component: RoomFriendsPanel,
  title: 'Social/RoomFriendsPanel',
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof RoomFriendsPanel>;

const sampleFriends = [
  { initials: 'PP', name: 'Priya Patel', subtitle: '12 games together', online: true },
  { initials: 'RK', name: 'Rajan Kumar', subtitle: '8 games together', online: true },
  { initials: 'CG', name: 'Champaklal', subtitle: '3 games together', online: false },
];

export const Default: Story = {
  args: { friends: sampleFriends },
};

export const Empty: Story = {
  args: { friends: [] },
};

export const AllOnline: Story = {
  args: {
    friends: sampleFriends.map((f) => ({ ...f, online: true })),
  },
};
