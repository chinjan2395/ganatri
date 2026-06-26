import type { Meta, StoryObj } from '@storybook/react';
import { Alert } from './Alert';

const meta: Meta<typeof Alert> = {
  component: Alert,
  title: 'Feedback/Alert',
  argTypes: {
    tone: { control: 'select', options: ['default', 'success', 'warning', 'danger', 'info'] },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Success: Story = {
  args: { tone: 'success', title: 'Game saved', description: 'Your progress has been recorded.' },
};

export const Warning: Story = {
  args: { tone: 'warning', title: 'Low time', description: 'You have 10 seconds to make your move.' },
};

export const Danger: Story = {
  args: { tone: 'danger', title: 'Player disconnected', description: 'Rahul has left the game. Waiting 60 s for reconnect.' },
};

export const Info: Story = {
  args: { tone: 'info', title: "It's your turn", description: 'Select a card from your hand to play.' },
};

export const Default: Story = {
  args: { tone: 'default', title: 'Room created', description: 'Share the code XK7P2Q with friends to invite them.' },
};
