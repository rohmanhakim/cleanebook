import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  {
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    rules: {
      // Disable since SvelteKit routes are type-safe and resolve() has typing issues
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  {
    ignores: [
      '.svelte-kit/**',
      'node_modules/**',
      'build/**',
      'dist/**',
      '.wrangler/**',
      'playwright-report/**',
    ],
  },
];
