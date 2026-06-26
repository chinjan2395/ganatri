import type { Meta, StoryObj } from '@storybook/react';
import { DsSection } from './Section';

const meta: Meta<typeof DsSection> = {
  component: DsSection,
  title: 'Layout/Section',
};
export default meta;
type Story = StoryObj<typeof DsSection>;

export const Default: Story = {
  args: {
    title: 'Colour Palette',
    description: 'Core brand colours used across the interface.',
    children: 'Section content goes here.',
  },
};

export const Typography: Story = {
  args: {
    title: 'Type Scale',
    description: 'Font sizes and weights for consistent typographic hierarchy.',
    children: 'Typography samples go here.',
  },
};

export const Components: Story = {
  args: {
    title: 'Interactive Components',
    description: 'Buttons, badges, and other interactive elements.',
    children: 'Component samples go here.',
  },
};
