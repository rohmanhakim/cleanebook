/**
 * Vitest configuration for Handler tests
 * Tests SvelteKit route handlers directly with real CF bindings
 * Does NOT use SELF.fetch() - calls handlers directly to avoid CSRF issues
 */
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

// Helper to convert Buffer to JSON-serializable array
function bufferToArray(buffer: Buffer): number[] {
  return Array.from(buffer);
}

export default defineWorkersConfig(async () => {
  // Set VITEST env var to disable Basic Auth in tests
  process.env.VITEST = 'true';

  // Read all migrations in the `migrations` directory
  const migrationsPath = path.join(__dirname, 'migrations');
  const migrations = await readD1Migrations(migrationsPath);

  // Read test fixture files and convert to arrays for JSON compatibility
  const fixturesPath = path.join(__dirname, 'tests/fixtures');
  const [pdf1page, pdf10pages, pdf51pages, notAPdf] = await Promise.all([
    readFile(path.join(fixturesPath, 'pdfs/sample-1page.pdf')),
    readFile(path.join(fixturesPath, 'pdfs/sample-10pages.pdf')),
    readFile(path.join(fixturesPath, 'pdfs/sample-51pages.pdf')),
    readFile(path.join(fixturesPath, 'invalid/not-a-pdf.txt')),
  ]);

  return {
    test: {
      include: ['tests/handler/**/*.test.ts'],
      globals: true,
      setupFiles: ['./tests/integration/apply-migrations.ts'],
      poolOptions: {
        workers: {
          // Note: We don't use 'main' here since we're testing handlers directly
          // We just need the CF bindings (D1, R2, KV)
          wrangler: { configPath: './wrangler.dev.jsonc' },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              // Convert Buffers to arrays for JSON compatibility
              FIXTURE_PDF_1PAGE: bufferToArray(pdf1page),
              FIXTURE_PDF_10PAGES: bufferToArray(pdf10pages),
              FIXTURE_PDF_51PAGES: bufferToArray(pdf51pages),
              FIXTURE_NOT_A_PDF: bufferToArray(notAPdf),
            },
          },
        },
      },
    },
    resolve: {
      alias: {
        $lib: path.resolve('./src/lib'),
      },
    },
  };
});
