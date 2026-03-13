// Type definitions for cloudflare:test module
// https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/#define-types

declare module 'cloudflare:test' {
  import type { D1Database, R2Bucket, KVNamespace, Queue } from '@cloudflare/workers-types';

  interface D1Migration {
    id: number;
    name: string;
    queries: string[];
  }

  // NOTE: SELF.fetch() is NOT used - it causes CSRF hangs with SvelteKit
  // Use handler tests (vitest.handler.config.ts) for route logic testing

  export const env: {
    DB: D1Database;
    R2: R2Bucket;
    KV: KVNamespace;
    QUEUE: Queue;
    // Secrets from .dev.vars
    HF_API_KEY: string;
    COOKIE_SECRET: string;
    POLAR_ACCESS_TOKEN: string;
    POLAR_WEBHOOK_SECRET: string;
    BASIC_AUTH_USER: string;
    BASIC_AUTH_PASSWORD: string;
    // Test-only bindings
    TEST_MIGRATIONS: D1Migration[];
    // Test fixtures (as number arrays for JSON compatibility)
    FIXTURE_PDF_1PAGE: number[];
    FIXTURE_PDF_10PAGES: number[];
    FIXTURE_PDF_51PAGES: number[];
    FIXTURE_NOT_A_PDF: number[];
  };

  export function applyD1Migrations(
    db: D1Database,
    migrations: D1Migration[],
    migrationsTableName?: string
  ): Promise<void>;
}
