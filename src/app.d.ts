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
				plan: 'free' | 'reader' | 'collector';
				hfApiKey: string | null;
				polarCustomerId: string | null;
			} | null;
		}
	}
}

export {};