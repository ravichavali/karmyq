// Flat config (ESLint 9). Replaces .eslintrc.js.
const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  js.configs.recommended,
  // Registers the plugin and the TS parser, and turns off the base rules that TypeScript
  // already covers (no-undef, no-unused-vars) — which is why this config needs neither a
  // manual parser binding nor the `globals` package. Deliberately the non-type-checked
  // variant: no rule enabled here needs type information, so `parserOptions.project` would
  // only slow linting down.
  ...tsPlugin.configs['flat/recommended'],
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
];
