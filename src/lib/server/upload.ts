/**
 * PDF Upload Handler
 * Business logic for PDF upload, validation, and R2 storage
 *
 * This module exports a RequestHandler that can be used directly in route files
 * or imported for testing without the SvelteKit HTTP stack.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getDocument } from 'pdfjs-serverless';
import { PLAN_LIMITS, MAX_PDF_SIZE_BYTES } from '$lib/shared/constants';

// Response type
export interface UploadResponse {
  key: string;
  filename: string;
  pageCount: number;
  sizeBytes: number;
}

/**
 * Validate PDF magic bytes (%PDF-)
 */
export function validatePdfMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 5));
  const header = String.fromCharCode(...bytes);
  return header === '%PDF-';
}

/**
 * Sanitize filename - remove unsafe characters while preserving readability
 * Note: Control characters are intentionally removed for security
 */
export function sanitizeFilename(name: string): string {
  /* eslint-disable no-control-regex */
  return name
    .replace(/\x00/g, '') // Remove null bytes (security)
    .replace(/[\x00-\x1f\x80-\x9f]/g, '') // Remove control chars
    .replace(/\.\./g, '') // Prevent path traversal
    .replace(/[<>:"|?*]/g, '') // Remove invalid filesystem chars
    .slice(0, 255); // Limit length
  /* eslint-enable no-control-regex */
}

/**
 * Extract page count from PDF using pdfjs-serverless
 */
export async function getPdfPageCount(buffer: ArrayBuffer): Promise<number> {
  const pdf = await getDocument({ data: buffer }).promise;
  return pdf.numPages;
}

/**
 * Get max pages allowed for a user's plan
 */
export function getMaxPagesForPlan(plan: string): number {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.maxPagesPerPdf ?? 0;
}

/**
 * PDF Upload RequestHandler
 * Accepts multipart/form-data with a 'file' field containing a PDF
 * Validates, stores in R2, and returns metadata
 */
export const handleUpload: RequestHandler = async ({ request, locals, platform }) => {
  // 1. Auth check - user should exist (anonymous created by hooks.server.ts)
  if (!locals.user) {
    return error(401, 'Unauthorized');
  }

  // 2. Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error(400, 'Invalid multipart form data');
  }

  // 3. Extract file from form
  const file = formData.get('file');
  if (!file) {
    return error(400, 'No file provided');
  }

  if (!(file instanceof File)) {
    return error(400, 'Invalid file field');
  }

  // 4. Validate file size
  const sizeBytes = file.size;
  if (sizeBytes > MAX_PDF_SIZE_BYTES) {
    return error(413, `File exceeds maximum size of ${MAX_PDF_SIZE_BYTES / 1024 / 1024}MB`);
  }

  // 5. Read file into buffer for validation
  const arrayBuffer = await file.arrayBuffer();

  // 6. Validate PDF magic bytes
  if (!validatePdfMagicBytes(arrayBuffer)) {
    return error(400, 'Invalid PDF file');
  }

  // 7. Extract page count
  let pageCount: number;
  try {
    pageCount = await getPdfPageCount(arrayBuffer);
  } catch (err) {
    console.error('Failed to parse PDF:', err);
    return error(400, 'Failed to parse PDF file');
  }

  // 8. Check page limit based on user's plan
  const maxPages = getMaxPagesForPlan(locals.user.plan);
  if (pageCount > maxPages) {
    return error(403, `PDF exceeds page limit of ${maxPages} pages for your plan`);
  }

  // 9. Generate R2 key and sanitize filename
  const userId = locals.user.id;
  const r2Key = `uploads/${userId}/${crypto.randomUUID()}.pdf`;
  const filename = sanitizeFilename(file.name) || 'document.pdf';

  // 10. Store in R2
  try {
    await platform!.env.R2.put(r2Key, arrayBuffer);
  } catch (err) {
    console.error('Failed to store file in R2:', err);
    return error(500, 'Failed to store file');
  }

  // 11. Return response
  const response: UploadResponse = {
    key: r2Key,
    filename,
    pageCount,
    sizeBytes,
  };

  return json(response);
};
