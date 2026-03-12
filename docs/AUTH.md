# CleanEbook — Authentication

## Important: No lucia

`lucia` is deprecated. Do NOT install it. Auth is implemented manually using:
- `@oslojs/crypto` — HMAC, SHA-256, random bytes
- `@oslojs/encoding` — base64url encoding for session IDs
- `arctic` — OAuth 2.0 (GitHub, Google)

Sessions are stored in D1. Cookies are HTTP-only, Secure, SameSite=Lax.

---

## Session Flow

```
1. User submits login form
2. +page.server.ts action validates credentials
3. createSession(db, userId) → random session ID → insert into sessions table
4. Set cookie: session=<sessionId>; HttpOnly; Secure; SameSite=Lax; Path=/

5. On every request: hooks.server.ts reads cookie
6. validateSession(db, sessionId) → user row or null
7. Sets locals.user = user (or null)

8. Route guards in +layout.server.ts check locals.user
```

---

## src/lib/server/auth.ts

```typescript
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import type { D1Database } from '@cloudflare/workers-types';
import type { User, Session } from '$lib/shared/types';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Session ID generation ──────────────────────────────────────────

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase64url(bytes);
}

export function sessionTokenToId(token: string): string {
  // Hash the token before storing — token in cookie, hash in DB
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

// ── Session CRUD ──────────────────────────────────────────────────

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

export async function validateSessionToken(
  db: D1Database,
  token: string
): Promise<{ session: Session; user: User } | null> {
  const sessionId = sessionTokenToId(token);

  const row = await db
    .prepare(`
      SELECT s.id, s.user_id, s.expires_at,
             u.id as u_id, u.email, u.name, u.role, u.plan,
             u.hf_api_key_encrypted, u.conversions_this_month, u.conversions_reset_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `)
    .bind(sessionId)
    .first<Record<string, unknown>>();

  if (!row) return null;

  const expiresAt = new Date(row.expires_at as string);

  if (Date.now() >= expiresAt.getTime()) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    return null;
  }

  // Extend session if it's past halfway
  if (Date.now() >= expiresAt.getTime() - SESSION_DURATION_MS / 2) {
    const newExpiry = new Date(Date.now() + SESSION_DURATION_MS);
    await db
      .prepare("UPDATE sessions SET expires_at = ? WHERE id = ?")
      .bind(newExpiry.toISOString(), sessionId)
      .run();
  }

  const session: Session = {
    id: sessionId,
    userId: row.user_id as string,
    expiresAt,
  };

  const user: User = {
    id: row.u_id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as User['role'],
    plan: row.plan as User['plan'],
    hfApiKeyEncrypted: row.hf_api_key_encrypted as string | null,
    conversionsThisMonth: row.conversions_this_month as number,
    conversionsResetAt: row.conversions_reset_at as string,
    createdAt: '',
  };

  return { session, user };
}

export async function invalidateSession(db: D1Database, token: string): Promise<void> {
  const sessionId = sessionTokenToId(token);
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

// ── Cookie helpers ────────────────────────────────────────────────

export function setSessionCookie(token: string): string {
  const expires = new Date(Date.now() + SESSION_DURATION_MS);
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function getSessionTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}
```

---

## src/hooks.server.ts

```typescript
import type { Handle } from '@sveltejs/kit';
import { validateSessionToken, getSessionTokenFromCookies } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const token = getSessionTokenFromCookies(event.request.headers.get('cookie'));

  if (token) {
    const result = await validateSessionToken(event.platform!.env.DB, token);
    if (result) {
      event.locals.user = result.user;
    } else {
      event.locals.user = null;
    }
  } else {
    event.locals.user = null;
  }

  return resolve(event);
};
```

---

## Route Guards

```typescript
// src/routes/(app)/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
  }
  return { user: locals.user };
};
```

```typescript
// src/routes/(admin)/+layout.server.ts
import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, '/login');
  if (locals.user.role !== 'admin') error(403, 'Forbidden');
  return { user: locals.user };
};
```

---

## OAuth with Arctic (GitHub example)

```typescript
// src/lib/server/oauth.ts
import { GitHub } from 'arctic';

export function getGitHubClient(env: App.Platform['env']) {
  return new GitHub(
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
    `${env.PUBLIC_BASE_URL}/login/github/callback`
  );
}
```

OAuth routes:
- `GET /login/github` → redirect to GitHub
- `GET /login/github/callback` → exchange code, upsert user, create session

---

## Password Hashing

Use `@oslojs/crypto` with Argon2 via WASM or bcrypt.
For MVP simplicity, use the Web Crypto API with PBKDF2 (available in all Workers):

```typescript
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const saltHex = encodeHexLowerCase(salt);
  const hashHex = encodeHexLowerCase(new Uint8Array(hash));
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  // ... reverse the above process and compare
}
```
