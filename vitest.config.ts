import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				runes: true
			}
		})
	],
	test: {
		include: ['tests/unit/**/*.test.ts'],
		globals: true,
		environment: 'jsdom',
		server: {
			deps: {
				inline: true
			}
		}
	},
	resolve: {
		alias: {
			$lib: resolve('./src/lib')
		},
		conditions: ['browser'],
		mainFields: ['browser', 'module', 'main']
	}
});