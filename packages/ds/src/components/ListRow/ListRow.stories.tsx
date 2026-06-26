import type { Meta, StoryObj } from '@storybook/react';
import { DsListRow } from './ListRow';

const meta: Meta<typeof DsListRow> = {
  component: DsListRow,
  title: 'Primitives/ListRow',
};
export default meta;
type Story = StoryObj<typeof DsListRow>;

export const Default: Story = {
  args: {
    title: 'Priya Patel',
    subtitle: '12 games together',
  },
};

export const WithTrailing: Story = {
  args: {
    title: 'Rajan Kumar',
    subtitle: 'Online now',
    trailing: 'Invite',
  },
};

export const LongName: Story = {
  args: {
    title: 'Champaklal Gada',
    subtitle: 'Recently played · 3 games',
  },
};
