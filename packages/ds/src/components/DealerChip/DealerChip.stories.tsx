import type { Meta, StoryObj } from '@storybook/react';
import { DealerChip } from './DealerChip';

const meta: Meta<typeof DealerChip> = {
  title: 'Room/DealerChip',
  component: DealerChip,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

type Story = StoryObj<typeof DealerChip>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 60, height: 60 }}>
        <Story />
      </div>
    ),
  ],
};

export const OnFelt: Story = {
  name: 'On Felt Background',
  parameters: { backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div style={{
        position: 'relative',
        width: 120,
        height: 120,
        background: 'radial-gradient(ellipse, #1a4a2e 0%, #0d2a1a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
      }}>
        <Story />
      </div>
    ),
  ],
};

export const AtSeatEdge: Story = {
  name: 'At Seat Edge (positioned)',
  decorators: [
    (Story) => (
      <div style={{
        position: 'relative',
        width: 160,
        height: 100,
        background: '#0d2a1a',
        borderRadius: 8,
        border: '2px solid rgba(255,215,0,0.2)',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, padding: 8, display: 'block' }}>Seat slot</span>
        <div style={{ position: 'absolute', bottom: -12, right: -12 }}>
          <Story />
        </div>
      </div>
    ),
  ],
};
