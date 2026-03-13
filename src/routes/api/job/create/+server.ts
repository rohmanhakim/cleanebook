/**
 * Job Creation API Route
 * Thin wrapper that delegates to the job creation handler
 */
import type { RequestHandler } from './$types';
import { handleCreateJob } from '$lib/server/job';

export const POST: RequestHandler = handleCreateJob;
