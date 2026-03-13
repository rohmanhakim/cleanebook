/**
 * Integration tests for database helpers
 * Tests Job and Template CRUD operations with D1
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { nanoid } from 'nanoid';
import {
  createAnonymousUser,
  getUserById,
  getUserByEmail,
  getJobById,
  getJobsByUserId,
  createJob,
  updateJobStatus,
  incrementConversionsTotal,
  claimAnonymousUser,
} from '$lib/server/db';
import type { Job } from '$lib/shared/types';

// SQL to create required tables
const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,
  email                 TEXT UNIQUE,
  name                  TEXT NOT NULL DEFAULT 'Anonymous',
  password_hash         TEXT,
  role                  TEXT NOT NULL DEFAULT 'user',
  plan                  TEXT NOT NULL DEFAULT 'free',
  is_anonymous          INTEGER NOT NULL DEFAULT 0,
  conversions_total     INTEGER NOT NULL DEFAULT 0,
  hf_api_key_encrypted  TEXT,
  polar_customer_id     TEXT,
  conversions_this_month INTEGER NOT NULL DEFAULT 0,
  conversions_reset_at  TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'queued',
  pdf_key         TEXT NOT NULL,
  epub_key        TEXT,
  template_id     TEXT,
  pdf_page_count  INTEGER NOT NULL DEFAULT 0,
  pdf_filename    TEXT NOT NULL,
  error_message   TEXT,
  review_pages    TEXT,
  pipeline_step   TEXT,
  ocr_model       TEXT NOT NULL DEFAULT 'lightonai/LightOnOCR-2-1B',
  layout_model    TEXT NOT NULL DEFAULT 'microsoft/layoutlmv3-base',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS templates (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  rules             TEXT NOT NULL,
  sample_page_index INTEGER NOT NULL DEFAULT 0,
  is_public         INTEGER NOT NULL DEFAULT 0,
  use_count         INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_is_anonymous ON users(is_anonymous);
`;

async function setupTestDatabase() {
  await env.DB.batch([env.DB.prepare(CREATE_TABLES_SQL)]);
}

describe('Database Helpers', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  // ── User Helpers ──────────────────────────────────────────────────

  describe('getUserById', () => {
    it('should return null for non-existent user', async () => {
      const result = await getUserById(env.DB, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should return user with correct fields', async () => {
      const user = await createAnonymousUser(env.DB);
      const result = await getUserById(env.DB, user.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(user.id);
      expect(result?.name).toBe('Anonymous');
      expect(result?.isAnonymous).toBe(true);
      expect(result?.plan).toBe('anonymous');
    });
  });

  describe('getUserByEmail', () => {
    it('should return null for non-existent email', async () => {
      const result = await getUserByEmail(env.DB, 'nonexistent@example.com');
      expect(result).toBeNull();
    });

    it('should return user by email', async () => {
      // Create anonymous user
      const anonUser = await createAnonymousUser(env.DB);

      // Claim them with email
      const email = 'test@example.com';
      await claimAnonymousUser(env.DB, anonUser.id, {
        email,
        name: 'Test User',
        passwordHash: 'hashedpassword123',
      });

      const result = await getUserByEmail(env.DB, email);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(anonUser.id);
      expect(result?.email).toBe(email);
      expect(result?.name).toBe('Test User');
      expect(result?.isAnonymous).toBe(false);
      expect(result?.plan).toBe('free');
    });
  });

  describe('claimAnonymousUser', () => {
    it('should convert anonymous user to registered', async () => {
      const anonUser = await createAnonymousUser(env.DB);

      await claimAnonymousUser(env.DB, anonUser.id, {
        email: 'claimed@example.com',
        name: 'Claimed User',
        passwordHash: 'hashedpassword',
      });

      const result = await getUserById(env.DB, anonUser.id);

      expect(result).not.toBeNull();
      expect(result?.email).toBe('claimed@example.com');
      expect(result?.name).toBe('Claimed User');
      expect(result?.isAnonymous).toBe(false);
      expect(result?.plan).toBe('free');
    });

    it('should preserve user ID (jobs remain linked)', async () => {
      const anonUser = await createAnonymousUser(env.DB);
      const originalId = anonUser.id;

      await claimAnonymousUser(env.DB, anonUser.id, {
        email: 'preserve@example.com',
        name: 'Preserved ID',
        passwordHash: 'hashedpassword',
      });

      const result = await getUserById(env.DB, originalId);
      expect(result?.id).toBe(originalId);
    });
  });

  describe('incrementConversionsTotal', () => {
    it('should increment conversions_total', async () => {
      const user = await createAnonymousUser(env.DB);
      expect(user.conversionsTotal).toBe(0);

      await incrementConversionsTotal(env.DB, user.id);

      const updated = await getUserById(env.DB, user.id);
      expect(updated?.conversionsTotal).toBe(1);

      await incrementConversionsTotal(env.DB, user.id);

      const updated2 = await getUserById(env.DB, user.id);
      expect(updated2?.conversionsTotal).toBe(2);
    });
  });

  // ── Job Helpers ──────────────────────────────────────────────────

  describe('createJob', () => {
    it('should create a job with required fields', async () => {
      const user = await createAnonymousUser(env.DB);

      const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_${nanoid()}`,
        userId: user.id,
        status: 'queued',
        pdfKey: `uploads/${user.id}/test.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 10,
        pdfFilename: 'test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, job);

      const result = await getJobById(env.DB, job.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(job.id);
      expect(result?.userId).toBe(user.id);
      expect(result?.status).toBe('queued');
      expect(result?.pdfKey).toBe(job.pdfKey);
      expect(result?.pdfPageCount).toBe(10);
      expect(result?.pdfFilename).toBe('test.pdf');
    });

    it('should create a job with all optional fields', async () => {
      const user = await createAnonymousUser(env.DB);

      const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_${nanoid()}`,
        userId: user.id,
        status: 'processing',
        pdfKey: `uploads/${user.id}/full.pdf`,
        epubKey: `epubs/${user.id}/job.epub`,
        templateId: null,
        pdfPageCount: 100,
        pdfFilename: 'full.pdf',
        errorMessage: null,
        reviewPages: [5, 10, 15],
        pipelineStep: 'ocr',
        ocrModel: 'custom-ocr-model',
        layoutModel: 'custom-layout-model',
      };

      await createJob(env.DB, job);

      const result = await getJobById(env.DB, job.id);

      expect(result).not.toBeNull();
      expect(result?.epubKey).toBe(job.epubKey);
      expect(result?.reviewPages).toEqual([5, 10, 15]);
      expect(result?.pipelineStep).toBe('ocr');
      expect(result?.ocrModel).toBe('custom-ocr-model');
      expect(result?.layoutModel).toBe('custom-layout-model');
    });
  });

  describe('getJobById', () => {
    it('should return null for non-existent job', async () => {
      const result = await getJobById(env.DB, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should return job with correct field types', async () => {
      const user = await createAnonymousUser(env.DB);

      const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_${nanoid()}`,
        userId: user.id,
        status: 'queued',
        pdfKey: `uploads/${user.id}/types-test.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 25,
        pdfFilename: 'types-test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, job);
      const result = await getJobById(env.DB, job.id);

      expect(result).not.toBeNull();
      expect(typeof result?.id).toBe('string');
      expect(typeof result?.userId).toBe('string');
      expect(typeof result?.pdfPageCount).toBe('number');
      expect(typeof result?.pdfFilename).toBe('string');
      expect(result?.createdAt).toBeDefined();
      expect(result?.updatedAt).toBeDefined();
    });
  });

  describe('getJobsByUserId', () => {
    it('should return empty array for user with no jobs', async () => {
      const user = await createAnonymousUser(env.DB);
      const result = await getJobsByUserId(env.DB, user.id);
      expect(result).toEqual([]);
    });

    it('should return all jobs for a user', async () => {
      const user = await createAnonymousUser(env.DB);

      // Create multiple jobs
      const job1: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_${nanoid()}`,
        userId: user.id,
        status: 'complete',
        pdfKey: `uploads/${user.id}/job1.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 10,
        pdfFilename: 'job1.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      const job2: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_${nanoid()}`,
        userId: user.id,
        status: 'queued',
        pdfKey: `uploads/${user.id}/job2.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 20,
        pdfFilename: 'job2.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, job1);
      await createJob(env.DB, job2);

      const result = await getJobsByUserId(env.DB, user.id);

      expect(result).toHaveLength(2);
      expect(result.map((j) => j.id)).toContain(job1.id);
      expect(result.map((j) => j.id)).toContain(job2.id);
    });

    it('should return jobs ordered by created_at DESC', async () => {
      const user = await createAnonymousUser(env.DB);

      const job1: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_older_${nanoid()}`,
        userId: user.id,
        status: 'queued',
        pdfKey: `uploads/${user.id}/older.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 10,
        pdfFilename: 'older.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const job2: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_newer_${nanoid()}`,
        userId: user.id,
        status: 'queued',
        pdfKey: `uploads/${user.id}/newer.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 10,
        pdfFilename: 'newer.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, job1);
      await createJob(env.DB, job2);

      const result = await getJobsByUserId(env.DB, user.id);

      // Newer job should be first
      expect(result[0].id).toBe(job2.id);
      expect(result[1].id).toBe(job1.id);
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status', async () => {
      const user = await createAnonymousUser(env.DB);

      const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_${nanoid()}`,
        userId: user.id,
        status: 'queued',
        pdfKey: `uploads/${user.id}/status-test.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 10,
        pdfFilename: 'status-test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, job);
      await updateJobStatus(env.DB, job.id, 'processing');

      const result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('processing');
    });

    it('should update status with epubKey', async () => {
      const user = await createAnonymousUser(env.DB);

      const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_${nanoid()}`,
        userId: user.id,
        status: 'processing',
        pdfKey: `uploads/${user.id}/epub-test.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 10,
        pdfFilename: 'epub-test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, job);
      await updateJobStatus(env.DB, job.id, 'complete', {
        epubKey: 'epubs/user/job.epub',
      });

      const result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('complete');
      expect(result?.epubKey).toBe('epubs/user/job.epub');
    });

    it('should update status with errorMessage', async () => {
      const user = await createAnonymousUser(env.DB);

      const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_${nanoid()}`,
        userId: user.id,
        status: 'processing',
        pdfKey: `uploads/${user.id}/error-test.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 10,
        pdfFilename: 'error-test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, job);
      await updateJobStatus(env.DB, job.id, 'failed', {
        errorMessage: 'OCR processing failed',
      });

      const result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('failed');
      expect(result?.errorMessage).toBe('OCR processing failed');
    });

    it('should update status with reviewPages', async () => {
      const user = await createAnonymousUser(env.DB);

      const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_${nanoid()}`,
        userId: user.id,
        status: 'processing',
        pdfKey: `uploads/${user.id}/review-test.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 50,
        pdfFilename: 'review-test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, job);
      await updateJobStatus(env.DB, job.id, 'needs_review', {
        reviewPages: [3, 7, 12],
        pipelineStep: 'heuristic_matching',
      });

      const result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('needs_review');
      expect(result?.reviewPages).toEqual([3, 7, 12]);
      expect(result?.pipelineStep).toBe('heuristic_matching');
    });

    it('should update status with all extra fields', async () => {
      const user = await createAnonymousUser(env.DB);

      const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_${nanoid()}`,
        userId: user.id,
        status: 'queued',
        pdfKey: `uploads/${user.id}/all-fields-test.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 100,
        pdfFilename: 'all-fields-test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, job);
      await updateJobStatus(env.DB, job.id, 'complete', {
        epubKey: 'epubs/user/all-fields.epub',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: 'finalized',
      });

      const result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('complete');
      expect(result?.epubKey).toBe('epubs/user/all-fields.epub');
      expect(result?.errorMessage).toBeNull();
      expect(result?.reviewPages).toBeNull();
      expect(result?.pipelineStep).toBe('finalized');
    });
  });

  // ── Job Status Transitions ──────────────────────────────────────────────────

  describe('Job Status Transitions', () => {
    it('should support full lifecycle: queued -> processing -> complete', async () => {
      const user = await createAnonymousUser(env.DB);

      const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_lifecycle_${nanoid()}`,
        userId: user.id,
        status: 'queued',
        pdfKey: `uploads/${user.id}/lifecycle.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 50,
        pdfFilename: 'lifecycle.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      // Create
      await createJob(env.DB, job);
      let result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('queued');

      // Processing
      await updateJobStatus(env.DB, job.id, 'processing', { pipelineStep: 'ocr' });
      result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('processing');
      expect(result?.pipelineStep).toBe('ocr');

      // Complete
      await updateJobStatus(env.DB, job.id, 'complete', {
        epubKey: `epubs/${user.id}/${job.id}.epub`,
        pipelineStep: 'finalized',
      });
      result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('complete');
      expect(result?.epubKey).toBe(`epubs/${user.id}/${job.id}.epub`);
    });

    it('should support needs_review -> resuming -> complete', async () => {
      const user = await createAnonymousUser(env.DB);

      const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_review_${nanoid()}`,
        userId: user.id,
        status: 'processing',
        pdfKey: `uploads/${user.id}/review-flow.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 100,
        pdfFilename: 'review-flow.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, job);

      // Needs review
      await updateJobStatus(env.DB, job.id, 'needs_review', {
        reviewPages: [5, 10, 15],
        pipelineStep: 'heuristic_matching',
      });
      let result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('needs_review');
      expect(result?.reviewPages).toEqual([5, 10, 15]);

      // Resuming
      await updateJobStatus(env.DB, job.id, 'resuming', { pipelineStep: 'ocr' });
      result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('resuming');

      // Complete
      await updateJobStatus(env.DB, job.id, 'complete', {
        epubKey: `epubs/${user.id}/${job.id}.epub`,
        reviewPages: null,
      });
      result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('complete');
    });

    it('should support cancelled status', async () => {
      const user = await createAnonymousUser(env.DB);

      const job: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: `job_cancel_${nanoid()}`,
        userId: user.id,
        status: 'queued',
        pdfKey: `uploads/${user.id}/cancel.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 10,
        pdfFilename: 'cancel.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, job);
      await updateJobStatus(env.DB, job.id, 'cancelled');

      const result = await getJobById(env.DB, job.id);
      expect(result?.status).toBe('cancelled');
    });
  });
});
