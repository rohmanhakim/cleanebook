# Learning: Upload API (Task 1E)

**Date:** 2026-03-13
**Phase:** 001 - Anonymous User Upload Flow
**Task:** 1E - Upload API

---

## What Was Implemented

Task 1E implemented the PDF Upload API endpoint for anonymous and registered users. This task also established the **standard pattern for backend API endpoints with testing** that should be followed for all future API routes.

### Files Created/Modified

1. **`src/lib/shared/constants.ts`** (Modified)
   - Added `MAX_PDF_SIZE_BYTES = 2 * 1024 * 1024` (2MB limit)

2. **`src/lib/server/upload.ts`** (Created)
   - Business logic for PDF upload, validation, and R2 storage
   - Exported `handleUpload` RequestHandler for route and testing

3. **`src/routes/api/upload/+server.ts`** (Created)
   - Thin wrapper that delegates to `handleUpload`

4. **`vitest.handler.config.ts`** (Created)
   - New config for handler tests with CF bindings

5. **`vitest.integration.config.ts`** (Modified)
   - Added fixture file loading as test bindings

6. **`tests/helpers/request-event.ts`** (Created)
   - Reusable test utilities for handler testing

7. **`tests/handler/api/upload.test.ts`** (Created)
   - Handler tests for upload functionality

8. **`tests/integration/upload.test.ts`** (Modified)
   - Refocused on bindings/infrastructure tests only

9. **`tests/integration/types.d.ts`** (Modified)
   - Added type definitions for fixture bindings

10. **`src/app.d.ts`** (Modified)
    - Added `VITEST?: boolean` binding for test mode

11. **`svelte.config.js`** (Modified)
    - Added `$routes` alias for route imports

12. **`package.json`** (Modified)
    - Added `test:handler` script

---

## Standard Pattern for Backend API Endpoints

This task established the following pattern that should be used for all future backend API endpoints. The key insight is that we **avoid `SELF.fetch()` integration tests** because they combine too many moving parts (Worker runtime, SvelteKit adapter, CSRF, hooks) and cause hard-to-debug hangs.

### Three-Layer Testing Architecture

```
                ┌─────────────────────────┐
                │ 1. Unit Tests           │
                │ Pure business logic     │
                │ No SvelteKit            │
                └───────────┬─────────────┘
                            │
                ┌───────────▼─────────────┐
                │ 2. Handler Tests        │
                │ SvelteKit route logic   │
                │ Call POST/GET directly  │
                └───────────┬─────────────┘
                            │
                ┌───────────▼─────────────┐
                │ 3. E2E Tests            │
                │ Real Worker + browser   │
                │ Playwright              │
                └─────────────────────────┘
```

### Step-by-Step Implementation Guide

#### 1. Create Business Logic in `$lib/server/`

Extract logic from the route file into a separate module. This enables direct testing without the HTTP stack.

```typescript
// src/lib/server/upload.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

// Export typed response interface
export interface UploadResponse {
  key: string;
  filename: string;
  pageCount: number;
  sizeBytes: number;
}

// Export utility functions for unit testing
export function validatePdfMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 5));
  const header = String.fromCharCode(...bytes);
  return header === '%PDF-';
}

// Export handler for route and testing
export const handleUpload: RequestHandler = async ({ request, locals, platform }) => {
  // Implementation here...
  return json(response);
};
```

#### 2. Create Thin Route Wrapper

The route file should be minimal - just re-export the handler.

```typescript
// src/routes/api/upload/+server.ts
import type { RequestHandler } from './$types';
import { handleUpload } from '$lib/server/upload';

export const POST: RequestHandler = handleUpload;
```

#### 3. Create Handler Test Utilities

Use the standard test helpers in `tests/helpers/request-event.ts`:

```typescript
import { createRequestEvent, createMockUser, toHandlerEvent } from '../../helpers/request-event';

// Create a mock user (no database queries needed)
const user = createMockUser({ plan: 'anonymous' });

// Create a Request
const request = new Request('http://localhost/api/upload', {
  method: 'POST',
  body: formData,
});

// Create RequestEvent with all required SvelteKit properties
const event = createRequestEvent({
  request,
  locals: { user },
  platform: { env: { DB: env.DB, R2: env.R2, ... } },
});

// Call handler directly
const response = await handleUpload(toHandlerEvent(event));
```

#### 4. Handle SvelteKit Errors in Tests

SvelteKit's `error()` function throws, so tests need try/catch:

```typescript
it('should return 401 for request without user', async () => {
  const event = createRequestEvent({
    request,
    locals: { user: null },
    platform: { env: { ... } },
  });

  try {
    await handleUpload(toHandlerEvent(event));
    expect.fail('Expected error to be thrown');
  } catch (err) {
    // SvelteKit error has status property
    expect((err as { status: number }).status).toBe(401);
  }
});
```

#### 5. Configure Fixtures in Vitest Config

Load binary fixtures at config time and convert to arrays for JSON compatibility:

```typescript
// vitest.handler.config.ts
import { readFile } from 'node:fs/promises';

function bufferToArray(buffer: Buffer): number[] {
  return Array.from(buffer);
}

const fixturesPath = path.join(__dirname, 'tests/fixtures');
const [pdf1page, ...] = await Promise.all([
  readFile(path.join(fixturesPath, 'pdfs/sample-1page.pdf')),
  // ...
]);

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        miniflare: {
          bindings: {
            FIXTURE_PDF_1PAGE: bufferToArray(pdf1page),
            // ...
          },
        },
      },
    },
  },
});
```

Convert back to ArrayBuffer in tests:

```typescript
function fixtureToArrayBuffer(fixture: number[]): ArrayBuffer {
  return new Uint8Array(fixture).buffer;
}
```

