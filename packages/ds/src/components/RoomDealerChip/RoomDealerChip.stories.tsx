import type { Meta, StoryObj } from '@storybook/react';
import { RoomDealerChip } from './RoomDealerChip';

const meta: Meta<typeof RoomDealerChip> = {
  title: 'Room/RoomDealerChip',
  component: RoomDealerChip,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

type Story = StoryObj<typeof RoomDealerChip>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 60, height: 60 }}>
        <Story />
      </div>
    ),
  ],
};
