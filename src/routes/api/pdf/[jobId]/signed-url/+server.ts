/**
 * Presigned URL API endpoint
 * Generates a presigned URL for downloading a PDF from R2
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getJobById } from '$lib/server/db';
import { createR2Client, generatePresignedUrl } from '$lib/server/r2';
import { PDF_PRESIGNED_URL_EXPIRY_SECONDS } from '$lib/shared/constants';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  const { jobId } = params;
  const user = locals.user;

  if (!user) {
    error(401, 'Unauthorized');
  }

  const db = platform?.env?.DB;
  if (!db) {
    error(500, 'Database not available');
  }

  // Get job and verify ownership
  const job = await getJobById(db, jobId);
  if (!job || job.userId !== user.id) {
    error(404, 'Job not found');
  }

  // Create R2 client and generate presigned URL
  const r2Client = createR2Client(platform!.env);
  const bucketName = platform?.env?.R2_BUCKET_NAME;

  if (!bucketName) {
    error(500, 'R2 bucket not configured');
  }

  const { url, expiresAt } = await generatePresignedUrl(r2Client, bucketName, job.pdfKey);

  return json({
    url,
    expiresAt: expiresAt.toISOString(),
    expiresIn: PDF_PRESIGNED_URL_EXPIRY_SECONDS,
  });
};
