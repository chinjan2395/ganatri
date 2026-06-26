import type { Meta, StoryObj } from '@storybook/react';
import { RoomCornerDecor } from './RoomCornerDecor';

const meta: Meta<typeof RoomCornerDecor> = {
  title: 'Room/RoomCornerDecor',
  component: RoomCornerDecor,
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj<typeof RoomCornerDecor>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 260, height: 220, background: '#010603', overflow: 'hidden' }}>
        <Story />
      </div>
    ),
  ],
};
