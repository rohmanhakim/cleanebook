// Type definitions for cloudflare:test module
// https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/#define-types

declare module 'cloudflare:test' {
  import type { D1Database, R2Bucket, KVNamespace, Queue } from '@cloudflare/workers-types';

  interface D1Migration {
    id: number;
    name: string;
    queries: string[];
  }

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
  };

  export function applyD1Migrations(
    db: D1Database,
    migrations: D1Migration[],
    migrationsTableName?: string
  ): Promise<void>;
}
