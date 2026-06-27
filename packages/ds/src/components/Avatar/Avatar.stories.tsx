import type { Meta, StoryObj } from '@storybook/react';
import { DsAvatar } from './Avatar';

const meta: Meta<typeof DsAvatar> = {
  component: DsAvatar,
  title: 'Primitives/Avatar',
  argTypes: {
    size: { control: 'number' },
    src: { control: 'text' },
    displayName: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof DsAvatar>;

export const Initials: Story = {
  args: { displayName: 'Alice', size: 40 },
};

export const WithImage: Story = {
  args: {
    displayName: 'Bob',
    src: 'https://i.pravatar.cc/80',
    size: 40,
  },
};

export const NullSrc: Story = {
  args: { displayName: 'Charlie', src: null, size: 40 },
};

export const Large: Story = {
  args: { displayName: 'Diana', size: 72 },
};

export const Small: Story = {
  args: { displayName: 'Eve', size: 28 },
};
