/**
 * Integration tests for auth module D1-dependent functions
 * Uses Cloudflare Workers pool for real D1 bindings
 *
 * Note: Integration tests run in isolated runtimes with fresh databases.
 * Tables must be created within each test run.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import {
  generateSessionToken,
  sessionTokenToId,
  createSession,
  validateSessionToken,
  invalidateSession,
} from '$lib/server/auth';
import { createAnonymousUser, getUserById } from '$lib/server/db';

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

describe('Auth D1 Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  describe('createSession', () => {
    it('should create a session in the database', async () => {
      // Create anonymous user first
      const user = await createAnonymousUser(env.DB);

      // Create session
      const token = generateSessionToken();
      const session = await createSession(env.DB, user.id, token);

      expect(session.userId).toBe(user.id);
      expect(session.id).toBe(sessionTokenToId(token));
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should store session with correct hash', async () => {
      const user = await createAnonymousUser(env.DB);
      const token = generateSessionToken();
      await createSession(env.DB, user.id, token);

      // Verify session exists with hashed ID
      const sessionId = sessionTokenToId(token);
      const row = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?')
        .bind(sessionId)
        .first();

      expect(row).not.toBeNull();
      expect(row?.user_id).toBe(user.id);
    });
  });

  describe('validateSessionToken', () => {
    it('should return null for invalid token', async () => {
      const result = await validateSessionToken(env.DB, 'invalid-token');
      expect(result).toBeNull();
    });

    it('should return user for valid token', async () => {
      const user = await createAnonymousUser(env.DB);
      const token = generateSessionToken();
      await createSession(env.DB, user.id, token);

      const result = await validateSessionToken(env.DB, token);

      expect(result).not.toBeNull();
      expect(result?.user.id).toBe(user.id);
      expect(result?.user.isAnonymous).toBe(true);
      expect(result?.user.plan).toBe('anonymous');
    });

    it('should return null for expired session', async () => {
      const user = await createAnonymousUser(env.DB);
      const token = generateSessionToken();
      const sessionId = sessionTokenToId(token);

      // Insert expired session
      const expiredDate = new Date(Date.now() - 1000).toISOString(); // 1 second in the past
      await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(sessionId, user.id, expiredDate)
        .run();

      const result = await validateSessionToken(env.DB, token);
      expect(result).toBeNull();

      // Verify session was deleted
      const row = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?')
        .bind(sessionId)
        .first();
      expect(row).toBeNull();
    });
  });

  describe('invalidateSession', () => {
    it('should delete session from database', async () => {
      const user = await createAnonymousUser(env.DB);
      const token = generateSessionToken();
      await createSession(env.DB, user.id, token);

      // Verify session exists
      let result = await validateSessionToken(env.DB, token);
      expect(result).not.toBeNull();

      // Invalidate session
      await invalidateSession(env.DB, token);

      // Verify session is gone
      result = await validateSessionToken(env.DB, token);
      expect(result).toBeNull();
    });
  });

  describe('createAnonymousUser', () => {
    it('should create user with correct defaults', async () => {
      const user = await createAnonymousUser(env.DB);

      expect(user.id).toMatch(/^anon_/);
      expect(user.name).toBe('Anonymous');
      expect(user.role).toBe('user');
      expect(user.plan).toBe('anonymous');
      expect(user.isAnonymous).toBe(true);
      expect(user.conversionsTotal).toBe(0);
      expect(user.conversionsThisMonth).toBe(0);
    });

    it('should persist user in database', async () => {
      const user = await createAnonymousUser(env.DB);

      // Fetch from DB to verify
      const dbUser = await getUserById(env.DB, user.id);

      expect(dbUser).not.toBeNull();
      expect(dbUser?.id).toBe(user.id);
      expect(dbUser?.isAnonymous).toBe(true);
      expect(dbUser?.plan).toBe('anonymous');
    });

    it('should generate unique IDs', async () => {
      const user1 = await createAnonymousUser(env.DB);
      const user2 = await createAnonymousUser(env.DB);

      expect(user1.id).not.toBe(user2.id);
    });
  });

  describe('Full flow', () => {
    it('should support complete session lifecycle', async () => {
      // 1. Create anonymous user
      const user = await createAnonymousUser(env.DB);
      expect(user.isAnonymous).toBe(true);

      // 2. Create session
      const token = generateSessionToken();
      const session = await createSession(env.DB, user.id, token);
      expect(session.userId).toBe(user.id);

      // 3. Validate session
      const result = await validateSessionToken(env.DB, token);
      expect(result?.user.id).toBe(user.id);
      expect(result?.user.isAnonymous).toBe(true);

      // 4. Invalidate session
      await invalidateSession(env.DB, token);
      const afterInvalidate = await validateSessionToken(env.DB, token);
      expect(afterInvalidate).toBeNull();
    });
  });
});
