import type { Meta, StoryObj } from '@storybook/react';
import { DsSectionHeading } from './SectionHeading';

const meta: Meta<typeof DsSectionHeading> = {
  component: DsSectionHeading,
  title: 'Typography/SectionHeading',
  argTypes: {
    level: { control: { type: 'select' }, options: [2, 3, 4] },
    children: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof DsSectionHeading>;

export const Default: Story = {
  args: { level: 2, children: 'Section Heading' },
};

export const SubHeading: Story = {
  args: { level: 3, children: 'Sub Heading' },
};

export const MinorHeading: Story = {
  args: { level: 4, children: 'Minor Heading' },
};
