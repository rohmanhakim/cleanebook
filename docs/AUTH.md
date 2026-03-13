<!--
Document Version: 1.1.0
Last Updated: 2026-03-13
Source Commits:
  - db54a309112fc82caa76fbebdaecf29d0c01baa1 (Task 1C - Auth Infrastructure)
Changes:
  - Updated validateSessionToken() with complete SQL query and column aliasing
  - Updated hooks.server.ts with ANON_SESSION_ROUTES and error handling
  - Updated User object to use rowToUser() helper with prefix
  - Added anonymous user fields: isAnonymous, conversionsTotal, polarCustomerId
-->
# CleanEbook — Authentication

## Development Gating (Basic Auth)

During the development phase, the entire frontend is gated with HTTP Basic Authentication to prevent unauthorized access. This is separate from the user authentication system.

### How It Works

The `src/hooks.server.ts` checks for `BASIC_AUTH_USER` environment variable:
- If set, all requests must include valid Basic Auth credentials
- If not set, the gate is disabled and the site is publicly accessible

### Configuration

**Local Development** — Add to `.dev.vars`:
```
BASIC_AUTH_USER=your_username
BASIC_AUTH_PASSWORD=your_password
```

**Production** — Set via wrangler for **both environments**:

```bash
source ~/.nvm/nvm.sh

# For production environment (Git integration deployments)
wrangler pages secret put BASIC_AUTH_USER
wrangler pages secret put BASIC_AUTH_PASSWORD

# For preview environment (direct upload deployments)
wrangler pages secret put BASIC_AUTH_USER --env preview
wrangler pages secret put BASIC_AUTH_PASSWORD --env preview
```

**Note**: Cloudflare Pages has separate `production` and `preview` environments. Secrets must be set for each environment separately. Direct uploads via `wrangler pages deploy` create preview deployments, so they use `preview` environment secrets.

### Disabling the Gate

When the application is ready for public access, remove the secrets:
```bash
source ~/.nvm/nvm.sh
wrangler pages secret delete BASIC_AUTH_USER
wrangler pages secret delete BASIC_AUTH_PASSWORD
```

### For AI Agents

AI agents can access gated routes by including credentials in requests:
```bash
curl -u "username:password" https://cleanebook.pages.dev/api/...
```

