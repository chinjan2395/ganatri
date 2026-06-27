import type { Meta, StoryObj } from '@storybook/react';
import { CornerDecor } from './CornerDecor';

const meta: Meta<typeof CornerDecor> = {
  title: 'Room/CornerDecor',
  component: CornerDecor,
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj<typeof CornerDecor>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 260, height: 220, background: '#010603', overflow: 'hidden' }}>
        <Story />
      </div>
    ),
  ],
};

export const LargeView: Story = {
  name: 'Large (400 × 340)',
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 400, height: 340, background: '#010603', overflow: 'hidden' }}>
        <Story />
      </div>
    ),
  ],
};

export const OnFelt: Story = {
  name: 'On Felt Background',
  decorators: [
    (Story) => (
      <div style={{
        position: 'relative',
        width: 260,
        height: 220,
        background: 'radial-gradient(ellipse at 30% 70%, #1a4a2e 0%, #0d2a1a 60%, #010603 100%)',
        overflow: 'hidden',
      }}>
        <Story />
      </div>
    ),
  ],
};
