import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { DsStatCard } from './StatCard';

function GamesIcon(): ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z" />
    </svg>
  );
}

function StreakIcon(): ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z" />
    </svg>
  );
}

const meta: Meta<typeof DsStatCard> = {
  component: DsStatCard,
  title: 'Data/DsStatCard',
  argTypes: {
    label: { control: 'text' },
    value: { control: 'text' },
    accent: { control: 'boolean' },
    animationDelay: { control: 'number' },
  },
};
export default meta;
type Story = StoryObj<typeof DsStatCard>;

export const Default: Story = {
  args: {
    label: 'Games Played',
    value: 42,
    icon: <GamesIcon />,
  },
};

export const Accent: Story = {
  args: {
    label: 'Current Streak',
    value: '7',
    icon: <StreakIcon />,
    accent: true,
  },
};

export const WithDelay: Story = {
  args: {
    label: 'Win Rate',
    value: '64%',
    icon: <GamesIcon />,
    animationDelay: 0.15,
  },
};
