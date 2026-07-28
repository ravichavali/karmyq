// Flat config (ESLint 9). Replaces .eslintrc.json + `next lint`, which Next 16 removes.
// Scope is deliberately `src` (see package.json "lint") to match what `next lint` linted;
// a bare `eslint .` would sweep .next/ build output and report ~180 extra findings.
const coreWebVitals = require('eslint-config-next/core-web-vitals');
const typescript = require('eslint-config-next/typescript');

module.exports = [
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts'],
  },
  ...coreWebVitals,
  ...typescript,
];
