import type { Meta, StoryObj } from '@storybook/react';
import { VoiceChatPanel } from './VoiceChatPanel';
import type { VoiceParticipant } from './VoiceChatPanel';

const meta: Meta<typeof VoiceChatPanel> = {
  title: 'Room/VoiceChatPanel',
  component: VoiceChatPanel,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark-felt' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof VoiceChatPanel>;

const alice: VoiceParticipant = {
  initials: 'AL',
  name: 'Alice',
  isSelf: true,
  isSpeaking: false,
  isMuted: false,
  avatarUrl: null,
};

const bob: VoiceParticipant = {
  initials: 'BO',
  name: 'Bob',
  isSelf: false,
  isSpeaking: true,
  isMuted: false,
  avatarUrl: null,
};

const carol: VoiceParticipant = {
  initials: 'CA',
  name: 'Carol',
  isSelf: false,
  isSpeaking: false,
  isMuted: true,
  avatarUrl: null,
};

export const OpenMic: Story = {
  args: {
    participants: [alice, bob, carol],
    maxSlots: 4,
    mode: 'open',
    muted: false,
    deafened: false,
  },
};

export const PushToTalk: Story = {
  args: {
    participants: [alice, bob],
    maxSlots: 4,
    mode: 'ptt',
    muted: false,
    deafened: false,
  },
};

export const Muted: Story = {
  args: {
    participants: [{ ...alice, isMuted: true }],
    maxSlots: 4,
    mode: 'open',
    muted: true,
    deafened: false,
  },
};

export const Deafened: Story = {
  args: {
    participants: [alice],
    maxSlots: 4,
    mode: 'open',
    muted: false,
    deafened: true,
  },
};
