import type { Meta, StoryObj } from '@storybook/react';
import { DsProfileStrip } from './ProfileStrip';

const meta: Meta<typeof DsProfileStrip> = {
  component: DsProfileStrip,
  title: 'Profile/DsProfileStrip',
  argTypes: {
    displayName: { control: 'text' },
    playerId: { control: 'text' },
    avatarUrl: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof DsProfileStrip>;

export const Default: Story = {
  args: {
    displayName: 'Alice',
    playerId: 'user-1234',
  },
};

export const WithAvatar: Story = {
  args: {
    displayName: 'Bob',
    avatarUrl: 'https://i.pravatar.cc/80?img=5',
    playerId: 'user-5678',
  },
};

export const NoPlayerId: Story = {
  args: {
    displayName: 'Charlie',
  },
};

export const LongName: Story = {
  args: {
    displayName: 'VeryLongDisplayNameThatMightOverflow',
    playerId: 'user-9999',
  },
};
