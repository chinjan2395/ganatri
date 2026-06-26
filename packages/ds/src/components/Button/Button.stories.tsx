import type { Meta, StoryObj } from '@storybook/react';
import { DsButton } from './Button';

const meta: Meta<typeof DsButton> = {
  component: DsButton,
  title: 'Primitives/Button',
  argTypes: {
    tone:     { control: 'select', options: ['primary', 'secondary', 'danger', 'ghost'] },
    compact:  { control: 'boolean' },
    disabled: { control: 'boolean' },
    onClick:  { action: 'clicked' },
  },
};
export default meta;
type Story = StoryObj<typeof DsButton>;

export const Primary: Story   = { args: { label: 'Start Game',  tone: 'primary' } };
export const Secondary: Story = { args: { label: 'View Stats',  tone: 'secondary' } };
export const Danger: Story    = { args: { label: 'Leave Room',  tone: 'danger' } };
export const Ghost: Story     = { args: { label: 'How to Play', tone: 'ghost' } };
export const Compact: Story   = { args: { label: 'Invite',      tone: 'primary', compact: true } };
export const Disabled: Story  = { args: { label: 'Start',       tone: 'primary', disabled: true } };
