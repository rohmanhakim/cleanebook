/**
 * Handler tests for Editor Page
 * Tests the page server load function directly using real CF bindings (D1, R2)
 * Uses @cloudflare/vitest-pool-workers for bindings but NOT SELF.fetch()
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { applyD1Migrations } from 'cloudflare:test';
import { createRequestEvent, createMockUser, toServerLoadEvent } from '../../helpers/request-event';
import { createJob, createAnonymousUser } from '$lib/server/db';
import type { Job } from '$lib/shared/types';

// Import the load function from the page server
import { load } from '$routes/(app)/editor/[jobId]/+page.server';

describe('Editor Page Handler Tests', () => {
  beforeEach(async () => {
    // Apply migrations for each test
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  });

  describe('Load function imports', () => {
    it('should have load exported', () => {
      expect(load).toBeDefined();
      expect(typeof load).toBe('function');
    });
  });

  describe('Job loading', () => {
    it('should return job data when user owns the job', async () => {
      // Create an anonymous user
      const anonUser = await createAnonymousUser(env.DB);
      const user = {
        ...anonUser,
        role: anonUser.role as 'user' | 'admin',
        plan: anonUser.plan as 'anonymous' | 'free' | 'reader' | 'collector',
      };

      // Create a job for this user
      const jobData: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: 'job_test123456789',
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

      await createJob(env.DB, jobData);

      // Create request event
      const request = new Request('http://localhost/editor/job_test123456789');
      const event = createRequestEvent({
        request,
        locals: { user },
        params: { jobId: 'job_test123456789' },
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await load(toServerLoadEvent<any>(event))) as { job: Job };

      expect(result.job).toBeDefined();
      expect(result.job.id).toBe('job_test123456789');
      expect(result.job.userId).toBe(user.id);
      expect(result.job.pdfFilename).toBe('test.pdf');
      expect(result.job.pdfPageCount).toBe(10);
    });

    it('should return 404 when job does not exist', async () => {
      const user = createMockUser({ plan: 'anonymous' });

      const request = new Request('http://localhost/editor/nonexistent_job');
      const event = createRequestEvent({
        request,
        locals: { user },
        params: { jobId: 'nonexistent_job' },
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await load(toServerLoadEvent<any>(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(404);
      }
    });

    it('should return 404 when user does not own the job (security: dont reveal job exists)', async () => {
      // Create two different users
      const ownerUser = await createAnonymousUser(env.DB);
      const otherUser = createMockUser({
        id: 'anon_otheruser12345678901',
        plan: 'anonymous',
      });

      // Create a job owned by ownerUser
      const jobData: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: 'job_owned_by_other',
        userId: ownerUser.id, // Owned by ownerUser, not otherUser
        status: 'queued',
        pdfKey: `uploads/${ownerUser.id}/test.pdf`,
        epubKey: null,
        templateId: null,
        pdfPageCount: 5,
        pdfFilename: 'secret.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      };

      await createJob(env.DB, jobData);

      // Try to access with otherUser
      const request = new Request('http://localhost/editor/job_owned_by_other');
      const event = createRequestEvent({
        request,
        locals: { user: otherUser },
        params: { jobId: 'job_owned_by_other' },
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await load(toServerLoadEvent<any>(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        // Should return 404, not 403 (don't reveal job exists)
        expect((err as { status: number }).status).toBe(404);
      }
    });
  });

  describe('Edge cases', () => {
    it('should return 404 when user is null', async () => {
      const request = new Request('http://localhost/editor/some_job');
      const event = createRequestEvent({
        request,
        locals: { user: null },
        params: { jobId: 'some_job' },
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await load(toServerLoadEvent<any>(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(404);
      }
    });

    it('should return 500 when database not available', async () => {
      const user = createMockUser({ plan: 'anonymous' });

      const request = new Request('http://localhost/editor/some_job');
      const event = createRequestEvent({
        request,
        locals: { user },
        params: { jobId: 'some_job' },
        platform: {
          env: {
            DB: undefined as unknown as typeof env.DB, // No database
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await load(toServerLoadEvent<any>(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(500);
      }
    });
  });

  describe('Job data structure', () => {
    it('should return all expected job fields', async () => {
      const anonUser = await createAnonymousUser(env.DB);
      const user = {
        ...anonUser,
        role: anonUser.role as 'user' | 'admin',
        plan: anonUser.plan as 'anonymous' | 'free' | 'reader' | 'collector',
      };

      const jobData: Omit<Job, 'createdAt' | 'updatedAt'> = {
        id: 'job_full_test',
        userId: user.id,
        status: 'processing',
        pdfKey: `uploads/${user.id}/full-test.pdf`,
        epubKey: null,
        templateId: null, // No template - would fail FK constraint
        pdfPageCount: 25,
        pdfFilename: 'full-test.pdf',
        errorMessage: null,
        reviewPages: [1, 5, 10],
        pipelineStep: 'ocr',
        ocrModel: 'custom-ocr-model',
        layoutModel: 'custom-layout-model',
      };

      await createJob(env.DB, jobData);

      const request = new Request('http://localhost/editor/job_full_test');
      const event = createRequestEvent({
        request,
        locals: { user },
        params: { jobId: 'job_full_test' },
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (await load(toServerLoadEvent<any>(event))) as { job: Job };

      expect(result.job.id).toBe('job_full_test');
      expect(result.job.userId).toBe(user.id);
      expect(result.job.status).toBe('processing');
      expect(result.job.pdfKey).toBe(`uploads/${user.id}/full-test.pdf`);
      expect(result.job.epubKey).toBeNull();
      expect(result.job.templateId).toBeNull();
      expect(result.job.pdfPageCount).toBe(25);
      expect(result.job.pdfFilename).toBe('full-test.pdf');
      expect(result.job.errorMessage).toBeNull();
      expect(result.job.reviewPages).toEqual([1, 5, 10]);
      expect(result.job.pipelineStep).toBe('ocr');
      expect(result.job.ocrModel).toBe('custom-ocr-model');
      expect(result.job.layoutModel).toBe('custom-layout-model');
      expect(result.job.createdAt).toBeDefined();
      expect(result.job.updatedAt).toBeDefined();
    });
  });
});
