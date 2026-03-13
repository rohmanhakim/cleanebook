/**
 * Handler tests for Job Creation API
 * Tests the route handler directly using real CF bindings (D1, R2)
 * Uses @cloudflare/vitest-pool-workers for bindings but NOT SELF.fetch()
 */
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createRequestEvent, createMockUser, toHandlerEvent } from '../../helpers/request-event';
import {
  handleCreateJob,
  generateJobId,
  validatePdfOwnership,
  checkConversionLimit,
  checkPdfExists,
} from '$lib/server/job';
import { createAnonymousUser, getUserById, getJobById } from '$lib/server/db';
import type { CreateJobRequest } from '$lib/server/job';

describe('Job Creation API Handler Tests', () => {
  describe('Utility Functions', () => {
    describe('generateJobId', () => {
      it('should generate job ID with job_ prefix', () => {
        const id = generateJobId();
        expect(id.startsWith('job_')).toBe(true);
      });

      it('should generate unique IDs', () => {
        const id1 = generateJobId();
        const id2 = generateJobId();
        expect(id1).not.toBe(id2);
      });
    });

    describe('validatePdfOwnership', () => {
      it('should return true for matching user ID', () => {
        const userId = 'anon_test123';
        const pdfKey = `uploads/${userId}/abc.pdf`;
        expect(validatePdfOwnership(pdfKey, userId)).toBe(true);
      });

      it('should return false for different user ID', () => {
        const pdfKey = 'uploads/anon_other/abc.pdf';
        const userId = 'anon_test123';
        expect(validatePdfOwnership(pdfKey, userId)).toBe(false);
      });

      it('should return false for malformed key', () => {
        expect(validatePdfOwnership('invalid-key', 'anon_test123')).toBe(false);
      });
    });

    describe('checkConversionLimit', () => {
      it('should allow anonymous user under limit', () => {
        const user = createMockUser({ plan: 'anonymous', conversionsTotal: 0 });
        const result = checkConversionLimit(user);
        expect(result.allowed).toBe(true);
      });

      it('should block anonymous user at limit', () => {
        const user = createMockUser({ plan: 'anonymous', conversionsTotal: 1 });
        const result = checkConversionLimit(user);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Anonymous users are limited');
      });

      it('should allow free user under monthly limit', () => {
        const user = createMockUser({ plan: 'free', conversionsThisMonth: 2 });
        const result = checkConversionLimit(user);
        expect(result.allowed).toBe(true);
      });

      it('should block free user at monthly limit', () => {
        const user = createMockUser({ plan: 'free', conversionsThisMonth: 3 });
        const result = checkConversionLimit(user);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('monthly limit');
      });

      it('should allow reader user under monthly limit', () => {
        const user = createMockUser({ plan: 'reader', conversionsThisMonth: 39 });
        const result = checkConversionLimit(user);
        expect(result.allowed).toBe(true);
      });

      it('should block reader user at monthly limit', () => {
        const user = createMockUser({ plan: 'reader', conversionsThisMonth: 40 });
        const result = checkConversionLimit(user);
        expect(result.allowed).toBe(false);
      });

      it('should always allow collector user (unlimited)', () => {
        const user = createMockUser({ plan: 'collector', conversionsThisMonth: 1000 });
        const result = checkConversionLimit(user);
        expect(result.allowed).toBe(true);
      });
    });

    describe('checkPdfExists', () => {
      it('should return false for non-existent key', async () => {
        const exists = await checkPdfExists(env.R2, 'nonexistent/file.pdf');
        expect(exists).toBe(false);
      });

      it('should return true for existing key', async () => {
        // First, upload a file
        const key = 'uploads/test-user/test-exists.pdf';
        await env.R2.put(key, new Uint8Array([1, 2, 3]));

        const exists = await checkPdfExists(env.R2, key);
        expect(exists).toBe(true);

        // Cleanup
        await env.R2.delete(key);
      });
    });
  });

  describe('POST handler - Auth checks', () => {
    it('should return 401 when handler called directly without user', async () => {
      const body: CreateJobRequest = {
        pdfKey: 'uploads/test/test.pdf',
        pdfFilename: 'test.pdf',
        pdfPageCount: 1,
      };

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const event = createRequestEvent({
        request,
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
        await handleCreateJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(401);
      }
    });
  });

  describe('POST handler - Request validation', () => {
    it('should return 400 for missing required fields', async () => {
      const user = createMockUser({ plan: 'anonymous' });

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Empty body
      });

      const event = createRequestEvent({
        request,
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
        await handleCreateJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(400);
      }
    });

    it('should return 400 for invalid JSON', async () => {
      const user = createMockUser({ plan: 'anonymous' });

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      const event = createRequestEvent({
        request,
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
        await handleCreateJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(400);
      }
    });
  });

  describe('POST handler - PDF validation', () => {
    it('should return 404 for non-existent PDF in R2', async () => {
      const user = createMockUser({ plan: 'anonymous' });

      const body: CreateJobRequest = {
        pdfKey: `uploads/${user.id}/nonexistent.pdf`,
        pdfFilename: 'test.pdf',
        pdfPageCount: 1,
      };

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const event = createRequestEvent({
        request,
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
        await handleCreateJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(404);
      }
    });

    it('should return 403 for PDF owned by different user', async () => {
      const user = createMockUser({ plan: 'anonymous' });
      const otherUserId = 'anon_otheruser123456789012';

      // Upload a PDF owned by different user
      const pdfKey = `uploads/${otherUserId}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      const body: CreateJobRequest = {
        pdfKey,
        pdfFilename: 'test.pdf',
        pdfPageCount: 1,
      };

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const event = createRequestEvent({
        request,
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
        await handleCreateJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(403);
      } finally {
        await env.R2.delete(pdfKey);
      }
    });
  });

  describe('POST handler - Conversion limits', () => {
    it('should return 403 for anonymous user at conversion limit', async () => {
      const user = createMockUser({ plan: 'anonymous', conversionsTotal: 1 });

      // Upload a PDF for this user
      const pdfKey = `uploads/${user.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      const body: CreateJobRequest = {
        pdfKey,
        pdfFilename: 'test.pdf',
        pdfPageCount: 1,
      };

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const event = createRequestEvent({
        request,
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
        await handleCreateJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(403);
      } finally {
        await env.R2.delete(pdfKey);
      }
    });

    it('should return 403 for free user at monthly limit', async () => {
      const user = createMockUser({ plan: 'free', conversionsThisMonth: 3 });

      // Upload a PDF for this user
      const pdfKey = `uploads/${user.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      const body: CreateJobRequest = {
        pdfKey,
        pdfFilename: 'test.pdf',
        pdfPageCount: 1,
      };

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const event = createRequestEvent({
        request,
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
        await handleCreateJob(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(403);
      } finally {
        await env.R2.delete(pdfKey);
      }
    });
  });

  describe('POST handler - Successful job creation', () => {
    it('should create job and return 200 with jobId', async () => {
      // Create a real user in D1
      const dbUser = await createAnonymousUser(env.DB);

      // Upload a PDF for this user
      const pdfKey = `uploads/${dbUser.id}/test.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      const body: CreateJobRequest = {
        pdfKey,
        pdfFilename: 'test.pdf',
        pdfPageCount: 5,
      };

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const event = createRequestEvent({
        request,
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

      const response = await handleCreateJob(toHandlerEvent(event));

      expect(response.status).toBe(200);

      const data = (await response.json()) as { jobId: string; status: string };
      expect(data).toHaveProperty('jobId');
      expect(data.jobId).toMatch(/^job_/);
      expect(data.status).toBe('queued');

      // Verify job was created in D1
      const job = await getJobById(env.DB, data.jobId);
      expect(job).not.toBeNull();
      expect(job?.userId).toBe(dbUser.id);
      expect(job?.pdfKey).toBe(pdfKey);
      expect(job?.pdfFilename).toBe('test.pdf');
      expect(job?.pdfPageCount).toBe(5);
      expect(job?.status).toBe('queued');

      // Verify conversion counter was incremented
      const updatedUser = await getUserById(env.DB, dbUser.id);
      expect(updatedUser?.conversionsTotal).toBe(1);

      // Cleanup
      await env.R2.delete(pdfKey);
    });

    it('should create job with default models', async () => {
      // Create a real user in D1
      const dbUser = await createAnonymousUser(env.DB);

      // Upload a PDF for this user
      const pdfKey = `uploads/${dbUser.id}/test-models.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      const body: CreateJobRequest = {
        pdfKey,
        pdfFilename: 'test.pdf',
        pdfPageCount: 1,
      };

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const event = createRequestEvent({
        request,
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

      const response = await handleCreateJob(toHandlerEvent(event));
      const data = (await response.json()) as { jobId: string };

      // Verify job has default models
      const job = await getJobById(env.DB, data.jobId);
      expect(job?.ocrModel).toBe('lightonai/LightOnOCR-2-1B');
      expect(job?.layoutModel).toBe('microsoft/layoutlmv3-base');

      // Cleanup
      await env.R2.delete(pdfKey);
    });

    it('should create job with custom models', async () => {
      // Create a real user in D1
      const dbUser = await createAnonymousUser(env.DB);

      // Upload a PDF for this user
      const pdfKey = `uploads/${dbUser.id}/test-custom.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      const body: CreateJobRequest = {
        pdfKey,
        pdfFilename: 'test.pdf',
        pdfPageCount: 1,
        ocrModel: 'custom/ocr-model',
        layoutModel: 'custom/layout-model',
      };

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const event = createRequestEvent({
        request,
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

      const response = await handleCreateJob(toHandlerEvent(event));
      const data = (await response.json()) as { jobId: string };

      // Verify job has custom models
      const job = await getJobById(env.DB, data.jobId);
      expect(job?.ocrModel).toBe('custom/ocr-model');
      expect(job?.layoutModel).toBe('custom/layout-model');

      // Cleanup
      await env.R2.delete(pdfKey);
    });

    it('should increment conversionsThisMonth for registered users', async () => {
      // Create an anonymous user first, then update to free plan
      const dbUser = await createAnonymousUser(env.DB);

      // Update to free plan (simulating a registered user)
      await env.DB.prepare('UPDATE users SET plan = ?, is_anonymous = 0, email = ? WHERE id = ?')
        .bind('free', 'test@example.com', dbUser.id)
        .run();

      // Upload a PDF for this user
      const pdfKey = `uploads/${dbUser.id}/test-registered.pdf`;
      await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

      const body: CreateJobRequest = {
        pdfKey,
        pdfFilename: 'test.pdf',
        pdfPageCount: 1,
      };

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Get updated user
      const freeUser = await getUserById(env.DB, dbUser.id);

      const event = createRequestEvent({
        request,
        locals: { user: { ...freeUser!, isAnonymous: false } },
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      const response = await handleCreateJob(toHandlerEvent(event));
      expect(response.status).toBe(200);

      // Verify conversionsThisMonth was incremented
      const updatedUser = await getUserById(env.DB, dbUser.id);
      expect(updatedUser?.conversionsThisMonth).toBe(1);

      // Cleanup
      await env.R2.delete(pdfKey);
    });
  });
});
