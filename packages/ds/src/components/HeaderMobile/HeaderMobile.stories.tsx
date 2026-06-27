import type { Meta, StoryObj } from '@storybook/react';
import { HeaderMobile } from './HeaderMobile';

const meta: Meta<typeof HeaderMobile> = {
  component: HeaderMobile,
  title: 'Layout/HeaderMobile',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof HeaderMobile>;

export const Default: Story = {
  args: { roomCode: 'GNTRI', menuOpen: false },
};

export const MenuOpen: Story = {
  args: {
    roomCode: 'GNTRI',
    menuOpen: true,
    isHost: true,
    canStart: true,
  },
};

export const MenuOpenNonHost: Story = {
  args: {
    roomCode: 'GNTRI',
    menuOpen: true,
    isHost: false,
    canStart: false,
  },
};

export const ShortCode: Story = {
  args: { roomCode: 'ABCDE', menuOpen: false },
};

export const LongCode: Story = {
  args: { roomCode: 'XYZQRS', menuOpen: false },
};
