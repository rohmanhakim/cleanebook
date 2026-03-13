# Learning: Job Creation API (Task 1F)

**Date:** 2026-03-13
**Phase:** 001 - Anonymous User Upload Flow
**Task:** 1F - Job Creation API

---

## What Was Implemented

Task 1F implemented the Job Creation API endpoint that creates conversion jobs in D1 after validating PDF ownership and conversion limits. This task follows the same three-layer testing pattern established in Task 1E.

### Files Created

1. **`src/lib/server/job.ts`** (Created)
   - Business logic for job creation
   - Exported `handleCreateJob` RequestHandler for route and testing
   - Utility functions: `generateJobId`, `validatePdfOwnership`, `checkPdfExists`, `checkConversionLimit`

2. **`src/routes/api/job/create/+server.ts`** (Created)
   - Thin wrapper that delegates to `handleCreateJob`

3. **`tests/handler/api/job-create.test.ts`** (Created)
   - Handler tests for job creation functionality (25 tests)

---

## API Endpoint

### Request

```
POST /api/job/create
Content-Type: application/json

{
  "pdfKey": "uploads/{userId}/{uuid}.pdf",
  "pdfFilename": "document.pdf",
  "pdfPageCount": 42,
  "templateId": "tpl_abc123",           // optional
  "ocrModel": "custom/ocr-model",       // optional
  "layoutModel": "custom/layout-model"  // optional
}
```

### Response (200 OK)

```json
{
  "jobId": "job_abc123...",
  "status": "queued"
}
```

### Error Responses

| Status | Scenario |
|--------|----------|
| 400 | Missing required fields or invalid JSON |
| 401 | User not authenticated |
| 403 | PDF owned by different user OR conversion limit exceeded |
| 404 | PDF not found in R2 |
| 500 | Failed to create job in D1 |

---

## Validation Steps (in order)

1. **Auth check** - User must exist in `locals.user`
2. **Request body parsing** - Parse JSON and validate required fields
3. **R2 existence check** - `R2.head(pdfKey)` to verify PDF exists
4. **PDF ownership validation** - Verify key starts with `uploads/{userId}/`
5. **Template validation** (future) - If templateId provided, verify ownership
6. **Conversion limit check** - Different logic per plan:
   - `anonymous`: `conversionsTotal < 1`
   - `free`: `conversionsThisMonth < 3`
   - `reader`: `conversionsThisMonth < 40`
   - `collector`: unlimited
7. **Create job in D1** - Insert with `status='queued'`
8. **Increment conversion counters**:
   - Anonymous users: increment `conversionsTotal`
   - Registered users: increment `conversionsThisMonth`

---

## Key Design Decisions

### 1. R2 Existence Check Before Job Creation

We verify the PDF actually exists in R2 before creating the job:

```typescript
export async function checkPdfExists(r2: R2Bucket, key: string): Promise<boolean> {
  const object = await r2.head(key);
  return object !== null;
}
```

This prevents orphaned jobs if the R2 object was deleted between upload and job creation.

### 2. Conversion Limits Increment at Job Creation

Counters are incremented when the job is created (not on completion) because:
- The goal is to limit compute time
- Whether conversion succeeds or fails, the compute was consumed
- Prevents gaming the system by retrying failed conversions

```typescript
// Anonymous users: increment conversionsTotal
if (locals.user.isAnonymous) {
  await incrementConversionsTotal(platform!.env.DB, locals.user.id);
} else {
  // Registered users: increment conversionsThisMonth
  await incrementUserConversions(platform!.env.DB, locals.user.id);
}
```

### 3. Separate Upload and Job Creation

Keeping upload and job creation as separate API calls allows:
- Retry on job creation failure without re-uploading
- Future features like "upload now, convert later"
- Better error handling for each step

### 4. PDF Ownership via Key Prefix

Ownership is validated by checking the R2 key prefix:

```typescript
export function validatePdfOwnership(pdfKey: string, userId: string): boolean {
  const expectedPrefix = `uploads/${userId}/`;
  return pdfKey.startsWith(expectedPrefix);
}
```

Key format: `uploads/{userId}/{uuid}.pdf`

---

## TypeScript Type Safety for Plan Limits

The `PLAN_LIMITS` constant has different properties for each plan:

