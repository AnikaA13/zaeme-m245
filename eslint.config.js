import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'test-results',
    '.local-stack',
    '.npm-cache',
    '.vercel',
    'references',
  ]),
  js.configs.recommended,
  {
    files: ['scripts/scanner/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  ...tseslint.configs.recommended,
  {
    files: ['scripts/database/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]);
