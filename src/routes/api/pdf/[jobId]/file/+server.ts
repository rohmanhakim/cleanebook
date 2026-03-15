/**
 * PDF File Serving API endpoint
 * Serves PDF files directly from R2 storage
 *
 * This endpoint is used for local development where presigned URLs
 * don't work because local R2 buckets don't have S3 endpoints.
 * In production, presigned URLs are preferred for direct client-to-R2 downloads.
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getJobById } from '$lib/server/db';

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

  // Fetch file from R2
  const r2 = platform?.env?.R2;
  if (!r2) {
    error(500, 'R2 storage not available');
  }

  const object = await r2.get(job.pdfKey);
  if (!object) {
    error(404, 'PDF file not found');
  }

  // Return the PDF with appropriate headers
  // Convert R2 body to ArrayBuffer to avoid type incompatibility with standard ReadableStream
  const arrayBuffer = await object.arrayBuffer();

  return new Response(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${job.pdfFilename}"`,
      'Content-Length': object.size.toString(),
      'Cache-Control': 'private, max-age=3600',
    },
  });
};
