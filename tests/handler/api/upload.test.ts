/**
 * Handler tests for Upload API
 * Tests the route handler directly using real CF bindings (D1, R2)
 * Uses @cloudflare/vitest-pool-workers for bindings but NOT SELF.fetch()
 *
 * NOTE: These tests use mock users (createMockUser) and don't query D1.
 * Database setup is not needed since the handler only validates locals.user.
 */
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { createRequestEvent, createMockUser, toHandlerEvent } from '../../helpers/request-event';

// Import the upload handler from $lib/server
import { handleUpload } from '$lib/server/upload';

// Helper to convert fixture array to ArrayBuffer
function fixtureToArrayBuffer(fixture: number[]): ArrayBuffer {
  return new Uint8Array(fixture).buffer;
}

describe('Upload API Handler Tests', () => {
  describe('Handler imports', () => {
    it('should have handleUpload exported', () => {
      expect(handleUpload).toBeDefined();
      expect(typeof handleUpload).toBe('function');
    });
  });

  describe('PDF fixtures validation', () => {
    it('should have valid PDF magic bytes in 1-page fixture', async () => {
      const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_1PAGE);
      const bytes = new Uint8Array(pdfBuffer.slice(0, 5));
      const header = String.fromCharCode(...bytes);

      expect(header).toBe('%PDF-');
    });

    it('should have valid PDF magic bytes in 10-page fixture', async () => {
      const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_10PAGES);
      const bytes = new Uint8Array(pdfBuffer.slice(0, 5));
      const header = String.fromCharCode(...bytes);

      expect(header).toBe('%PDF-');
    });

    it('should have valid PDF magic bytes in 51-page fixture', async () => {
      const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_51PAGES);
      const bytes = new Uint8Array(pdfBuffer.slice(0, 5));
      const header = String.fromCharCode(...bytes);

      expect(header).toBe('%PDF-');
    });

    it('should NOT have PDF magic bytes in non-PDF fixture', async () => {
      const nonPdfBuffer = fixtureToArrayBuffer(env.FIXTURE_NOT_A_PDF);
      const bytes = new Uint8Array(nonPdfBuffer.slice(0, 5));
      const header = String.fromCharCode(...bytes);

      expect(header).not.toBe('%PDF-');
    });
  });

  describe('POST handler - Auth checks', () => {
    it('should return 401 when handler called directly without user (defensive - hooks.server.ts normally creates anon user)', async () => {
      const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_1PAGE);
      const formData = new FormData();
      formData.append('file', new Blob([pdfBuffer]), 'test.pdf');

      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
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
            VITEST: true,
          },
        },
      });

      // SvelteKit's error() throws, so we need to catch it
      try {
        await handleUpload(toHandlerEvent(event));
        // Should not reach here
        expect.fail('Expected error to be thrown');
      } catch (err) {
        // SvelteKit error has status property
        expect((err as { status: number }).status).toBe(401);
      }
    });
  });

  describe('POST handler - File validation', () => {
    it('should return 400 for missing file field', async () => {
      const user = createMockUser({ plan: 'anonymous' });
      const formData = new FormData();
      // No file added

      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
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
            VITEST: true,
          },
        },
      });

      try {
        await handleUpload(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(400);
      }
    });

    it('should return 400 for invalid PDF (non-PDF file)', async () => {
      const user = createMockUser({ plan: 'anonymous' });
      const nonPdfBuffer = fixtureToArrayBuffer(env.FIXTURE_NOT_A_PDF);
      const formData = new FormData();
      formData.append('file', new Blob([nonPdfBuffer]), 'not-a-pdf.txt');

      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
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
            VITEST: true,
          },
        },
      });

      try {
        await handleUpload(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(400);
      }
    });
  });

  describe('POST handler - Plan limits', () => {
    it('should return 403 for PDF exceeding page limit (anonymous user)', async () => {
      const user = createMockUser({ plan: 'anonymous' });
      // 51-page PDF exceeds anonymous limit of 50
      const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_51PAGES);
      const formData = new FormData();
      formData.append('file', new Blob([pdfBuffer]), 'large.pdf');

      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
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
            VITEST: true,
          },
        },
      });

      try {
        await handleUpload(toHandlerEvent(event));
        expect.fail('Expected error to be thrown');
      } catch (err) {
        expect((err as { status: number }).status).toBe(403);
      }
    });
  });

  describe('POST handler - Successful uploads', () => {
    it('should return 200 with correct response for valid PDF upload', async () => {
      const user = createMockUser({ plan: 'anonymous' });
      const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_1PAGE);
      const formData = new FormData();
      formData.append('file', new Blob([pdfBuffer]), 'test.pdf');

      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
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
            VITEST: true,
          },
        },
      });

      const response = await handleUpload(toHandlerEvent(event));

      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        key: string;
        filename: string;
        pageCount: number;
        sizeBytes: number;
      };
      expect(data).toHaveProperty('key');
      expect(data).toHaveProperty('filename');
      expect(data).toHaveProperty('pageCount');
      expect(data).toHaveProperty('sizeBytes');
      expect(data.key).toMatch(/^uploads\/anon_test123456789012345\/[a-f0-9-]{36}\.pdf$/);
      expect(data.pageCount).toBe(1);
      expect(data.sizeBytes).toBe(pdfBuffer.byteLength);

      // Clean up R2
      await env.R2.delete(data.key);
    });

    it('should return 200 for 10-page PDF (within anonymous limit)', async () => {
      const user = createMockUser({ plan: 'anonymous' });
      const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_10PAGES);
      const formData = new FormData();
      formData.append('file', new Blob([pdfBuffer]), 'test.pdf');

      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
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
            VITEST: true,
          },
        },
      });

      const response = await handleUpload(toHandlerEvent(event));

      expect(response.status).toBe(200);

      const data = (await response.json()) as { pageCount: number; key: string };
      expect(data.pageCount).toBe(10);

      // Clean up R2
      await env.R2.delete(data.key);
    });
  });

  describe('R2 storage integration', () => {
    it('should actually store file in R2', async () => {
      const user = createMockUser({ plan: 'anonymous' });
      const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_1PAGE);
      const formData = new FormData();
      formData.append('file', new Blob([pdfBuffer]), 'stored-test.pdf');

      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
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
            VITEST: true,
          },
        },
      });

      const response = await handleUpload(toHandlerEvent(event));
      const data = (await response.json()) as { key: string };

      // Verify file is actually in R2
      const stored = await env.R2.get(data.key);
      expect(stored).not.toBeNull();
      expect(stored?.key).toBe(data.key);

      // Consume body for isolated storage compatibility
      await stored?.arrayBuffer();

      // Clean up
      await env.R2.delete(data.key);
    });
  });
});
