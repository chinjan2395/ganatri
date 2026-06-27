import type { Meta, StoryObj } from '@storybook/react';
import { FeltBackdrop } from './FeltBackdrop';

const meta: Meta<typeof FeltBackdrop> = {
  title: 'Room/FeltBackdrop',
  component: FeltBackdrop,
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj<typeof FeltBackdrop>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
};

export const Tablet: Story = {
  name: 'Tablet (768 × 1024)',
  parameters: { viewport: { defaultViewport: 'tablet' } },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 768, height: 1024 }}>
        <Story />
      </div>
    ),
  ],
};

export const Cropped: Story = {
  name: 'Cropped (centre crest visible)',
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 480, height: 480, overflow: 'hidden' }}>
        <Story />
      </div>
    ),
  ],
};
