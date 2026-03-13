/**
 * Job Creation Handler
 * Business logic for creating conversion jobs
 *
 * This module exports a RequestHandler that can be used directly in route files
 * or imported for testing without the SvelteKit HTTP stack.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { R2Bucket } from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';
import { PLAN_LIMITS, DEFAULT_OCR_MODEL, DEFAULT_LAYOUT_MODEL } from '$lib/shared/constants';
import { createJob, incrementConversionsTotal, incrementUserConversions } from '$lib/server/db';
import type { User, Job } from '$lib/shared/types';

// Response types
export interface CreateJobRequest {
  pdfKey: string;
  pdfFilename: string;
  pdfPageCount: number;
  templateId?: string;
  ocrModel?: string;
  layoutModel?: string;
}

export interface CreateJobResponse {
  jobId: string;
  status: 'queued';
}

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return `job_${nanoid(21)}`;
}

/**
 * Validate that the PDF key belongs to the user
 * Key format: uploads/{userId}/{uuid}.pdf
 */
export function validatePdfOwnership(pdfKey: string, userId: string): boolean {
  const expectedPrefix = `uploads/${userId}/`;
  return pdfKey.startsWith(expectedPrefix);
}

/**
 * Check if PDF exists in R2
 */
export async function checkPdfExists(r2: R2Bucket, key: string): Promise<boolean> {
  const object = await r2.head(key);
  return object !== null;
}

/**
 * Check if user can create more conversions based on their plan
 * Returns { allowed: true } if under limit, { allowed: false, reason: string } if at limit
 */
export function checkConversionLimit(user: User): { allowed: boolean; reason?: string } {
  // Anonymous users: check lifetime total
  if (user.plan === 'anonymous') {
    const limit = PLAN_LIMITS.anonymous.conversionsTotal;
    if (user.conversionsTotal >= limit) {
      return {
        allowed: false,
        reason: `Anonymous users are limited to ${limit} conversion${limit === 1 ? '' : 's'}. Sign up for more.`,
      };
    }
    return { allowed: true };
  }

  // Registered users: check monthly limit
  const planLimits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS];
  if (!planLimits) {
    return { allowed: false, reason: 'Unknown plan' };
  }

  const monthlyLimit =
    'conversionsPerMonth' in planLimits ? planLimits.conversionsPerMonth : Infinity;

  if (monthlyLimit !== Infinity && user.conversionsThisMonth >= monthlyLimit) {
    return {
      allowed: false,
      reason: `You've reached your monthly limit of ${monthlyLimit} conversion${monthlyLimit === 1 ? '' : 's'}. Upgrade your plan for more.`,
    };
  }

  return { allowed: true };
}

/**
 * Job Creation RequestHandler
 * Accepts JSON with PDF metadata, validates limits, creates job in D1
 */
export const handleCreateJob: RequestHandler = async ({ request, locals, platform }) => {
  // 1. Auth check
  if (!locals.user) {
    return error(401, 'Unauthorized');
  }

  // 2. Parse request body
  let body: CreateJobRequest;
  try {
    body = await request.json();
  } catch {
    return error(400, 'Invalid JSON body');
  }

  // 3. Validate required fields
  if (!body.pdfKey || !body.pdfFilename || typeof body.pdfPageCount !== 'number') {
    return error(400, 'Missing required fields: pdfKey, pdfFilename, pdfPageCount');
  }

  // 4. Check PDF exists in R2
  const pdfExists = await checkPdfExists(platform!.env.R2, body.pdfKey);
  if (!pdfExists) {
    return error(404, 'PDF not found');
  }

  // 5. Validate PDF ownership
  if (!validatePdfOwnership(body.pdfKey, locals.user.id)) {
    return error(403, 'You do not have access to this PDF');
  }

  // 6. Check conversion limits
  const limitCheck = checkConversionLimit(locals.user);
  if (!limitCheck.allowed) {
    return error(403, limitCheck.reason || 'Conversion limit exceeded');
  }

  // 7. Generate job ID
  const jobId = generateJobId();

  // 8. Create job in D1
  const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
    id: jobId,
    userId: locals.user.id,
    status: 'queued',
    pdfKey: body.pdfKey,
    epubKey: null,
    templateId: body.templateId ?? null,
    pdfPageCount: body.pdfPageCount,
    pdfFilename: body.pdfFilename,
    errorMessage: null,
    reviewPages: null,
    pipelineStep: null,
    ocrModel: body.ocrModel ?? DEFAULT_OCR_MODEL,
    layoutModel: body.layoutModel ?? DEFAULT_LAYOUT_MODEL,
  };

  try {
    await createJob(platform!.env.DB, job);
  } catch (err) {
    console.error('Failed to create job:', err);
    return error(500, 'Failed to create job');
  }

  // 9. Increment conversion counters
  try {
    // Anonymous users: increment conversionsTotal
    if (locals.user.isAnonymous) {
      await incrementConversionsTotal(platform!.env.DB, locals.user.id);
    } else {
      // Registered users: increment conversionsThisMonth
      await incrementUserConversions(platform!.env.DB, locals.user.id);
    }
  } catch (err) {
    console.error('Failed to increment conversion counters:', err);
    // Don't fail the request - the job is already created
    // The counter mismatch can be fixed by a future audit
  }

  // 10. Return response
  const response: CreateJobResponse = {
    jobId,
    status: 'queued',
  };

  return json(response);
};
