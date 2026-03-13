# Learning: Authentication Infrastructure (Task 1C)

**Date:** 2026-03-13
**Phase:** 001 - Anonymous User Upload Flow
**Task:** 1C - Authentication Infrastructure

---

## What Was Implemented

Created the complete authentication infrastructure for CleanEbook using `@oslojs/crypto` and `@oslojs/encoding` (NOT lucia - deprecated).

### Files Created/Modified

1. **`src/lib/server/auth.ts`** (Created)
   - `generateSessionToken()` - 20 random bytes, base64url encoded
   - `sessionTokenToId()` - SHA256 hash for DB storage
   - `createSession()` - Insert session into D1
   - `validateSessionToken()` - Validate and return user with session extension
   - `invalidateSession()` - Delete session
   - `setSessionCookie()` / `clearSessionCookie()` - Cookie header helpers
   - `getSessionTokenFromCookies()` - Parse cookie header

2. **`src/lib/server/db.ts`** (Updated)
   - Added `rowToUser()` with proper boolean conversion for SQLite
   - Added `createAnonymousUser()` for lazy anonymous user creation
   - Added `claimAnonymousUser()` for converting anonymous to registered
   - Added `incrementConversionsTotal()` for anonymous user limits

3. **`src/hooks.server.ts`** (Updated)
   - Added session validation from cookie
   - Added lazy anonymous user creation on specific routes (`/api/upload`, `/api/job`, `/editor`)
   - Maintains Basic Auth gating for development

4. **`src/app.d.ts`** (Updated)
   - Extended `Locals.user` type with anonymous user fields

5. **`tests/unit/auth.test.ts`** (Created)
   - Unit tests for pure functions (token generation, hashing, cookies)

6. **`tests/integration/auth.test.ts`** (Created)
   - Integration tests for D1-dependent functions

7. **`vitest.integration.config.ts`** (Updated)
   - Configured `readD1Migrations` and `applyD1Migrations` for test database setup

8. **`tests/integration/apply-migrations.ts`** (Created)
   - Setup file to apply migrations before integration tests

9. **`tests/integration/types.d.ts`** (Updated)
   - Added `TEST_MIGRATIONS` binding and `applyD1Migrations` function types

---

## Key Technical Decisions

### 1. Session Token Hashing

Session tokens are stored as SHA256 hashes in the database, while the raw token is stored in the cookie. This prevents session hijacking if the database is leaked.

### 2. Lazy Anonymous User Creation

Anonymous users are only created on specific routes (`/api/upload`, `/api/job`, `/editor`), not on every page load. This prevents flooding D1 with bot traffic.

### 3. D1 Migration Setup for Integration Tests

Integration tests use `readD1Migrations` and `applyD1Migrations` from `@cloudflare/vitest-pool-workers/config`:

```typescript
// vitest.integration.config.ts
const migrations = await readD1Migrations(migrationsPath);

return {
  test: {
    poolOptions: {
      workers: {
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations }
        }
      }
    },
    setupFiles: ['./tests/integration/apply-migrations.ts']
  }
};

// tests/integration/apply-migrations.ts
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
```

### 4. SQL Column Aliasing for JOIN Queries

When using JOIN queries, columns must be explicitly aliased for the row mapper:

```typescript
// WRONG - column names won't have prefix in result
SELECT u.is_anonymous FROM users u

// CORRECT - explicit alias
SELECT u.is_anonymous as u_is_anonymous FROM users u
```

### 5. Boolean Conversion for SQLite

SQLite stores booleans as INTEGER (0/1). The row mapper handles multiple possible representations:

```typescript
const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1';
  return Boolean(value);
};
```

---

## Test Results

```
Unit Tests: 25 passed
Integration Tests: 13 passed
Total: 38 tests passing
```

---

## Next Steps

Task 1D will implement:
- Full database helper implementations
- Row mappers for Job and Template