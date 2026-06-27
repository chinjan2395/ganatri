import type { Meta, StoryObj } from '@storybook/react';
import { DsSpinner } from './Spinner';

const meta: Meta<typeof DsSpinner> = {
  component: DsSpinner,
  title: 'Primitives/Spinner',
  argTypes: {
    size: { control: 'number' },
  },
};
export default meta;
type Story = StoryObj<typeof DsSpinner>;

export const Default: Story = { args: { size: 32 } };
export const Small: Story = { args: { size: 20 } };
export const Large: Story = { args: { size: 56 } };
