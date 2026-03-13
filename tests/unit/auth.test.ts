/**
 * Unit tests for auth module pure functions
 * Tests token generation, hashing, and cookie handling
 */
import { describe, it, expect } from 'vitest';
import {
  generateSessionToken,
  sessionTokenToId,
  setSessionCookie,
  clearSessionCookie,
  getSessionTokenFromCookies,
} from '$lib/server/auth';

describe('generateSessionToken', () => {
  it('should generate a base64url encoded string', () => {
    const token = generateSessionToken();

    // Base64url characters: A-Z, a-z, 0-9, -, _ (plus optional = padding)
    expect(token).toMatch(/^[A-Za-z0-9_-]+=*$/);
  });

  it('should generate a token of correct length', () => {
    // 20 bytes encoded as base64url = 27 characters + 1 padding = 28 characters
    const token = generateSessionToken();
    expect(token.length).toBe(28);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSessionToken());
    }
    expect(tokens.size).toBe(100);
  });
});

describe('sessionTokenToId', () => {
  it('should return a lowercase hex string', () => {
    const token = 'test-token-123';
    const id = sessionTokenToId(token);

    // SHA256 produces 32 bytes = 64 hex characters
    expect(id).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce consistent hashes for same input', () => {
    const token = 'my-session-token';
    const id1 = sessionTokenToId(token);
    const id2 = sessionTokenToId(token);

    expect(id1).toBe(id2);
  });

  it('should produce different hashes for different inputs', () => {
    const id1 = sessionTokenToId('token1');
    const id2 = sessionTokenToId('token2');

    expect(id1).not.toBe(id2);
  });

  it('should hash correctly (known test vector)', () => {
    // SHA256 of 'hello' = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    const id = sessionTokenToId('hello');
    expect(id).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});

describe('setSessionCookie', () => {
  it('should return properly formatted Set-Cookie header', () => {
    const token = 'my-session-token';
    const cookie = setSessionCookie(token);

    expect(cookie).toContain('session=my-session-token');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Expires=');
  });

  it('should include future expiry date', () => {
    const cookie = setSessionCookie('token');

    // Extract expiry date from cookie
    const match = cookie.match(/Expires=(.+)/);
    expect(match).not.toBeNull();

    if (match) {
      const expiryDate = new Date(match[1]);
      const now = new Date();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      // Should be approximately 30 days in the future
      const diff = expiryDate.getTime() - now.getTime();
      expect(diff).toBeGreaterThan(thirtyDaysMs - 60000); // within 1 minute tolerance
      expect(diff).toBeLessThan(thirtyDaysMs + 60000);
    }
  });
});

describe('clearSessionCookie', () => {
  it('should return cookie with Max-Age=0', () => {
    const cookie = clearSessionCookie();

    expect(cookie).toContain('session=');
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });
});

describe('getSessionTokenFromCookies', () => {
  it('should return null for null input', () => {
    expect(getSessionTokenFromCookies(null)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(getSessionTokenFromCookies('')).toBeNull();
  });

  it('should extract token from simple cookie string', () => {
    const cookieHeader = 'session=my-token';
    expect(getSessionTokenFromCookies(cookieHeader)).toBe('my-token');
  });

  it('should extract token from multiple cookies', () => {
    const cookieHeader = 'other=value; session=my-token; another=value';
    expect(getSessionTokenFromCookies(cookieHeader)).toBe('my-token');
  });

  it('should handle token at end of cookie string', () => {
    const cookieHeader = 'other=value; session=my-token';
    expect(getSessionTokenFromCookies(cookieHeader)).toBe('my-token');
  });

  it('should handle token with special characters', () => {
    const token = 'abc123_-XYZ';
    const cookieHeader = `session=${token}`;
    expect(getSessionTokenFromCookies(cookieHeader)).toBe(token);
  });

  it('should return null when session cookie not present', () => {
    const cookieHeader = 'other=value; another=value2';
    expect(getSessionTokenFromCookies(cookieHeader)).toBeNull();
  });
});
