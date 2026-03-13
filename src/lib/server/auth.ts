/**
 * Authentication infrastructure for CleanEbook
 * Uses @oslojs/crypto and @oslojs/encoding (NOT lucia - deprecated)
 *
 * Session flow:
 * 1. User interacts with app (upload/editor routes)
 * 2. Anonymous user created lazily in hooks.server.ts
 * 3. Session token generated, hashed, stored in D1
 * 4. Cookie set with raw token (hash in DB, token in cookie)
 */

import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import type { D1Database } from '@cloudflare/workers-types';
import type { User, Session } from '$lib/shared/types';
import { rowToUser } from './db';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Session ID generation ──────────────────────────────────────────

/**
 * Generate a random session token (20 bytes, base64url encoded)
 * This is the value stored in the cookie
 */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase64url(bytes);
}

/**
 * Convert a session token to a session ID for DB storage
 * Uses SHA256 to hash the token - prevents session hijacking if DB is leaked
 */
export function sessionTokenToId(token: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

// ── Session CRUD ──────────────────────────────────────────────────

/**
 * Create a new session in the database
 */
export async function createSession(
  db: D1Database,
  userId: string,
  token: string
): Promise<Session> {
  const sessionId = sessionTokenToId(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, userId, expiresAt.toISOString())
    .run();

  return { id: sessionId, userId, expiresAt };
}

/**
 * Validate a session token and return the associated user
 * Returns null if session is invalid or expired
 * Extends session if past halfway to expiry
 */
export async function validateSessionToken(
  db: D1Database,
  token: string
): Promise<{ session: Session; user: User } | null> {
  const sessionId = sessionTokenToId(token);

  const row = await db
    .prepare(
      `
			SELECT 
				s.id, s.user_id, s.expires_at,
				u.id as u_id, 
				u.email as u_email, 
				u.name as u_name, 
				u.role as u_role, 
				u.plan as u_plan, 
				u.is_anonymous as u_is_anonymous,
				u.hf_api_key_encrypted as u_hf_api_key_encrypted, 
				u.polar_customer_id as u_polar_customer_id,
				u.conversions_this_month as u_conversions_this_month, 
				u.conversions_total as u_conversions_total, 
				u.conversions_reset_at as u_conversions_reset_at,
				u.created_at as u_created_at
			FROM sessions s
			JOIN users u ON s.user_id = u.id
			WHERE s.id = ?
		`
    )
    .bind(sessionId)
    .first<Record<string, unknown>>();

  if (!row) return null;

  const expiresAt = new Date(row.expires_at as string);

  // Check if session has expired
  if (Date.now() >= expiresAt.getTime()) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    return null;
  }

  // Extend session if it's past halfway to expiry
  if (Date.now() >= expiresAt.getTime() - SESSION_DURATION_MS / 2) {
    const newExpiry = new Date(Date.now() + SESSION_DURATION_MS);
    await db
      .prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
      .bind(newExpiry.toISOString(), sessionId)
      .run();
  }

  const session: Session = {
    id: sessionId,
    userId: row.user_id as string,
    expiresAt,
  };

  const user = rowToUser(row, 'u_');

  return { session, user };
}

/**
 * Invalidate (delete) a session from the database
 */
export async function invalidateSession(db: D1Database, token: string): Promise<void> {
  const sessionId = sessionTokenToId(token);
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

// ── Cookie helpers ────────────────────────────────────────────────

/**
 * Generate a Set-Cookie header value for the session cookie
 */
export function setSessionCookie(token: string): string {
  const expires = new Date(Date.now() + SESSION_DURATION_MS);
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}`;
}

/**
 * Generate a Set-Cookie header value that clears the session cookie
 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/**
 * Extract session token from Cookie header
 */
export function getSessionTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}