```typescript
export const PLAN_LIMITS = {
  anonymous: {
    conversionsTotal: 1,        // Lifetime limit
    maxPagesPerPdf: 50,
    // ...
  },
  free: {
    conversionsPerMonth: 3,     // Monthly limit
    maxPagesPerPdf: 100,
    // ...
  },
  // ...
};
```

When checking limits, we need to handle the type differences:

```typescript
export function checkConversionLimit(user: User): { allowed: boolean; reason?: string } {
  // Anonymous users: check lifetime total (separate property)
  if (user.plan === 'anonymous') {
    const limit = PLAN_LIMITS.anonymous.conversionsTotal;
    if (user.conversionsTotal >= limit) {
      return { allowed: false, reason: '...' };
    }
    return { allowed: true };
  }

  // Registered users: check monthly limit (conversionsPerMonth property)
  const planLimits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS];
  const monthlyLimit = 'conversionsPerMonth' in planLimits 
    ? planLimits.conversionsPerMonth 
    : Infinity;
  // ...
}
```

---

## Handler Test Patterns

### Testing with Real D1 Data

For tests that verify D1 records are created correctly, we create real users:

```typescript
it('should create job and return 200 with jobId', async () => {
  // Create a real user in D1
  const dbUser = await createAnonymousUser(env.DB);

  // Upload a PDF for this user
  const pdfKey = `uploads/${dbUser.id}/test.pdf`;
  await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

  // ... make request ...

  // Verify job was created in D1
  const job = await getJobById(env.DB, data.jobId);
  expect(job).not.toBeNull();
  expect(job?.userId).toBe(dbUser.id);

  // Verify conversion counter was incremented
  const updatedUser = await getUserById(env.DB, dbUser.id);
  expect(updatedUser?.conversionsTotal).toBe(1);

  // Cleanup
  await env.R2.delete(pdfKey);
});
```

### Testing with Mock Users

For tests that only need to verify error responses, we use `createMockUser`:

```typescript
it('should return 403 for anonymous user at conversion limit', async () => {
  const user = createMockUser({ plan: 'anonymous', conversionsTotal: 1 });

  // Upload a PDF for this user
  const pdfKey = `uploads/${user.id}/test.pdf`;
  await env.R2.put(pdfKey, new Uint8Array([1, 2, 3]));

  // ... make request and assert 403 ...

  // Cleanup
  await env.R2.delete(pdfKey);
});
```

---

## Test Results

```
Unit Tests: 25 passed
Handler Tests: 37 passed (12 upload + 25 job-create)
Integration Tests: 45 passed
Total: 107 tests passing
```

### Handler Tests Breakdown (25 tests)

- **Utility Functions (12 tests)**
  - `generateJobId`: prefix, uniqueness
  - `validatePdfOwnership`: matching/different/malformed keys
  - `checkConversionLimit`: all plan types and edge cases
  - `checkPdfExists`: existing/non-existing keys

- **Auth Checks (1 test)**
  - 401 for missing user

- **Request Validation (2 tests)**
  - 400 for missing fields
  - 400 for invalid JSON

- **PDF Validation (2 tests)**
  - 404 for non-existent PDF
  - 403 for PDF owned by different user

- **Conversion Limits (2 tests)**
  - 403 for anonymous at limit
  - 403 for free user at monthly limit

- **Successful Job Creation (4 tests)**
  - Creates job with correct data
  - Uses default models when not specified
  - Uses custom models when provided
  - Increments correct counter for registered users

---

## Checklist for Future API Endpoints

When implementing a new API endpoint, follow this checklist (same as Task 1E):

- [ ] Create business logic in `src/lib/server/{feature}.ts`
- [ ] Export `handle{Feature}` RequestHandler
- [ ] Export utility functions for unit testing
- [ ] Create thin route wrapper in `src/routes/api/{feature}/+server.ts`
- [ ] Create handler tests in `tests/handler/api/{feature}.test.ts`
- [ ] Use `createRequestEvent` and `toHandlerEvent` from test helpers
- [ ] Use `createMockUser` for tests that don't need database
- [ ] Use real D1 operations for tests that verify data persistence
- [ ] Handle SvelteKit errors with try/catch
- [ ] Add fixtures to `vitest.handler.config.ts` if needed

---

## Next Steps

Task 1G will implement:
- Job Status API (`GET /api/job/[id]`)
- Job Cancellation API (`DELETE /api/job/[id]`)