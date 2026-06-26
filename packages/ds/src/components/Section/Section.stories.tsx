import type { Meta, StoryObj } from '@storybook/react';
import { Section } from './Section';

const meta: Meta<typeof Section> = {
  component: Section,
  title: 'Layout/Section',
};

export default meta;
type Story = StoryObj<typeof Section>;

export const Default: Story = {
  args: {
    title: 'Buttons',
    description: 'Primary interaction surfaces. Use primary for the main CTA, secondary for supporting actions.',
    children: 'Section content goes here.',
  },
};

export const WithMultipleChildren: Story = {
  args: {
    title: 'Colour Palette',
    description: 'Casino-grade dark green felt with gold accents and status colours.',
    children: 'Swatches here.',
  },
};

export const LongDescription: Story = {
  args: {
    title: 'Typography',
    description: 'Cinzel for headings and brand moments. Inter for body copy, labels, and UI text. Both loaded via Google Fonts in the web app entry CSS.',
    children: 'Type specimens here.',
  },
};
