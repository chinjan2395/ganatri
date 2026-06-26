import type { Meta, StoryObj } from '@storybook/react';
import { DsField } from './Field';

const meta: Meta<typeof DsField> = {
  component: DsField,
  title: 'Primitives/Field',
};
export default meta;
type Story = StoryObj<typeof DsField>;

export const WithValue: Story = {
  args: {
    label: 'Room Code',
    value: 'GNTRI',
  },
};

export const WithPlaceholder: Story = {
  args: {
    label: 'Display Name',
    placeholder: 'Enter your name...',
  },
};

export const WithHelper: Story = {
  args: {
    label: 'Invite Code',
    placeholder: 'XXXXX',
    helper: 'Ask the host for the 5-letter code.',
  },
};
