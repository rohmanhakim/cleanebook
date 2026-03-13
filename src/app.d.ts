import type { D1Database, R2Bucket, KVNamespace, Queue } from '@cloudflare/workers-types';

declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        R2: R2Bucket;
        KV: KVNamespace;
        QUEUE: Queue;
        OCR_WORKFLOW: Workflow;
        ASSETS: Fetcher;
        // Secrets (CF Workers secrets, not in wrangler.jsonc)
        HF_API_KEY: string;
        COOKIE_SECRET: string;
        POLAR_ACCESS_TOKEN: string;
        POLAR_WEBHOOK_SECRET: string;
        // Basic Auth (development gating - remove in production when ready)
        BASIC_AUTH_USER: string;
        BASIC_AUTH_PASSWORD: string;
        // Test-only bindings (only present during Vitest runs)
        VITEST?: boolean;
      };
      context: ExecutionContext;
      caches: CacheStorage & { default: Cache };
    }
    interface Locals {
      user: {
        id: string;
        email: string;
        name: string;
        role: 'user' | 'admin';
        plan: 'anonymous' | 'free' | 'reader' | 'collector';
        isAnonymous: boolean;
        hfApiKeyEncrypted: string | null;
        polarCustomerId: string | null;
        conversionsThisMonth: number;
        conversionsTotal: number;
        conversionsResetAt: string;
        createdAt: string;
      } | null;
    }
  }
}

export {};
