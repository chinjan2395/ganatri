import type { Meta, StoryObj } from '@storybook/react';
import { DsTitleBlock } from './TitleBlock';

const meta: Meta<typeof DsTitleBlock> = {
  component: DsTitleBlock,
  title: 'Components/TitleBlock',
};
export default meta;
type Story = StoryObj<typeof DsTitleBlock>;

export const Default: Story = {
  args: {
    title: 'LEADERBOARD',
    size: 'md',
  },
};

export const WithCrown: Story = {
  args: {
    title: 'HALL OF FAME',
    showCrown: true,
    size: 'md',
  },
};

export const WithSubtitle: Story = {
  args: {
    title: 'STATISTICS',
    subtitle: 'Season 1',
    size: 'md',
  },
};

export const Small: Story = {
  args: {
    title: 'HISTORY',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    title: 'LEADERBOARD',
    showCrown: true,
    size: 'lg',
  },
};
