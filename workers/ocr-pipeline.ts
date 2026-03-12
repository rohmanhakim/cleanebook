// OCR Pipeline Workflow
// Stub file - actual implementations will be added later

/// <reference types="@cloudflare/workers-types" />

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type {
	D1Database,
	R2Bucket,
	KVNamespace,
	Queue,
	Workflow,
	Fetcher,
	ExecutionContext,
} from '@cloudflare/workers-types';

interface Env {
	DB: D1Database;
	R2: R2Bucket;
	KV: KVNamespace;
	QUEUE: Queue;
	OCR_WORKFLOW: Workflow;
	ASSETS: Fetcher;
	HF_API_KEY: string;
	COOKIE_SECRET: string;
	POLAR_ACCESS_TOKEN: string;
	POLAR_WEBHOOK_SECRET: string;
}

interface JobParams {
	jobId: string;
}

export class OcrPipeline extends WorkflowEntrypoint<Env, JobParams> {
	async run(event: WorkflowEvent<JobParams>, step: WorkflowStep) {
		const { jobId } = event.payload;

		// Stub implementation - logs only
		await step.do('log-start', async () => {
			console.log(`[OcrPipeline] Started processing job: ${jobId}`);
			return { started: true, jobId };
		});

		// TODO: Implement actual pipeline steps:
		// 1. Load job and template from D1
		// 2. Fetch PDF from R2, extract text layer
		// 3. Geometric matching
		// 4. Pause if review needed
		// 5. OCR each page
		// 6. Crop and store figures
		// 7. Assemble EPUB
		// 8. Upload EPUB to R2
		// 9. Mark complete

		await step.do('log-end', async () => {
			console.log(`[OcrPipeline] Completed (stub) processing job: ${jobId}`);
			return { completed: true, jobId };
		});
	}
}

// Export default handler for the worker
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return new Response('OcrPipeline Worker - Not implemented', { status: 501 });
	},
};