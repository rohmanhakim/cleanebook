/**
 * Presigned URL API endpoint
 * Generates a presigned URL for downloading a PDF from R2
 *
 * In local development, returns a proxy URL instead of a presigned URL
 * because local R2 buckets don't have S3 endpoints accessible from browsers.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getJobById } from '$lib/server/db';
import { createR2Client, generatePresignedUrl } from '$lib/server/r2';
import { PDF_PRESIGNED_URL_EXPIRY_SECONDS } from '$lib/shared/constants';

// Check if we're in local development mode
// Local development uses bucket names ending with '-local'
function isLocalDevelopment(bucketName: string): boolean {
  return bucketName.endsWith('-local');
}

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

  const bucketName = platform?.env?.R2_BUCKET_NAME;
  if (!bucketName) {
    error(500, 'R2 bucket not configured');
  }

  // In local development, return a proxy URL instead of a presigned URL
  // Local R2 buckets don't have S3 endpoints accessible from browsers
  if (isLocalDevelopment(bucketName)) {
    // Construct proxy URL: /api/pdf/[jobId]/file
    const proxyUrl = `/api/pdf/${jobId}/file`;

    return json({
      url: proxyUrl,
      expiresAt: new Date(Date.now() + PDF_PRESIGNED_URL_EXPIRY_SECONDS * 1000).toISOString(),
      expiresIn: PDF_PRESIGNED_URL_EXPIRY_SECONDS,
      isProxy: true, // Flag to indicate this is a proxy URL, not a presigned URL
    });
  }

  // Production: Create R2 client and generate presigned URL
  const r2Client = createR2Client(platform!.env);
  const { url, expiresAt } = await generatePresignedUrl(r2Client, bucketName, job.pdfKey);

  return json({
    url,
    expiresAt: expiresAt.toISOString(),
    expiresIn: PDF_PRESIGNED_URL_EXPIRY_SECONDS,
  });
};
