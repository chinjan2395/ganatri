import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Primitives/Button',
  argTypes: {
    tone:     { control: 'select', options: ['primary', 'secondary', 'danger', 'ghost'] },
    compact:  { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story   = { args: { label: 'Start Game',  tone: 'primary' } };
export const Secondary: Story = { args: { label: 'Copy Code',   tone: 'secondary' } };
export const Danger: Story    = { args: { label: 'Leave Room',  tone: 'danger' } };
export const Ghost: Story     = { args: { label: 'Settings',    tone: 'ghost' } };
export const Compact: Story   = { args: { label: 'Invite',      tone: 'primary', compact: true } };
export const Disabled: Story  = { args: { label: 'Start',       tone: 'primary', disabled: true } };
