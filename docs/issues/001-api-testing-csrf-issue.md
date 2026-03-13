# Issue: API Integration Tests Blocked by SvelteKit CSRF Protection

**Date:** 2026-03-13
**Status:** ✅ Resolved
**Phase:** 001 - Anonymous User Upload Flow
**Task:** 1E - Upload API

---

## Problem Description

Integration tests for the Upload API (`POST /api/upload`) are failing due to SvelteKit's built-in CSRF protection. When using `SELF.fetch()` from `@cloudflare/vitest-pool-workers` to test API endpoints, the requests hang and timeout instead of returning a response.

### Current Test Results

```
Unit Tests: 25 passed ✅
Integration Tests: 49 passed, 1 failed ❌
  - Timeout: "should return 401 for request without session" (5000ms)
  - Remaining tests in same describe block were skipped
```

### Test Code Example

```typescript
// tests/integration/upload.test.ts
it('should return 401 for request without session', async () => {
  const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_1PAGE);
  const formData = new FormData();
  formData.append('file', new Blob([pdfBuffer]), 'test.pdf');

  const response = await SELF.fetch('http://localhost/api/upload', {
    method: 'POST',
    body: formData as any,
    headers: {
      Origin: 'http://localhost',
    },
  });

  expect(response.status).toBe(401);
});
```

---

## Root Cause Analysis

### SvelteKit CSRF Protection

SvelteKit has built-in CSRF (Cross-Site Request Forgery) protection that:
1. Checks the `Origin` header on mutating requests (POST, PUT, DELETE, PATCH)
2. Requires the `Origin` to match the server's origin (protocol, host, port)
3. Returns a 403 Forbidden when origins don't match

### Why Tests Hang Instead of Returning 403

When running in the Cloudflare Workers test pool (`SELF.fetch()`), the request goes through the full SvelteKit stack:
1. `hooks.server.ts` (Basic Auth, session handling)
2. **SvelteKit's CSRF check** ← blocks here
3. The route handler

In the isolated worker runtime, SvelteKit's CSRF check appears to hang rather than returning a proper 403 response. This is likely due to how `@cloudflare/vitest-pool-workers` handles the `SELF.fetch()` call chain.

### Current Architecture

```
vitest.integration.config.ts:
  main: './.svelte-kit/cloudflare/_worker.js'  ← Full SvelteKit worker

SELF.fetch() → Full SvelteKit request pipeline → CSRF check fails → Hang
```

---

## Proposed Solutions

### Option A: Disable CSRF for API Routes (Recommended)

SvelteKit allows configuring CSRF behavior per route.

**Implementation:**

```javascript
// svelte.config.js
export default {
  kit: {
    csrf: {
      checkOrigin: ({ path }) => !path.startsWith('/api/')
    }
  }
};
```

**Pros:**
- Minimal code change (one line)
- Tests work as-is
- API routes with SameSite cookies are inherently protected against CSRF
- Industry standard for SPAs with cookie-based APIs

**Cons:**
- Disables CSRF for all `/api/*` routes
- Requires team agreement on security implications

**Security Considerations:**
- SameSite=Lax cookies (default) already prevent CSRF from third-party sites
- Session cookies are httpOnly and secure
- API endpoints require valid session or create anonymous users on-demand

---

### Option B: Direct Handler Testing

Test route handlers directly without going through the HTTP stack.

**Implementation:**

```typescript
// tests/integration/upload.test.ts
import { POST } from '$routes/api/upload/+server';

it('should return 401 for request without session', async () => {
  const pdfBuffer = fixtureToArrayBuffer(env.FIXTURE_PDF_1PAGE);
  const formData = new FormData();
  formData.append('file', new Blob([pdfBuffer]), 'test.pdf');

  const mockRequest = new Request('http://localhost/api/upload', {
    method: 'POST',
    body: formData,
  });

  const response = await POST({
    request: mockRequest,
    locals: { user: null },
    platform: { env: { R2: env.R2, DB: env.DB } },
    url: new URL('http://localhost/api/upload'),
    params: {},
    cookies: {} as any,
    setHeaders: () => {},
    getClientAddress: () => '127.0.0.1',
  });

  expect(response.status).toBe(401);
});
```

