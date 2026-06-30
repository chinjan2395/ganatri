import type { Meta, StoryObj } from '@storybook/react';
import { DsBodyText } from './BodyText';

const meta: Meta<typeof DsBodyText> = {
  component: DsBodyText,
  title: 'Typography/BodyText',
  argTypes: {
    tone: { control: { type: 'select' }, options: ['default', 'muted', 'error'] },
    children: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof DsBodyText>;

export const Default: Story = {
  args: { tone: 'default', children: 'This is body text in the default tone.' },
};

export const Muted: Story = {
  args: { tone: 'muted', children: 'This is muted body text, used for secondary descriptions.' },
};

export const Error: Story = {
  args: { tone: 'error', children: 'Something went wrong. Please try again.' },
};
