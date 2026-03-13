/**
 * Handler tests for Job Status API
 * Tests the route handler directly using real CF bindings (D1, R2)
 * Uses @cloudflare/vitest-pool-workers for bindings but NOT SELF.fetch()
 */
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createRequestEvent, createMockUser, toHandlerEvent } from '../../helpers/request-event';
import {
  handleGetJob,
  handleCancelJob,
  validateJobOwnership,
  isTerminalState,
  type JobStatusResponse,
  type CancelJobResponse,
} from '$lib/server/job-status';
import { createAnonymousUser, getJobById, createJob } from '$lib/server/db';
import type { JobStatus } from '$lib/shared/types';

describe('Job Status API Handler Tests', () => {
  describe('Utility Functions', () => {
    describe('validateJobOwnership', () => {
      it('should return true for matching user ID', () => {
        const job = {
          id: 'job_test123',
          userId: 'anon_user123',
          status: 'queued' as JobStatus,
          pdfKey: 'uploads/anon_user123/test.pdf',
          epubKey: null,
          templateId: null,
          pdfPageCount: 10,
          pdfFilename: 'test.pdf',
          errorMessage: null,
          reviewPages: null,
          pipelineStep: null,
          ocrModel: 'lightonai/LightOnOCR-2-1B',
          layoutModel: 'microsoft/layoutlmv3-base',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        expect(validateJobOwnership(job, 'anon_user123')).toBe(true);
      });

      it('should return false for different user ID', () => {
        const job = {
          id: 'job_test123',
          userId: 'anon_user123',
          status: 'queued' as JobStatus,
          pdfKey: 'uploads/anon_user123/test.pdf',
          epubKey: null,
          templateId: null,
          pdfPageCount: 10,
          pdfFilename: 'test.pdf',
          errorMessage: null,
          reviewPages: null,
          pipelineStep: null,
          ocrModel: 'lightonai/LightOnOCR-2-1B',
          layoutModel: 'microsoft/layoutlmv3-base',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        expect(validateJobOwnership(job, 'anon_otheruser')).toBe(false);
      });
    });

    describe('isTerminalState', () => {
      it('should return true for complete status', () => {
        expect(isTerminalState('complete')).toBe(true);
      });

      it('should return true for failed status', () => {
        expect(isTerminalState('failed')).toBe(true);
      });

      it('should return true for cancelled status', () => {
        expect(isTerminalState('cancelled')).toBe(true);
      });

      it('should return false for queued status', () => {
        expect(isTerminalState('queued')).toBe(false);
      });

      it('should return false for processing status', () => {
        expect(isTerminalState('processing')).toBe(false);
      });

      it('should return false for needs_review status', () => {
        expect(isTerminalState('needs_review')).toBe(false);
      });

      it('should return false for resuming status', () => {
        expect(isTerminalState('resuming')).toBe(false);
      });
    });
  });

  describe('GET handler - Auth checks', () => {
    it('should return 401 when handler called directly without user', async () => {
      const request = new Request('http://localhost/api/job/job_test123', {
        method: 'GET',
      });

      const event = createRequestEvent({
        request,
        params: { id: 'job_test123' },
        locals: { user: null },
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
        await handleGetJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(401);
      }
    });
  });

  describe('GET handler - Job retrieval', () => {
    it('should return 404 for non-existent job', async () => {
      const user = createMockUser();

      const request = new Request('http://localhost/api/job/job_nonexistent', {
        method: 'GET',
      });

      const event = createRequestEvent({
        request,
        params: { id: 'job_nonexistent' },
        locals: { user },
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
        await handleGetJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(404);
      }
    });

    it('should return 403 for job owned by different user', async () => {
      // Create user and job
      const dbUser = await createAnonymousUser(env.DB);
      const jobId = 'job_test123';

      // Upload PDF and create job
      const pdfKey = `uploads/${dbUser.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      await createJob(env.DB, {
        id: jobId,
        userId: dbUser.id,
        status: 'queued',
        pdfKey,
        epubKey: null,
        templateId: null,
        pdfPageCount: 5,
        pdfFilename: 'test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      });

      // Try to access with different user
      const otherUser = createMockUser({ id: 'anon_otheruser123456789012' });

      const request = new Request(`http://localhost/api/job/${jobId}`, {
        method: 'GET',
      });

      const event = createRequestEvent({
        request,
        params: { id: jobId },
        locals: { user: otherUser },
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
        await handleGetJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(403);
      } finally {
        await env.R2.delete(pdfKey);
      }
    });

    it('should return 200 with job data for valid request', async () => {
      // Create user and job
      const dbUser = await createAnonymousUser(env.DB);
      const jobId = 'job_gettest';

      // Upload PDF and create job
      const pdfKey = `uploads/${dbUser.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      await createJob(env.DB, {
        id: jobId,
        userId: dbUser.id,
        status: 'queued',
        pdfKey,
        epubKey: null,
        templateId: null,
        pdfPageCount: 10,
        pdfFilename: 'document.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      });

      const request = new Request(`http://localhost/api/job/${jobId}`, {
        method: 'GET',
      });

      const event = createRequestEvent({
        request,
        params: { id: jobId },
        locals: { user: { ...dbUser, isAnonymous: dbUser.isAnonymous } },
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      const response = await handleGetJob(toHandlerEvent(event));

      expect(response.status).toBe(200);

      const data = (await response.json()) as JobStatusResponse;
      expect(data.id).toBe(jobId);
      expect(data.status).toBe('queued');
      expect(data.pdfFilename).toBe('document.pdf');
      expect(data.pdfPageCount).toBe(10);
      expect(data.pdfKey).toBe(pdfKey);
      expect(data.epubKey).toBeNull();
      expect(data.templateId).toBeNull();
      expect(data.errorMessage).toBeNull();
      expect(data.reviewPages).toBeNull();
      expect(data.pipelineStep).toBeNull();
      expect(data.ocrModel).toBe('lightonai/LightOnOCR-2-1B');
      expect(data.layoutModel).toBe('microsoft/layoutlmv3-base');
      // userId should NOT be in response
      expect(data).not.toHaveProperty('userId');

      // Cleanup
      await env.R2.delete(pdfKey);
    });
  });

  describe('DELETE handler - Auth checks', () => {
    it('should return 401 when handler called directly without user', async () => {
      const request = new Request('http://localhost/api/job/job_test123', {
        method: 'DELETE',
      });

      const event = createRequestEvent({
        request,
        params: { id: 'job_test123' },
        locals: { user: null },
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
        await handleCancelJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(401);
      }
    });
  });

  describe('DELETE handler - Job cancellation', () => {
    it('should return 404 for non-existent job', async () => {
      const user = createMockUser();

      const request = new Request('http://localhost/api/job/job_nonexistent', {
        method: 'DELETE',
      });

      const event = createRequestEvent({
        request,
        params: { id: 'job_nonexistent' },
        locals: { user },
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
        await handleCancelJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(404);
      }
    });

    it('should return 403 for job owned by different user', async () => {
      // Create user and job
      const dbUser = await createAnonymousUser(env.DB);
      const jobId = 'job_canceltest1';

      // Upload PDF and create job
      const pdfKey = `uploads/${dbUser.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      await createJob(env.DB, {
        id: jobId,
        userId: dbUser.id,
        status: 'queued',
        pdfKey,
        epubKey: null,
        templateId: null,
        pdfPageCount: 5,
        pdfFilename: 'test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      });

      // Try to cancel with different user
      const otherUser = createMockUser({ id: 'anon_otheruser123456789012' });

      const request = new Request(`http://localhost/api/job/${jobId}`, {
        method: 'DELETE',
      });

      const event = createRequestEvent({
        request,
        params: { id: jobId },
        locals: { user: otherUser },
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
        await handleCancelJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(403);
      } finally {
        await env.R2.delete(pdfKey);
      }
    });

    it('should return 400 for complete job (terminal state)', async () => {
      // Create user and job
      const dbUser = await createAnonymousUser(env.DB);
      const jobId = 'job_complete1';

      // Upload PDF and create job
      const pdfKey = `uploads/${dbUser.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      await createJob(env.DB, {
        id: jobId,
        userId: dbUser.id,
        status: 'complete',
        pdfKey,
        epubKey: 'epubs/user/job.epub',
        templateId: null,
        pdfPageCount: 5,
        pdfFilename: 'test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      });

      const request = new Request(`http://localhost/api/job/${jobId}`, {
        method: 'DELETE',
      });

      const event = createRequestEvent({
        request,
        params: { id: jobId },
        locals: { user: { ...dbUser, isAnonymous: dbUser.isAnonymous } },
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
        await handleCancelJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(400);
      } finally {
        await env.R2.delete(pdfKey);
      }
    });

    it('should return 400 for failed job (terminal state)', async () => {
      // Create user and job
      const dbUser = await createAnonymousUser(env.DB);
      const jobId = 'job_failed1';

      // Upload PDF and create job
      const pdfKey = `uploads/${dbUser.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      await createJob(env.DB, {
        id: jobId,
        userId: dbUser.id,
        status: 'failed',
        pdfKey,
        epubKey: null,
        templateId: null,
        pdfPageCount: 5,
        pdfFilename: 'test.pdf',
        errorMessage: 'OCR failed',
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      });

      const request = new Request(`http://localhost/api/job/${jobId}`, {
        method: 'DELETE',
      });

      const event = createRequestEvent({
        request,
        params: { id: jobId },
        locals: { user: { ...dbUser, isAnonymous: dbUser.isAnonymous } },
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
        await handleCancelJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(400);
      } finally {
        await env.R2.delete(pdfKey);
      }
    });

    it('should return 400 for already cancelled job (terminal state)', async () => {
      // Create user and job
      const dbUser = await createAnonymousUser(env.DB);
      const jobId = 'job_cancelled1';

      // Upload PDF and create job
      const pdfKey = `uploads/${dbUser.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      await createJob(env.DB, {
        id: jobId,
        userId: dbUser.id,
        status: 'cancelled',
        pdfKey,
        epubKey: null,
        templateId: null,
        pdfPageCount: 5,
        pdfFilename: 'test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      });

      const request = new Request(`http://localhost/api/job/${jobId}`, {
        method: 'DELETE',
      });

      const event = createRequestEvent({
        request,
        params: { id: jobId },
        locals: { user: { ...dbUser, isAnonymous: dbUser.isAnonymous } },
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
        await handleCancelJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(400);
      } finally {
        await env.R2.delete(pdfKey);
      }
    });

    it('should cancel queued job and return 200', async () => {
      // Create user and job
      const dbUser = await createAnonymousUser(env.DB);
      const jobId = 'job_cancelqueued';

      // Upload PDF and create job
      const pdfKey = `uploads/${dbUser.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      await createJob(env.DB, {
        id: jobId,
        userId: dbUser.id,
        status: 'queued',
        pdfKey,
        epubKey: null,
        templateId: null,
        pdfPageCount: 5,
        pdfFilename: 'test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: null,
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      });

      const request = new Request(`http://localhost/api/job/${jobId}`, {
        method: 'DELETE',
      });

      const event = createRequestEvent({
        request,
        params: { id: jobId },
        locals: { user: { ...dbUser, isAnonymous: dbUser.isAnonymous } },
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      const response = await handleCancelJob(toHandlerEvent(event));

      expect(response.status).toBe(200);

      const data = (await response.json()) as CancelJobResponse;
      expect(data.id).toBe(jobId);
      expect(data.status).toBe('cancelled');

      // Verify job was updated in D1
      const job = await getJobById(env.DB, jobId);
      expect(job?.status).toBe('cancelled');

      // Cleanup
      await env.R2.delete(pdfKey);
    });

    it('should cancel processing job and return 200', async () => {
      // Create user and job
      const dbUser = await createAnonymousUser(env.DB);
      const jobId = 'job_cancelprocessing';

      // Upload PDF and create job
      const pdfKey = `uploads/${dbUser.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      await createJob(env.DB, {
        id: jobId,
        userId: dbUser.id,
        status: 'processing',
        pdfKey,
        epubKey: null,
        templateId: null,
        pdfPageCount: 5,
        pdfFilename: 'test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: 'ocr',
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      });

      const request = new Request(`http://localhost/api/job/${jobId}`, {
        method: 'DELETE',
      });

      const event = createRequestEvent({
        request,
        params: { id: jobId },
        locals: { user: { ...dbUser, isAnonymous: dbUser.isAnonymous } },
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      const response = await handleCancelJob(toHandlerEvent(event));

      expect(response.status).toBe(200);

      const data = (await response.json()) as CancelJobResponse;
      expect(data.id).toBe(jobId);
      expect(data.status).toBe('cancelled');

      // Verify job was updated in D1
      const job = await getJobById(env.DB, jobId);
      expect(job?.status).toBe('cancelled');

      // Cleanup
      await env.R2.delete(pdfKey);
    });

    it('should cancel needs_review job and return 200', async () => {
      // Create user and job
      const dbUser = await createAnonymousUser(env.DB);
      const jobId = 'job_cancelreview';

      // Upload PDF and create job
      const pdfKey = `uploads/${dbUser.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      await createJob(env.DB, {
        id: jobId,
        userId: dbUser.id,
        status: 'needs_review',
        pdfKey,
        epubKey: null,
        templateId: null,
        pdfPageCount: 5,
        pdfFilename: 'test.pdf',
        errorMessage: null,
        reviewPages: [3, 7],
        pipelineStep: 'review',
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      });

      const request = new Request(`http://localhost/api/job/${jobId}`, {
        method: 'DELETE',
      });

      const event = createRequestEvent({
        request,
        params: { id: jobId },
        locals: { user: { ...dbUser, isAnonymous: dbUser.isAnonymous } },
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      const response = await handleCancelJob(toHandlerEvent(event));

      expect(response.status).toBe(200);

      const data = (await response.json()) as CancelJobResponse;
      expect(data.id).toBe(jobId);
      expect(data.status).toBe('cancelled');

      // Verify job was updated in D1
      const job = await getJobById(env.DB, jobId);
      expect(job?.status).toBe('cancelled');

      // Cleanup
      await env.R2.delete(pdfKey);
    });

    it('should cancel resuming job and return 200', async () => {
      // Create user and job
      const dbUser = await createAnonymousUser(env.DB);
      const jobId = 'job_cancelresuming';

      // Upload PDF and create job
      const pdfKey = `uploads/${dbUser.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      await createJob(env.DB, {
        id: jobId,
        userId: dbUser.id,
        status: 'resuming',
        pdfKey,
        epubKey: null,
        templateId: null,
        pdfPageCount: 5,
        pdfFilename: 'test.pdf',
        errorMessage: null,
        reviewPages: null,
        pipelineStep: 'resuming',
        ocrModel: 'lightonai/LightOnOCR-2-1B',
        layoutModel: 'microsoft/layoutlmv3-base',
      });

      const request = new Request(`http://localhost/api/job/${jobId}`, {
        method: 'DELETE',
      });

      const event = createRequestEvent({
        request,
        params: { id: jobId },
        locals: { user: { ...dbUser, isAnonymous: dbUser.isAnonymous } },
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      const response = await handleCancelJob(toHandlerEvent(event));

      expect(response.status).toBe(200);

      const data = (await response.json()) as CancelJobResponse;
      expect(data.id).toBe(jobId);
      expect(data.status).toBe('cancelled');

      // Verify job was updated in D1
      const job = await getJobById(env.DB, jobId);
      expect(job?.status).toBe('cancelled');

      // Cleanup
      await env.R2.delete(pdfKey);
    });
  });
});
