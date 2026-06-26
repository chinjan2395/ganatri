import type { Meta, StoryObj } from '@storybook/react';
import { ListRow } from './ListRow';

const meta: Meta<typeof ListRow> = {
  component: ListRow,
  title: 'Primitives/ListRow',
};

export default meta;
type Story = StoryObj<typeof ListRow>;

export const Default: Story = {
  args: { title: 'Rahul Sharma', subtitle: '14 games together' },
};

export const WithTrailing: Story = {
  args: {
    title: 'Ananya Patel',
    subtitle: '6 games together · Online',
    trailing: 'Invite',
  },
};

export const LongSubtitle: Story = {
  args: {
    title: 'Priya Nair',
    subtitle: 'Last played 2 days ago · 22 games · Win rate 68%',
  },
};
