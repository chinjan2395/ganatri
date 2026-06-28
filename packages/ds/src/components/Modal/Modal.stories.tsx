import type { Meta, StoryObj } from '@storybook/react';
import { DsModal } from './Modal';
import { DsButton } from '../Button';

const meta: Meta<typeof DsModal> = {
  component: DsModal,
  title: 'Components/Modal',
};
export default meta;
type Story = StoryObj<typeof DsModal>;

export const Default: Story = {
  args: {
    title: 'Example Modal',
    onClose: () => undefined,
    children: (
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat.
      </p>
    ),
  },
};

export const WithFooter: Story = {
  args: {
    title: 'Information',
    onClose: () => undefined,
    children: (
      <p>
        This modal includes an optional footer slot where you can place action
        buttons or supplementary content.
      </p>
    ),
    footer: <DsButton label="Got it" tone="primary" />,
  },
};

export const NarrowContent: Story = {
  args: {
    title: 'Narrow Modal',
    onClose: () => undefined,
    maxWidth: '380px',
    children: (
      <p>
        This modal uses a narrower max-width override of 380px, useful for
        short confirmations or simple prompts.
      </p>
    ),
  },
};
