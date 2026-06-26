import type { Meta, StoryObj } from '@storybook/react';
import { Field } from './Field';

const meta: Meta<typeof Field> = {
  component: Field,
  title: 'Primitives/Field',
};

export default meta;
type Story = StoryObj<typeof Field>;

export const WithValue: Story = {
  args: { label: 'Room Code', value: 'XK7P2Q' },
};

export const WithPlaceholder: Story = {
  args: { label: 'Your Name', placeholder: 'Enter display name…' },
};

export const WithHelper: Story = {
  args: { label: 'Entry Fee', value: '₹50', helper: 'Minimum bet to join this room.' },
};
