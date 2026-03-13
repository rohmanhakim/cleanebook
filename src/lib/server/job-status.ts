/**
 * Job Status Handler
 * Business logic for job status retrieval and cancellation
 *
 * This module exports RequestHandlers that can be used directly in route files
 * or imported for testing without the SvelteKit HTTP stack.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getJobById, updateJobStatus } from '$lib/server/db';
import type { Job, JobStatus } from '$lib/shared/types';

// Response types
// userId is intentionally excluded from response - not needed by client
export type JobStatusResponse = Omit<Job, 'userId'>;

export interface CancelJobResponse {
  id: string;
  status: 'cancelled';
}

// Terminal states that cannot be cancelled
const TERMINAL_STATES: JobStatus[] = ['complete', 'failed', 'cancelled'];

/**
 * Validate that the job belongs to the user
 */
export function validateJobOwnership(job: Job, userId: string): boolean {
  return job.userId === userId;
}

/**
 * Check if a job is in a terminal state (cannot be cancelled)
 */
export function isTerminalState(status: JobStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

/**
 * GET /api/job/[id] - Retrieve job status and metadata
 */
export const handleGetJob: RequestHandler = async ({ params, locals, platform }) => {
  // 1. Auth check
  if (!locals.user) {
    return error(401, 'Unauthorized');
  }

  // 2. Validate job ID param
  if (!params.id) {
    return error(400, 'Job ID is required');
  }

  // 3. Get job from D1
  const job = await getJobById(platform!.env.DB, params.id);

  // 3. Return 404 if not found
  if (!job) {
    return error(404, 'Job not found');
  }

  // 4. Validate ownership
  if (!validateJobOwnership(job, locals.user.id)) {
    return error(403, 'You do not have access to this job');
  }

  // 5. Return job data (exclude userId from response)
  const response: JobStatusResponse = {
    id: job.id,
    status: job.status,
    pdfFilename: job.pdfFilename,
    pdfPageCount: job.pdfPageCount,
    pdfKey: job.pdfKey,
    epubKey: job.epubKey,
    templateId: job.templateId,
    errorMessage: job.errorMessage,
    reviewPages: job.reviewPages,
    pipelineStep: job.pipelineStep,
    ocrModel: job.ocrModel,
    layoutModel: job.layoutModel,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };

  return json(response);
};

/**
 * DELETE /api/job/[id] - Cancel a job
 */
export const handleCancelJob: RequestHandler = async ({ params, locals, platform }) => {
  // 1. Auth check
  if (!locals.user) {
    return error(401, 'Unauthorized');
  }

  // 2. Validate job ID param
  if (!params.id) {
    return error(400, 'Job ID is required');
  }

  // 3. Get job from D1
  const job = await getJobById(platform!.env.DB, params.id);

  // 3. Return 404 if not found
  if (!job) {
    return error(404, 'Job not found');
  }

  // 4. Validate ownership
  if (!validateJobOwnership(job, locals.user.id)) {
    return error(403, 'You do not have access to this job');
  }

  // 5. Check if job is in terminal state
  if (isTerminalState(job.status)) {
    return error(400, `Cannot cancel job with status '${job.status}'`);
  }

  // 6. Update status to 'cancelled'
  await updateJobStatus(platform!.env.DB, job.id, 'cancelled');

  // 7. Return cancelled job info
  const response: CancelJobResponse = {
    id: job.id,
    status: 'cancelled',
  };

  return json(response);
};
