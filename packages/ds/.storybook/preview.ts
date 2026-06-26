import '../src/globals.css';
import '../src/tokens/index.css';

import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark-felt',
      values: [
        { name: 'dark-felt', value: '#010603' },
        { name: 'panel',     value: '#0a1a10' },
        { name: 'white',     value: '#ffffff' },
      ],
    },
  },
};

export default preview;