**Pros:**
- True unit testing of API logic
- No CSRF interference
- Faster test execution

**Cons:**
- More test boilerplate
- Doesn't test the full request pipeline
- Must mock all SvelteKit event properties
- Changes would require updating all API tests

---

### Option C: Move API Tests to E2E (Playwright)

Keep integration tests for database/R2 bindings, move HTTP endpoint tests to Playwright.

**Implementation:**

```typescript
// tests/e2e/api/upload.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Upload API', () => {
  test('should return 401 for request without session', async ({ page, request }) => {
    const response = await request.post('/api/upload', {
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('...pdf data...')
        }
      }
    });
    expect(response.status()).toBe(401);
  });
});
```

**Pros:**
- Tests the real browser-to-server flow
- CSRF handled naturally by browser context
- Can test with real PDF files

**Cons:**
- Slower execution
- Different test runner (Playwright vs Vitest)
- Requires dev server running
- More complex CI setup

---

### Option D: Custom Origin Header Matching

Set a test-only origin that SvelteKit will accept.

**Implementation:**

Modify tests to use the exact origin SvelteKit expects:
```typescript
const response = await SELF.fetch('http://localhost:5173/api/upload', {
  // or whatever port/origin the test runner expects
});
```

**Pros:**
- Keeps CSRF protection enabled
- Tests still use `SELF.fetch()`

**Cons:**
- Fragile - depends on internal SvelteKit behavior
- May not be possible to determine correct origin in test context
- Doesn't address the hanging issue

---

## Questions for Team Discussion

1. **Security:** Are we comfortable disabling CSRF for `/api/*` routes given our SameSite cookie approach?

2. **Test Philosophy:** Should integration tests test the full HTTP stack, or is direct handler testing acceptable?

3. **Test Speed vs Coverage:** Is the overhead of E2E tests for API endpoints worth testing the full request pipeline?

4. **Consistency:** Should all API endpoint tests follow the same pattern, or can we mix approaches?

---

## Current State

- **Modified files (uncommitted):**
  - `src/app.d.ts` - Added VITEST binding type
  - `src/lib/shared/constants.ts` - Added MAX_PDF_SIZE_BYTES
  - `tests/integration/types.d.ts` - Added fixture and SELF types
  - `vitest.integration.config.ts` - Added fixtures and main worker config

- **Passing tests:**
  - Unit: 25/25
  - Integration: 49/50 (excluding API endpoint tests)

- **Blocked:**
  - Task 1E: Upload API - Cannot verify POST endpoint behavior
  - Future API endpoint tests will have the same issue

---

## Resolution

**Solution Adopted: Option B (Direct Handler Testing)**

We chose to implement direct handler testing instead of disabling CSRF or using E2E tests. This became the foundation of our three-layer testing architecture.

### Implementation Details

1. **Created `tests/helpers/request-event.ts`** - Reusable test utilities:
   - `createRequestEvent()` - Creates mock SvelteKit RequestEvent
   - `toHandlerEvent()` - Type assertion for handler compatibility
   - `createMockUser()` - Mock user without database queries

2. **Created `vitest.handler.config.ts`** - Separate config for handler tests with CF bindings

3. **Extracted business logic to `$lib/server/`** - Route files are thin wrappers that delegate to handler functions

4. **Updated `docs/TESTING.md`** - Documented the three-layer architecture

### Test Results After Resolution

```
Unit Tests: 25 passed
Handler Tests: 16 passed (upload handler)
Integration Tests: 35 passed (bindings/infrastructure only)
Total: 76 tests passing
```

### Why This Approach

- Tests route handlers directly without HTTP stack
- No CSRF interference
- Uses real CF bindings (D1, R2, KV)
- Faster than E2E tests
- More comprehensive than pure unit tests

### Documentation Updates

- `docs/TESTING.md` - Updated with three-layer architecture
- `docs/learnings/2026-03-13/04-upload-api.md` - Added standard pattern checklist

---

## References

- [SvelteKit CSRF Configuration](https://kit.svelte.dev/docs/configuration#csrf)
- [@cloudflare/vitest-pool-workers Documentation](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)