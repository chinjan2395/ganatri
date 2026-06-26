import type { Meta, StoryObj } from '@storybook/react';
import { Tabs } from './Tabs';

const meta: Meta<typeof Tabs> = {
  component: Tabs,
  title: 'Navigation/Tabs',
  argTypes: {
    active: { control: 'select', options: ['Activity', 'Chat', 'Players'] },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const TwoTabs: Story = {
  args: { items: ['Activity', 'Chat'], active: 'Activity' },
};

export const ThreeTabs: Story = {
  args: { items: ['All Time', 'This Week', 'This Month'], active: 'This Week' },
};

export const FourTabs: Story = {
  args: { items: ['Overview', 'Players', 'Settings', 'Logs'], active: 'Players' },
};
