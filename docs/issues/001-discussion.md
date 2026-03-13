For **SvelteKit deployed to Cloudflare Workers**, the cleanest testing strategy is to **separate tests by layer** instead of trying to test everything through the Worker runtime (`SELF.fetch`). The current setup forces every integration test through:

```
Vitest
  ↓
@cloudflare/vitest-pool-workers
  ↓
SELF.fetch()
  ↓
Cloudflare Worker runtime
  ↓
SvelteKit request pipeline
  ↓
Route handler
```

This is fragile because:

* Worker runtime is slow to start
* request context differs from Node
* headers/origin behave differently
* framework middleware (CSRF, hooks) interferes
* debugging hangs is painful (like our current issue)

A cleaner architecture is **three-layer testing**.

---

# 1. Recommended Testing Architecture

```
                ┌─────────────────────────┐
                │ 1. Unit Tests           │
                │ Pure business logic     │
                │ No SvelteKit            │
                └───────────┬─────────────┘
                            │
                ┌───────────▼─────────────┐
                │ 2. Handler Tests       │
                │ SvelteKit route logic  │
                │ Call POST/GET directly │
                └───────────┬─────────────┘
                            │
                ┌───────────▼─────────────┐
                │ 3. E2E Tests            │
                │ Real Worker + browser   │
                │ Playwright              │
                └─────────────────────────┘
```

Notice what's **missing**:

```
SELF.fetch integration tests
```

Those usually cause more problems than they solve.

---

# 2. Layer 1 — Unit Tests (most tests)

All **business logic** should live outside route handlers.

Example structure:

```
src/
  lib/
    upload/
      validate.ts
      store.ts
      process.ts
```

Example:

```ts
// src/lib/upload/validate.ts
export function validatePdf(file: File) {
  if (file.type !== 'application/pdf') {
    throw new Error('Invalid file type');
  }

  if (file.size > 10_000_000) {
    throw new Error('File too large');
  }
}
```

Test:

```ts
import { validatePdf } from '$lib/upload/validate';

it('rejects non pdf', () => {
  const file = new File(['abc'], 'test.txt', { type: 'text/plain' });

  expect(() => validatePdf(file)).toThrow();
});
```

Benefits:

* fastest tests
* no framework involved
* deterministic

Most tests should live here.

---

# 3. Layer 2 — Route Handler Tests (the sweet spot)

Instead of:

```ts
SELF.fetch('/api/upload')
```

call the handler directly:

```ts
import { POST } from '$routes/api/upload/+server';
```

Example helper:

```ts
function createEvent(request: Request) {
  return {
    request,
    locals: {},
    params: {},
    cookies: {} as any,
    url: new URL(request.url),
    setHeaders() {},
    getClientAddress() {
      return '127.0.0.1';
    },
    platform: {
      env: {
        R2: mockR2,
        DB: mockDB
      }
    }
  };
}
```

Test:

```ts
it('returns 401 without session', async () => {
  const request = new Request('http://localhost/api/upload', {
    method: 'POST',
    body: new FormData()
  });

  const response = await POST(createEvent(request));

  expect(response.status).toBe(401);
});
```

Advantages:

* no Worker runtime
* no CSRF interference
* no port/origin problems
* fast
* tests actual route logic

This layer replaces **most integration tests**.

---

# 4. Layer 3 — Real E2E Tests (few but valuable)

Only a few tests should run the **actual Worker**.

Use **Playwright**.

```
Playwright
  ↓
dev server
  ↓
SvelteKit
  ↓
Cloudflare adapter
```

Example:

```ts
test('upload works', async ({ request }) => {
  const response = await request.post('/api/upload', {
    multipart: {
      file: {
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      }
    }
  });

  expect(response.status()).toBe(200);
});
```

E2E verifies:

* middleware
* cookies
* CSRF
* headers
* routing
* real server

But keep these tests **small in number**.

---

# 5. Ideal Test Distribution

A healthy project usually looks like:

```
Unit tests:       ~70–80%
Handler tests:    ~15–25%
E2E tests:        ~5–10%
```

Example for this project:

```
validatePdf.test.ts
storeUpload.test.ts
processPdf.test.ts
```

```
upload.route.test.ts
download.route.test.ts
```

```
upload.e2e.spec.ts
auth.e2e.spec.ts
```

---

# 6. Project Layout Example

```
tests/
  unit/
    upload/
      validate.test.ts
      process.test.ts

  handler/
    api/
      upload.test.ts

  e2e/
    upload.spec.ts
```

Vitest config:

```
vitest.unit.config.ts
vitest.handler.config.ts
```

Playwright:

```
playwright.config.ts
```

---

# 7. Why avoiding `SELF.fetch()` is important

`SELF.fetch` is problematic because it combines:

* Cloudflare runtime
* SvelteKit adapter
* test environment
* request pipeline

This creates **many moving parts**.

Typical issues:

* hanging requests
* incorrect headers
* cookies not behaving
* streaming bugs
* workers runtime differences

Your CSRF issue is exactly one of those.

---

# 8. Practical rule for SvelteKit APIs

Think of route handlers as **thin controllers**:

```
HTTP layer
    ↓
route handler
    ↓
business logic
```

Test them independently.

---

✅ **Summary**

A cleaner architecture is:

```
Business logic → unit tests
Route handlers → direct handler tests
Full stack → Playwright E2E
```

Avoid relying heavily on:

```
Vitest + Cloudflare worker runtime + SELF.fetch
```

because it introduces **test instability without adding much coverage**.

---