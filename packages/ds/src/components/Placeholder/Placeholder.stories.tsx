import type { Meta, StoryObj } from '@storybook/react';
import { DsPlaceholder } from './Placeholder';

const meta: Meta<typeof DsPlaceholder> = {
  component: DsPlaceholder,
  title: 'Data/DsPlaceholder',
  argTypes: {
    variant: {
      control: 'select',
      options: ['performance', 'cards', 'modes', 'achievements'],
    },
    title: { control: 'text' },
    dropdownLabel: { control: 'text' },
    linkLabel: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof DsPlaceholder>;

export const Performance: Story = {
  args: {
    variant: 'performance',
    title: 'Performance Over Time',
    dropdownLabel: 'Last 7 Days ▾',
  },
};

export const Cards: Story = {
  args: {
    variant: 'cards',
    title: 'Favorite Cards',
  },
};

export const Modes: Story = {
  args: {
    variant: 'modes',
    title: 'Game Modes Played',
  },
};

export const Achievements: Story = {
  args: {
    variant: 'achievements',
    title: 'Achievements',
    linkLabel: 'View All Achievements',
  },
};
