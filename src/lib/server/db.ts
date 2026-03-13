/**
 * D1 database query helpers
 * All queries go through helper functions
 * Row mappers centralize snake_case (DB) → camelCase (TypeScript) conversion
 */

import { nanoid } from 'nanoid';
import type { D1Database } from '@cloudflare/workers-types';
import type { Job, User, Template } from '$lib/shared/types';

// Always pass DB as first arg — never import platform directly in helpers

// ── Row Mappers ──────────────────────────────────────────────────

/**
 * Map a database row to a User object
 * Handles snake_case → camelCase conversion
 *
 * @param row - The database row
 * @param prefix - Column prefix for JOIN queries (e.g., 'u_' for u.id, u.email)
 */
export function rowToUser(row: Record<string, unknown>, prefix = ''): User {
  const get = (field: string) => row[prefix ? `${prefix}${field}` : field];

  // Handle boolean conversion - D1/SQLite may return 1, "1", true, or 0, "0", false
  const toBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return value === '1';
    return Boolean(value);
  };

  return {
    id: get('id') as string,
    email: get('email') as string,
    name: get('name') as string,
    role: get('role') as User['role'],
    plan: get('plan') as User['plan'],
    isAnonymous: toBoolean(get('is_anonymous')),
    hfApiKeyEncrypted: get('hf_api_key_encrypted') as string | null,
    polarCustomerId: get('polar_customer_id') as string | null,
    conversionsThisMonth: get('conversions_this_month') as number,
    conversionsTotal: get('conversions_total') as number,
    conversionsResetAt: get('conversions_reset_at') as string,
    createdAt: get('created_at') as string,
  };
}

/**
 * Map a database row to a Job object
 * Handles snake_case → camelCase conversion
 */
export function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as Job['status'],
    pdfKey: row.pdf_key as string,
    epubKey: row.epub_key as string | null,
    templateId: row.template_id as string | null,
    pdfPageCount: row.pdf_page_count as number,
    pdfFilename: row.pdf_filename as string,
    errorMessage: row.error_message as string | null,
    reviewPages: row.review_pages ? JSON.parse(row.review_pages as string) : null,
    pipelineStep: row.pipeline_step as string | null,
    ocrModel: row.ocr_model as string,
    layoutModel: row.layout_model as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Map a database row to a Template object
 * Handles snake_case → camelCase conversion
 */
export function rowToTemplate(row: Record<string, unknown>): Template {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    description: row.description as string | null,
    rules: JSON.parse(row.rules as string) as Template['rules'],
    samplePageIndex: row.sample_page_index as number,
    isPublic: row.is_public === 1,
    useCount: row.use_count as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── User Helpers ──────────────────────────────────────────────────

/**
 * Get a user by ID
 */
export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();

  return row ? rowToUser(row) : null;
}

/**
 * Get a user by email
 */
export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<Record<string, unknown>>();

  return row ? rowToUser(row) : null;
}

/**
 * Create an anonymous user
 * Used by hooks.server.ts for lazy anonymous user creation
 *
 * @returns The newly created anonymous user
 */
export async function createAnonymousUser(db: D1Database): Promise<User> {
  const id = `anon_${nanoid(21)}`; // anon_ prefix + 21 random chars = 26 total
  const now = new Date().toISOString();

  await db
    .prepare(
      `
			INSERT INTO users (id, name, role, plan, is_anonymous, conversions_reset_at, created_at)
			VALUES (?, 'Anonymous', 'user', 'anonymous', 1, ?, ?)
		`
    )
    .bind(id, now, now)
    .run();

  return {
    id,
    email: '', // Anonymous users have no email initially
    name: 'Anonymous',
    role: 'user',
    plan: 'anonymous',
    isAnonymous: true,
    hfApiKeyEncrypted: null,
    polarCustomerId: null,
    conversionsThisMonth: 0,
    conversionsTotal: 0,
    conversionsResetAt: now,
    createdAt: now,
  };
}

