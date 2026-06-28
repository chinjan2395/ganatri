import type { Meta, StoryObj } from '@storybook/react';
import { DsSessionRow } from './SessionRow';

const meta: Meta<typeof DsSessionRow> = {
  component: DsSessionRow,
  title: 'Data/DsSessionRow',
};
export default meta;
type Story = StoryObj<typeof DsSessionRow>;

export const Current: Story = {
  args: {
    sessionId: 'sess-001',
    userAgent: 'Chrome 124 on macOS',
    current: true,
    createdAt: 'Jun 1, 2026',
    lastSeenAt: 'Jun 28, 2026',
    expiresAt: 'Jul 1, 2026',
    busy: false,
    onRevoke: () => {},
    onLogoutCurrent: () => {},
  },
};

export const Active: Story = {
  args: {
    sessionId: 'sess-002',
    userAgent: 'Safari on iPhone',
    current: false,
    createdAt: 'Jun 10, 2026',
    lastSeenAt: 'Jun 27, 2026',
    expiresAt: 'Jul 10, 2026',
    busy: false,
    onRevoke: (id) => alert(`Revoke ${id}`),
    onLogoutCurrent: () => {},
  },
};

export const Busy: Story = {
  args: {
    sessionId: 'sess-003',
    userAgent: 'Firefox 126 on Windows',
    current: false,
    createdAt: 'Jun 15, 2026',
    lastSeenAt: 'Jun 20, 2026',
    expiresAt: 'Jul 15, 2026',
    busy: true,
    onRevoke: () => {},
    onLogoutCurrent: () => {},
  },
};
