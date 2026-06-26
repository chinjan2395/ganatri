import type { Meta, StoryObj } from '@storybook/react';
import { RoomActivityPanel } from './RoomActivityPanel';

const meta: Meta<typeof RoomActivityPanel> = {
  component: RoomActivityPanel,
  title: 'Feedback/RoomActivityPanel',
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof RoomActivityPanel>;

const sampleEntries = [
  { time: '10:42', text: 'You joined the room' },
  { time: '10:43', text: 'Priya joined the room' },
  { time: '10:44', text: 'Rajan joined the room' },
];

export const ActivityTab: Story = {
  args: {
    entries: sampleEntries,
    activeTab: 'activity',
  },
};

export const ChatTab: Story = {
  args: {
    entries: sampleEntries,
    activeTab: 'chat',
  },
};

export const EmptyActivity: Story = {
  args: {
    entries: [],
    activeTab: 'activity',
  },
};
