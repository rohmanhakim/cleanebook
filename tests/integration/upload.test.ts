/**
 * Integration tests for Upload API - Bindings and Infrastructure
 * Tests R2 storage, database helpers, and constants directly
 *
 * For route handler tests, see tests/handler/api/upload.test.ts
 * which tests the handler directly without SELF.fetch() to avoid CSRF issues
 *
 * NOTE: PDF fixture validation tests are in tests/handler/api/upload.test.ts
 * This file focuses on binding/infrastructure tests only.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { createAnonymousUser } from '$lib/server/db';
import { PLAN_LIMITS, MAX_PDF_SIZE_BYTES } from '$lib/shared/constants';

// Helper to convert fixture array to ArrayBuffer
function fixtureToArrayBuffer(fixture: number[]): ArrayBuffer {
  return new Uint8Array(fixture).buffer;
}

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
`;

async function setupTestDatabase() {
  await env.DB.batch([env.DB.prepare(CREATE_TABLES_SQL)]);
}

describe('Upload API Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  describe('R2 storage bindings', () => {
    it('should have R2 bucket binding available', async () => {
      expect(env.R2).toBeDefined();
      expect(typeof env.R2.put).toBe('function');
      expect(typeof env.R2.get).toBe('function');
      expect(typeof env.R2.delete).toBe('function');
    });

    it('should store and retrieve file from R2', async () => {
      const user = await createAnonymousUser(env.DB);
      const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_1PAGE);
      const key = `uploads/${user.id}/${crypto.randomUUID()}.pdf`;

      // Store in R2
      await env.R2.put(key, pdfBuffer);

      // Verify it exists
      const object = await env.R2.get(key);
      expect(object).not.toBeNull();
      expect(object?.key).toBe(key);

      // CRITICAL: Consume the response body for isolated storage compatibility
      await object?.arrayBuffer();
    });

    it('should retrieve stored file with same size', async () => {
      const user = await createAnonymousUser(env.DB);
      const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_10PAGES);
      const key = `uploads/${user.id}/${crypto.randomUUID()}.pdf`;

      await env.R2.put(key, pdfBuffer);

      // Retrieve and compare size
      const object = await env.R2.get(key);
      const retrieved = await object?.arrayBuffer();

      expect(retrieved?.byteLength).toBe(pdfBuffer.byteLength);
    });
  });

  describe('Page limits', () => {
    it('should enforce anonymous user page limit (50 pages)', async () => {
      const anonymousLimit = PLAN_LIMITS.anonymous.maxPagesPerPdf;
      expect(anonymousLimit).toBe(50);
    });

    it('should have different limits for each plan', async () => {
      expect(PLAN_LIMITS.anonymous.maxPagesPerPdf).toBe(50);
      expect(PLAN_LIMITS.free.maxPagesPerPdf).toBe(100);
      expect(PLAN_LIMITS.reader.maxPagesPerPdf).toBe(500);
      expect(PLAN_LIMITS.collector.maxPagesPerPdf).toBe(Infinity);
    });
  });

  describe('File size limits', () => {
    it('should have correct max file size constant', async () => {
      expect(MAX_PDF_SIZE_BYTES).toBe(2 * 1024 * 1024); // 2MB
    });

    it('should have fixtures under size limit', async () => {
      expect(env.FIXTURE_PDF_1PAGE.length).toBeLessThan(MAX_PDF_SIZE_BYTES);
      expect(env.FIXTURE_PDF_10PAGES.length).toBeLessThan(MAX_PDF_SIZE_BYTES);
      expect(env.FIXTURE_PDF_51PAGES.length).toBeLessThan(MAX_PDF_SIZE_BYTES);
    });
  });

  describe('Anonymous user flow', () => {
    it('should create anonymous user with correct plan', async () => {
      const user = await createAnonymousUser(env.DB);

      expect(user.isAnonymous).toBe(true);
      expect(user.plan).toBe('anonymous');
      expect(PLAN_LIMITS[user.plan].maxPagesPerPdf).toBe(50);
    });
  });

  describe('R2 key generation', () => {
    it('should generate correct R2 key format', async () => {
      const user = await createAnonymousUser(env.DB);
      const uuid = crypto.randomUUID();
      const key = `uploads/${user.id}/${uuid}.pdf`;

      // Key should match pattern: uploads/{userId}/{uuid}.pdf
      expect(key).toMatch(/^uploads\/anon_[a-zA-Z0-9_-]{21}\/[a-f0-9-]{36}\.pdf$/);
    });

    it('should generate unique keys for same user', async () => {
      const key1 = `uploads/user123/${crypto.randomUUID()}.pdf`;
      const key2 = `uploads/user123/${crypto.randomUUID()}.pdf`;

      expect(key1).not.toBe(key2);
    });
  });

  // NOTE: POST /api/upload endpoint tests have been moved to tests/handler/api/upload.test.ts
  // This file now only contains binding/infrastructure tests
});
