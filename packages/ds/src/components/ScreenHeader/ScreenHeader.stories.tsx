import type { Meta, StoryObj } from '@storybook/react';
import { DsScreenHeader } from './ScreenHeader';
import { DsIcon } from '../Icon';

const meta: Meta<typeof DsScreenHeader> = {
  component: DsScreenHeader,
  title: 'Navigation/DsScreenHeader',
};
export default meta;
type Story = StoryObj<typeof DsScreenHeader>;

export const Default: Story = {
  args: {
    title: 'LEADERBOARD',
    onBack: () => console.log('back'),
  },
};

export const WithTrailing: Story = {
  args: {
    title: 'LEADERBOARD',
    onBack: () => console.log('back'),
    trailing: <DsIcon name="crown" size={22} aria-hidden />,
  },
};
