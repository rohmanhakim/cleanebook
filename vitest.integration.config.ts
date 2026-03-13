import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

// Helper to convert Buffer to JSON-serializable array
function bufferToArray(buffer: Buffer): number[] {
  return Array.from(buffer);
}

export default defineWorkersConfig(async () => {
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
      include: ['tests/integration/**/*.test.ts'],
      globals: true,
      setupFiles: ['./tests/integration/apply-migrations.ts'],
      poolOptions: {
        workers: {
          // Note: We don't use 'main' here since we're testing bindings directly
          // Handler tests use vitest.handler.config.ts
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
        $lib: path.join(__dirname, 'src/lib'),
      },
    },
  };
});
