import type { Meta, StoryObj } from '@storybook/react';
import { FooterBar } from './FooterBar';

const meta: Meta<typeof FooterBar> = {
  title: 'Room/FooterBar',
  component: FooterBar,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'dark-felt' },
  },
};
export default meta;

type Story = StoryObj<typeof FooterBar>;

export const Default: Story = {};

export const CustomTagline: Story = {
  args: {
    tagline: 'The ultimate card game experience.',
  },
};

export const LongTagline: Story = {
  name: 'Long Tagline (overflow check)',
  args: {
    tagline: 'Strategy. Precision. Victory. The only card game that rewards both skill and cunning.',
  },
};
