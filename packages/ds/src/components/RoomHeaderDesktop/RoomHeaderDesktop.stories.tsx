import type { Meta, StoryObj } from '@storybook/react';
import { RoomHeaderDesktop } from './RoomHeaderDesktop';

const meta: Meta<typeof RoomHeaderDesktop> = {
  component: RoomHeaderDesktop,
  title: 'Layout/RoomHeaderDesktop',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    roomCode:         { control: 'text' },
    playerCount:      { control: { type: 'range', min: 1, max: 4 } },
    maxPlayers:       { control: { type: 'range', min: 2, max: 4 } },
    settingsDisabled: { control: 'boolean' },
    onSettings:       { action: 'settings clicked' },
    onExit:           { action: 'exit clicked' },
  },
};
export default meta;
type Story = StoryObj<typeof RoomHeaderDesktop>;

// Default state — matches the real app (settings disabled, exit wired)
export const Default: Story = {
  args: {
    roomCode: '4X7Z',
    playerCount: 3,
    maxPlayers: 4,
    settingsDisabled: true,
  },
};

// Shows how the header looks when Settings is available
export const SettingsEnabled: Story = {
  name: 'Settings — Enabled',
  args: {
    roomCode: '4X7Z',
    playerCount: 3,
    maxPlayers: 4,
    settingsDisabled: false,
  },
};

// Shows both buttons in their disabled/enabled contrast side-by-side
export const ButtonStates: Story = {
  name: 'Button States',
  args: {
    roomCode: 'DEMO',
    playerCount: 2,
    maxPlayers: 4,
    settingsDisabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Settings button is disabled (greyed, gold border). Exit Room button is always active (red border).',
      },
    },
  },
};

export const FullRoom: Story = {
  name: 'Full Room',
  args: {
    roomCode: 'GNTRI',
    playerCount: 4,
    maxPlayers: 4,
    settingsDisabled: true,
  },
};