/**
 * Claim an anonymous user by converting them to a registered user
 * Updates the existing row in-place (preserves user_id, so jobs remain linked)
 */
export async function claimAnonymousUser(
  db: D1Database,
  anonId: string,
  data: { email: string; name: string; passwordHash: string }
): Promise<void> {
  await db
    .prepare(
      `
			UPDATE users
			SET email = ?, name = ?, password_hash = ?, plan = 'free', is_anonymous = 0
			WHERE id = ? AND is_anonymous = 1
		`
    )
    .bind(data.email, data.name, data.passwordHash, anonId)
    .run();
}

/**
 * Increment the conversions_total counter for a user
 * Used for anonymous user limit tracking
 */
export async function incrementConversionsTotal(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare('UPDATE users SET conversions_total = conversions_total + 1 WHERE id = ?')
    .bind(userId)
    .run();
}

/**
 * Increment the conversions_this_month counter for a user
 * Used for registered user limit tracking
 */
export async function incrementUserConversions(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare('UPDATE users SET conversions_this_month = conversions_this_month + 1 WHERE id = ?')
    .bind(userId)
    .run();
}

// ── Job Helpers ──────────────────────────────────────────────────

/**
 * Get a job by ID
 */
export async function getJobById(db: D1Database, id: string): Promise<Job | null> {
  const row = await db
    .prepare('SELECT * FROM jobs WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();

  return row ? rowToJob(row) : null;
}

/**
 * Get all jobs for a user, ordered by creation date (newest first)
 */
export async function getJobsByUserId(db: D1Database, userId: string): Promise<Job[]> {
  const result = await db
    .prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<Record<string, unknown>>();

  return result.results.map(rowToJob);
}

/**
 * Create a new job
 */
export async function createJob(
  db: D1Database,
  job: Omit<Job, 'createdAt' | 'updatedAt'>
): Promise<void> {
  const now = new Date().toISOString();

  await db
    .prepare(
      `
			INSERT INTO jobs (
				id, user_id, status, pdf_key, epub_key, template_id,
				pdf_page_count, pdf_filename, error_message, review_pages,
				pipeline_step, ocr_model, layout_model, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
    )
    .bind(
      job.id,
      job.userId,
      job.status,
      job.pdfKey,
      job.epubKey,
      job.templateId,
      job.pdfPageCount,
      job.pdfFilename,
      job.errorMessage,
      job.reviewPages ? JSON.stringify(job.reviewPages) : null,
      job.pipelineStep,
      job.ocrModel,
      job.layoutModel,
      now,
      now
    )
    .run();
}

/**
 * Update job status and optional fields
 */
export async function updateJobStatus(
  db: D1Database,
  id: string,
  status: Job['status'],
  extra?: Partial<Pick<Job, 'epubKey' | 'errorMessage' | 'reviewPages' | 'pipelineStep'>>
): Promise<void> {
  const now = new Date().toISOString();
  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const values: (string | number | null)[] = [status, now];

  if (extra?.epubKey !== undefined) {
    updates.push('epub_key = ?');
    values.push(extra.epubKey);
  }
  if (extra?.errorMessage !== undefined) {
    updates.push('error_message = ?');
    values.push(extra.errorMessage);
  }
  if (extra?.reviewPages !== undefined) {
    updates.push('review_pages = ?');
    values.push(extra.reviewPages ? JSON.stringify(extra.reviewPages) : null);
  }
  if (extra?.pipelineStep !== undefined) {
    updates.push('pipeline_step = ?');
    values.push(extra.pipelineStep);
  }

  values.push(id);

  await db
    .prepare(`UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

// ── Template Helpers ──────────────────────────────────────────────────

/**
 * Get a template by ID
 */
export async function getTemplateById(db: D1Database, id: string): Promise<Template | null> {
  const row = await db
    .prepare('SELECT * FROM templates WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();

  return row ? rowToTemplate(row) : null;
}
