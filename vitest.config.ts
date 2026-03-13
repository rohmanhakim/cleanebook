import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        runes: true,
      },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    server: {
      deps: {
        inline: true,
      },
    },
  },
  resolve: {
    alias: {
      $lib: resolve('./src/lib'),
      $app: resolve('./tests/unit/__mocks__/$app'),
    },
    conditions: ['browser'],
    mainFields: ['browser', 'module', 'main'],
  },
});
