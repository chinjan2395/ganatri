import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  component: Card,
  title: 'Layout/Card',
  argTypes: {
    tone: { control: 'select', options: ['default', 'success', 'warning', 'danger', 'info'] },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    title: 'Room Details',
    subtitle: 'Current game configuration',
    children: 'Card body content goes here.',
  },
};

export const WithoutHeader: Story = {
  args: { children: 'A card with no title or subtitle.' },
};

export const SuccessTone: Story = {
  args: { title: 'Game Won', tone: 'success', children: 'You captured 28 cards.' },
};

export const DangerTone: Story = {
  args: { title: 'Player Disconnected', tone: 'danger', children: 'Waiting for reconnect...' },
};
