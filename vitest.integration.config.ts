import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		include: ['tests/integration/**/*.test.ts'],
		globals: true,
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.dev.jsonc' }
			}
		}
	}
});