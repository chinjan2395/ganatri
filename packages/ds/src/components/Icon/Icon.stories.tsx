import type { Meta, StoryObj } from '@storybook/react';
import { DsIcon } from './Icon';
import type { DsIconName } from './Icon';

const meta: Meta<typeof DsIcon> = {
  component: DsIcon,
  title: 'Primitives/Icon',
  argTypes: {
    name: {
      control: 'select',
      options: [
        'home', 'history', 'stats', 'leaderboard', 'trophy',
        'profile', 'back', 'crown', 'medal', 'flourish',
        'bell', 'gear', 'gift', 'people', 'person',
        'share', 'plus', 'copy', 'mic', 'mic-off',
        'speaker', 'settings', 'exit', 'close', 'check',
      ] satisfies DsIconName[],
    },
    size: { control: 'number' },
    rank: { control: 'number' },
  },
};
export default meta;
type Story = StoryObj<typeof DsIcon>;

export const Home: Story = { args: { name: 'home' } };
export const History: Story = { args: { name: 'history' } };
export const Stats: Story = { args: { name: 'stats' } };
export const Leaderboard: Story = { args: { name: 'leaderboard' } };
export const Back: Story = { args: { name: 'back' } };
export const Crown: Story = { args: { name: 'crown' } };
export const Flourish: Story = { args: { name: 'flourish', size: 48 } };
export const MedalGold: Story = { args: { name: 'medal', rank: 1 } };
export const MedalSilver: Story = { args: { name: 'medal', rank: 2 } };
export const MedalBronze: Story = { args: { name: 'medal', rank: 3 } };
export const MedalOther: Story = { args: { name: 'medal', rank: 5 } };
export const Bell: Story = { args: { name: 'bell' } };
export const Gear: Story = { args: { name: 'gear' } };
export const Gift: Story = { args: { name: 'gift' } };
export const People: Story = { args: { name: 'people' } };
export const Share: Story = { args: { name: 'share' } };
export const Plus: Story = { args: { name: 'plus' } };
export const Copy: Story = { args: { name: 'copy' } };
export const Mic: Story = { args: { name: 'mic' } };
export const MicOff: Story = { args: { name: 'mic-off' } };
export const Speaker: Story = { args: { name: 'speaker' } };
export const Exit: Story = { args: { name: 'exit' } };
export const Close: Story = { args: { name: 'close' } };
export const Check: Story = { args: { name: 'check' } };
export const Large: Story = { args: { name: 'home', size: 48 } };