#### 6. Disable Basic Auth in Tests

Set `VITEST=true` in the config to disable Basic Auth in `hooks.server.ts`:

```typescript
// vitest.handler.config.ts
process.env.VITEST = 'true';
```

The hooks.server.ts checks this:

```typescript
// src/hooks.server.ts
const basicAuthUser = platform?.env?.BASIC_AUTH_USER ?? process.env.BASIC_AUTH_USER;
// If VITEST=true, BASIC_AUTH_USER should not be set
```

---

## Upload API Endpoint

### Endpoint

```
POST /api/upload
Content-Type: multipart/form-data

Request Body:
  file: <PDF file>

Response (200 OK):
  {
    "key": "uploads/{userId}/{uuid}.pdf",
    "filename": "document.pdf",
    "pageCount": 42,
    "sizeBytes": 1024000
  }
```

### Validation Steps

1. **Auth check** - User must exist (anonymous users auto-created by `hooks.server.ts`)
2. **Form parsing** - Extract `file` field from multipart form
3. **File presence** - Return 400 if no file provided
4. **File size** - Return 413 if file exceeds `MAX_PDF_SIZE_BYTES`
5. **PDF magic bytes** - Return 400 if first 5 bytes aren't `%PDF-`
6. **Page count** - Extract using `pdfjs-serverless`, return 400 on parse failure
7. **Page limit** - Return 403 if page count exceeds plan limit
8. **R2 storage** - Store file at `uploads/{userId}/{uuid}.pdf`

### R2 Key Format

```
uploads/{userId}/{uuid}.pdf

Examples:
- uploads/anon_abc123.../550e8400-e29b-41d4-a716-446655440000.pdf
- uploads/usr_def456.../660f9511-f30c-52e5-b827-557766551111.pdf
```

---

## Key Technical Decisions

### 1. pdfjs-serverless for Page Count

Used `pdfjs-serverless` instead of `pdfjs-dist` because:
- `pdfjs-dist` is for client-side only (per STACK.md)
- Workers runtime requires serverless-compatible PDF parsing

```typescript
import { getDocument } from 'pdfjs-serverless';

async function getPdfPageCount(buffer: ArrayBuffer): Promise<number> {
  const pdf = await getDocument({ data: buffer }).promise;
  return pdf.numPages;
}
```

### 2. Filename Sanitization

Minimal sanitization preserving readability:

```typescript
function sanitizeFilename(name: string): string {
  return name
    .replace(/\x00/g, '') // Remove null bytes
    .replace(/[\x00-\x1f\x80-\x9f]/g, '') // Remove control chars
    .replace(/\.\./g, '') // Prevent path traversal
    .replace(/[<>:"|?*]/g, '') // Remove invalid filesystem chars
    .slice(0, 255); // Limit length
}
```

### 3. Test Fixtures as Bindings

Fixtures loaded at config time and passed as bindings:

```typescript
// vitest.handler.config.ts
const [pdf1page, ...] = await Promise.all([
  readFile(path.join(fixturesPath, 'pdfs/sample-1page.pdf')),
  // ...
]);

miniflare: {
  bindings: {
    FIXTURE_PDF_1PAGE: bufferToArray(pdf1page),
    // ...
  },
}
```

### 4. R2 Isolated Storage Fix

Must consume R2 response body in tests:

```typescript
// CRITICAL: Consume the response body for isolated storage compatibility
const object = await env.R2.get(key);
await object?.arrayBuffer(); // Must consume!
```

---

## CSRF Issue Resolution

Initially, integration tests using `SELF.fetch()` from `@cloudflare/vitest-pool-workers` were hanging due to SvelteKit's CSRF protection. This was documented in `docs/issues/001-api-testing-csrf-issue.md`.

**Solution:** We adopted the handler test pattern instead:
- Call route handlers directly without going through the HTTP stack
- Create mock `RequestEvent` objects with test helpers
- This avoids CSRF entirely while still testing the full handler logic

See `docs/TESTING.md` for the complete testing architecture.

---

## Test Results

```
Unit Tests: 25 passed
Handler Tests: 16 passed (upload handler)
Integration Tests: 35 passed (bindings: 5 + auth: 10 + db: 12 + upload: 8)
Total: 76 tests passing
```

---

## Test Fixtures Structure

```
tests/fixtures/
├── pdfs/
│   ├── sample-1page.pdf    # Basic valid PDF
│   ├── sample-10pages.pdf  # Multi-page PDF
│   └── sample-51pages.pdf  # Exceeds anonymous limit (51 > 50)
└── invalid/
    └── not-a-pdf.txt       # Non-PDF file for validation tests
```

---

## Checklist for Future API Endpoints

When implementing a new API endpoint, follow this checklist:

- [ ] Create business logic in `src/lib/server/{feature}.ts`
- [ ] Export `handle{Feature}` RequestHandler
- [ ] Export utility functions for unit testing
- [ ] Create thin route wrapper in `src/routes/api/{feature}/+server.ts`
- [ ] Create handler tests in `tests/handler/api/{feature}.test.ts`
- [ ] Use `createRequestEvent` and `toHandlerEvent` from test helpers
- [ ] Use `createMockUser` for tests that don't need database
- [ ] Handle SvelteKit errors with try/catch
- [ ] Add fixtures to `vitest.handler.config.ts` if needed
- [ ] Keep integration tests focused on bindings/infrastructure only
- [ ] Update `tests/integration/types.d.ts` with new fixture types

---

## Next Steps

Task 1F will implement:
- Job Creation API (`POST /api/job/create`)
- Conversion limit enforcement
- Job record creation in D1
