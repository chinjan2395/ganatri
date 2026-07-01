import type { Meta, StoryObj } from '@storybook/react';
import { GameTable } from './GameTable';
import type { GameTableSeatData } from './GameTable';

const meta: Meta<typeof GameTable> = {
  title: 'Game/GameTable',
  component: GameTable,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark-felt' },
  },
};
export default meta;

type Story = StoryObj<typeof GameTable>;

function mockSeat(label: string): GameTableSeatData['node'] {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#e7c34a', fontFamily: 'sans-serif', fontSize: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(10,20,14,0.85)', border: '2px solid rgba(231,195,74,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {label.slice(0, 2).toUpperCase()}
      </div>
      <span>{label}</span>
    </div>
  );
}

function seats(names: string[]): GameTableSeatData[] {
  return names.map((name, i) => ({ id: `${i}-${name}`, node: mockSeat(name) }));
}

const mockPlayArea = (
  <div style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'sans-serif', fontSize: 13 }}>Play area</div>
);

export const TwoPlayers: Story = {
  args: {
    seats: seats(['Opponent', 'You']),
    children: mockPlayArea,
  },
};

export const ThreePlayers: Story = {
  args: {
    seats: seats(['Alice', 'Bob', 'You']),
    children: mockPlayArea,
  },
};

export const FourPlayers: Story = {
  args: {
    seats: seats(['Alice', 'Bob', 'Carol', 'You']),
    children: mockPlayArea,
  },
};

export const NoPlayArea: Story = {
  args: {
    seats: seats(['Alice', 'You']),
  },
};
