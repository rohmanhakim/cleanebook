import path from 'node:path';
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig(async () => {
  // Read all migrations in the `migrations` directory
  const migrationsPath = path.join(__dirname, 'migrations');
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      include: ['tests/integration/**/*.test.ts'],
      globals: true,
      setupFiles: ['./tests/integration/apply-migrations.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.dev.jsonc' },
          miniflare: {
            // Add a test-only binding for migrations, so we can apply them in a setup file
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
    resolve: {
      alias: {
        $lib: path.join(__dirname, 'src/lib'),
      },
    },
  };
});
