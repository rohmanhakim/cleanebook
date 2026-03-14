/**
 * Integration tests for hooks.server.ts
 * Tests the SvelteKit handle function's anonymous user creation behavior
 *
 * Key test: Verifies that anonymous users are created BEFORE resolve(),
 * not after. This is critical because route handlers depend on locals.user
 * being populated when they run.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import type { RequestEvent, Handle } from '@sveltejs/kit';
import type { TestUser } from '../helpers/request-event';
import { handle } from '../../src/hooks.server';
import { createRequestEvent } from '../helpers/request-event';
import { sessionTokenToId } from '$lib/server/auth';

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

// Sentinel value to track if resolve was called
const NOT_CAPTURED = Symbol('NOT_CAPTURED');

// Type for the handle function parameters
type HandleParams = Parameters<Handle>[0];

describe('hooks.server.ts - Anonymous user creation timing', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  describe('First-time visitor (no session cookie)', () => {
    it('should create anonymous user BEFORE resolve for /api/upload path', async () => {
      // Track what locals.user looks like at resolve time
      let userAtResolveTime: TestUser | null | typeof NOT_CAPTURED = NOT_CAPTURED;

      // Mock resolve function that captures locals.user at call time
      const mockResolve = async (event: RequestEvent) => {
        userAtResolveTime = event.locals.user as TestUser | null;
        return new Response(null, { status: 200 });
      };

      // Create request event with no session (fresh visitor)
      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
      });

      const event = createRequestEvent({
        request,
        locals: { user: null }, // No existing session
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      // Execute the handle function (cast to HandleParams for type compatibility)
      const response = await handle({
        event: event as unknown as HandleParams['event'],
        resolve: mockResolve,
      });

      // CRITICAL ASSERTION: user should exist at resolve time
      // This test WILL FAIL with current implementation (bug)
      expect(userAtResolveTime).not.toBe(NOT_CAPTURED);
      expect(userAtResolveTime).not.toBeNull();
      expect((userAtResolveTime as unknown as TestUser)?.isAnonymous).toBe(true);
      expect((userAtResolveTime as unknown as TestUser)?.plan).toBe('anonymous');

      // Cookie should be set on response
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('session=');
      expect(setCookie).toContain('HttpOnly');
    });

    it('should create anonymous user BEFORE resolve for /editor/* paths', async () => {
      let userAtResolveTime: TestUser | null | typeof NOT_CAPTURED = NOT_CAPTURED;

      const mockResolve = async (event: RequestEvent) => {
        userAtResolveTime = event.locals.user as TestUser | null;
        return new Response(null, { status: 200 });
      };

      const request = new Request('http://localhost/editor/job_123', {
        method: 'GET',
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

      const response = await handle({
        event: event as unknown as HandleParams['event'],
        resolve: mockResolve,
      });

      // User should exist at resolve time
      expect(userAtResolveTime).not.toBe(NOT_CAPTURED);
      expect(userAtResolveTime).not.toBeNull();
      expect((userAtResolveTime as unknown as TestUser)?.isAnonymous).toBe(true);

      // Cookie should be set
      expect(response.headers.get('Set-Cookie')).toContain('session=');
    });

    it('should create anonymous user BEFORE resolve for /api/job/* paths', async () => {
      let userAtResolveTime: TestUser | null | typeof NOT_CAPTURED = NOT_CAPTURED;

      const mockResolve = async (event: RequestEvent) => {
        userAtResolveTime = event.locals.user as TestUser | null;
        return new Response(null, { status: 200 });
      };

      const request = new Request('http://localhost/api/job/create', {
        method: 'POST',
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

      await handle({
        event: event as unknown as HandleParams['event'],
        resolve: mockResolve,
      });

      expect(userAtResolveTime).not.toBe(NOT_CAPTURED);
      expect(userAtResolveTime).not.toBeNull();
      expect((userAtResolveTime as unknown as TestUser)?.isAnonymous).toBe(true);
    });
  });

  describe('Marketing routes (should NOT create anon user)', () => {
    it('should NOT create anonymous user for / (landing page)', async () => {
      let userAtResolveTime: TestUser | null | typeof NOT_CAPTURED = NOT_CAPTURED;

      const mockResolve = async (event: RequestEvent) => {
        userAtResolveTime = event.locals.user as TestUser | null;
        return new Response(null, { status: 200 });
      };

      const request = new Request('http://localhost/', {
        method: 'GET',
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

      const response = await handle({
        event: event as unknown as HandleParams['event'],
        resolve: mockResolve,
      });

      // User should remain null for marketing routes
      expect(userAtResolveTime).not.toBe(NOT_CAPTURED);
      expect(userAtResolveTime).toBeNull();

      // No cookie should be set
      expect(response.headers.get('Set-Cookie')).toBeNull();
    });

    it('should NOT create anonymous user for /pricing', async () => {
      let userAtResolveTime: TestUser | null | typeof NOT_CAPTURED = NOT_CAPTURED;

      const mockResolve = async (event: RequestEvent) => {
        userAtResolveTime = event.locals.user as TestUser | null;
        return new Response(null, { status: 200 });
      };

      const request = new Request('http://localhost/pricing', {
        method: 'GET',
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

      const response = await handle({
        event: event as unknown as HandleParams['event'],
        resolve: mockResolve,
      });

      expect(userAtResolveTime).not.toBe(NOT_CAPTURED);
      expect(userAtResolveTime).toBeNull();
      expect(response.headers.get('Set-Cookie')).toBeNull();
    });
  });

  describe('Existing session (should NOT create new anon user)', () => {
    it('should use existing session user and not create new anon user', async () => {
      // First, create an anonymous user directly in DB
      const existingUserId = 'anon_existing_test_user';
      await env.DB.prepare(
        'INSERT INTO users (id, name, role, plan, is_anonymous, conversions_reset_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(existingUserId, 'Existing User', 'user', 'anonymous', 1, new Date().toISOString())
        .run();

      // Create a session for this user
      // IMPORTANT: The session ID in DB must be the HASHED token, not the raw token
      const rawToken = 'test-session-id-for-existing-user';
      const hashedSessionId = sessionTokenToId(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(hashedSessionId, existingUserId, expiresAt.toISOString())
        .run();

      let userAtResolveTime: TestUser | null | typeof NOT_CAPTURED = NOT_CAPTURED;
      let dbUserCountBefore = -1;

      const mockResolve = async (event: RequestEvent) => {
        // Count users in DB at resolve time
        const countResult = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
        dbUserCountBefore = countResult?.count as number;
        userAtResolveTime = event.locals.user as TestUser | null;
        return new Response(null, { status: 200 });
      };

      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
        headers: {
          Cookie: `session=${rawToken}`,
        },
      });

      const event = createRequestEvent({
        request,
        locals: { user: null }, // Will be populated by session validation
        platform: {
          env: {
            DB: env.DB,
            R2: env.R2,
            KV: env.KV,
            QUEUE: env.QUEUE,
          },
        },
      });

      await handle({
        event: event as unknown as HandleParams['event'],
        resolve: mockResolve,
      });

      // Count users after handle
      const countResultAfter = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
      const dbUserCountAfter = countResultAfter?.count as number;

      // Should use existing user, not create new one
      expect(userAtResolveTime).not.toBe(NOT_CAPTURED);
      expect(userAtResolveTime).not.toBeNull();
      expect((userAtResolveTime as unknown as TestUser)?.id).toBe(existingUserId);
      expect(dbUserCountAfter).toBe(dbUserCountBefore); // No new user created
    });
  });

  describe('User persistence', () => {
    it('should persist anonymous user in database', async () => {
      const mockResolve = async () => {
        return new Response(null, { status: 200 });
      };

      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
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

      await handle({
        event: event as unknown as HandleParams['event'],
        resolve: mockResolve,
      });

      // Verify user was created in database
      const users = await env.DB.prepare('SELECT * FROM users WHERE is_anonymous = 1').all();
      expect(users.results.length).toBeGreaterThan(0);
    });

    it('should persist session in database with correct user association', async () => {
      const mockResolve = async () => {
        return new Response(null, { status: 200 });
      };

      const request = new Request('http://localhost/api/upload', {
        method: 'POST',
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

      await handle({
        event: event as unknown as HandleParams['event'],
        resolve: mockResolve,
      });

      // Verify session was created and linked to user
      const result = await env.DB.prepare(
        'SELECT s.id, s.user_id, u.is_anonymous FROM sessions s JOIN users u ON s.user_id = u.id WHERE u.is_anonymous = 1'
      ).first();

      expect(result).not.toBeNull();
      expect(result?.user_id).toMatch(/^anon_/);
    });
  });
});
