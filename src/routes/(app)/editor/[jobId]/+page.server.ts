/**
 * Editor page server
 * Loads job data from D1 and validates user ownership
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getJobById } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, locals, platform }) => {
  const { jobId } = params;
  const user = locals.user;

  // User should always exist here due to hooks.server.ts
  // but handle gracefully just in case
  if (!user) {
    error(404, { message: 'Job not found' });
  }

  // Get job from D1
  const db = platform?.env?.DB;
  if (!db) {
    error(500, { message: 'Database not available' });
  }

  const job = await getJobById(db, jobId);

  // Job not found or user doesn't own it
  // Return 404 for both cases (don't reveal if job exists)
  if (!job || job.userId !== user.id) {
    error(404, { message: 'Job not found' });
  }

  return {
    job,
  };
};
