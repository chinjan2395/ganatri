import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Screens must not cross-import each other's components.
    // App.tsx is excluded — it's the router and legitimately imports all screens.
    files: ['src/screens/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../screens/*', './screens/*'],
            message: 'Cross-importing between screens is forbidden. Move shared components to @ganatri/ds.',
          },
          {
            group: ['../design-system/DesignSystemPrimitives', './design-system/DesignSystemPrimitives'],
            message: 'DesignSystemPrimitives.tsx has been deleted. Import from @ganatri/ds instead.',
          },
        ],
      }],
    },
  },
  {
    // Ban raw <button> and <input> in player-facing screen files.
    // AdminScreen and DesignSystemScreen are explicitly excluded.
    files: ['src/screens/**/*.{ts,tsx}'],
    ignores: [
      'src/screens/AdminScreen.tsx',
      'src/screens/DesignSystemScreen.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: 'Use DsButton from @ganatri/ds instead of a raw <button> in screen files.',
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message: 'Use DsField from @ganatri/ds instead of a raw <input> in screen files.',
        },
      ],
    },
  },
);