---

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
import { rowToUser } from './db';

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

  // Important: Use explicit column aliasing for JOIN queries
  // Each column from users table needs u_ prefix for rowToUser() mapper
  const row = await db
    .prepare(`
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

  // Use rowToUser helper with prefix for cleaner code
  const user = rowToUser(row, 'u_');

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
import {
  validateSessionToken,
  getSessionTokenFromCookies,
  generateSessionToken,
  createSession,
  setSessionCookie,
} from '$lib/server/auth';
import { createAnonymousUser } from '$lib/server/db';

// Routes where we should auto-create an anonymous session
// (avoids creating throwaway anon users for every bot/crawler hit)
const ANON_SESSION_ROUTES = ['/editor', '/api/upload', '/api/job'];

export const handle: Handle = async ({ event, resolve }) => {
  // Basic Auth gating - only active if BASIC_AUTH_USER is configured
  // Check both CF bindings (production) and process.env (dev/CI)
  const platform = event.platform;
  const basicAuthUser = platform?.env?.BASIC_AUTH_USER ?? process.env.BASIC_AUTH_USER;
  const basicAuthPassword = platform?.env?.BASIC_AUTH_PASSWORD ?? process.env.BASIC_AUTH_PASSWORD;

  if (basicAuthUser && basicAuthPassword) {
    const authHeader = event.request.headers.get('Authorization');

    if (!authHeader || !isValidBasicAuth(authHeader, basicAuthUser, basicAuthPassword)) {
      return new Response(null, {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="CleanEbook Development", charset="UTF-8"',
        },
      });
    }
  }

  // Session validation - check for existing session cookie
  const token = getSessionTokenFromCookies(event.request.headers.get('cookie'));

  if (token && platform?.env?.DB) {
    const result = await validateSessionToken(platform.env.DB, token);
    event.locals.user = result?.user ?? null;
  } else {
    event.locals.user = null;
  }

  // Resolve the response first
  const response = await resolve(event);

  // Lazy anonymous user creation - only on routes that represent real interactions
  // This prevents flooding D1 with bot traffic from marketing page hits
  if (!event.locals.user && platform?.env?.DB) {
    const path = event.url.pathname;
    const shouldCreateAnon = ANON_SESSION_ROUTES.some((r) => path.startsWith(r));

    if (shouldCreateAnon) {
      try {
        // Create anonymous user and session
        const anonUser = await createAnonymousUser(platform.env.DB);
        const sessionToken = generateSessionToken();
        await createSession(platform.env.DB, anonUser.id, sessionToken);

        // Set user in locals for this request
        event.locals.user = anonUser;

        // Set cookie on the response
        response.headers.append('Set-Cookie', setSessionCookie(sessionToken));
      } catch (error) {
        // Log but don't fail the request - user will remain null
        console.error('Failed to create anonymous user:', error);
      }
    }
  }

  return response;
};

/**
 * Validates Basic Auth credentials from the Authorization header
 */
function isValidBasicAuth(
  authHeader: string,
  expectedUser: string,
  expectedPassword: string
): boolean {
  if (!authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    return username === expectedUser && password === expectedPassword;
  } catch {
    return false;
  }
}
```

**Why lazy anonymous creation matters:** Creating an anonymous user on every `/` page load would flood D1 with bot traffic and make the cleanup cron expensive. By deferring creation until a real upload or editor interaction, each anonymous user record represents genuine engagement.

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

---

## Anonymous → Registered Account Claim Flow

When an anonymous user completes a conversion and clicks "Download EPUB",
they see a signup prompt. On successful signup, their anonymous account is
**claimed** — converted in-place to a real account, preserving all job history.

```
Anonymous user sees "Create a free account to download"
  → fills in email + password (or OAuth)
  → POST /register with anonUserId in body (or derived from session)

/register action:
  1. Validate email not already taken
  2. Hash password
  3. claimAnonymousUser(db, locals.user.id, { email, name, passwordHash })
     → UPDATE users SET email=?, name=?, password_hash=?, plan='free', is_anonymous=0
     → All existing jobs remain (user_id unchanged)
  4. Session cookie already valid — no new session needed
  5. redirect(303, `/editor/${jobId}?download=true`)

Editor page sees download=true query param
  → immediately triggers EPUB download
```

**Key implementation detail:** `claimAnonymousUser()` does NOT create a new user
row. It updates the existing `anon_*` row in-place. The `id` stays the same,
which means all `jobs.user_id` foreign keys remain valid automatically.
No data migration needed.

### Register page must handle both flows

```typescript
// src/routes/(auth)/register/+page.server.ts
export const actions = {
  default: async ({ request, locals, platform }) => {
    const form = await superValidate(request, zod(registerSchema));
    if (!form.valid) return fail(400, { form });

    const db = platform!.env.DB;
    const { email, password, name } = form.data;

    // Check if email already exists
    const existing = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email).first();
    if (existing) return message(form, 'Email already in use', { status: 400 });

    const passwordHash = await hashPassword(password);

    if (locals.user?.isAnonymous) {
      // Claim path — convert existing anonymous user
      await claimAnonymousUser(db, locals.user.id, { email, name, passwordHash });
    } else {
      // Fresh signup — create new user
      const id = generateId('usr');
      await db.prepare(`
        INSERT INTO users (id, email, name, password_hash, conversions_reset_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(id, email, name, passwordHash).run();
      // Create new session
      const token = generateSessionToken();
      await createSession(db, id, token);
      // Cookie set in hooks via locals — return token via header
    }

    const redirectTo = form.data.redirectTo ?? '/dashboard';
    redirect(303, redirectTo);
  }
};
```
