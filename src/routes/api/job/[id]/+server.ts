/**
 * Job Status API Route
 * Thin wrapper that delegates to the job status handlers
 */
import type { RequestHandler } from './$types';
import { handleGetJob, handleCancelJob } from '$lib/server/job-status';

export const GET: RequestHandler = handleGetJob;
export const DELETE: RequestHandler = handleCancelJob;
