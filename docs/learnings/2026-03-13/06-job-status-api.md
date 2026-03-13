# Learning: Job Status API (Task 1G)

**Date:** 2026-03-13
**Phase:** 001 - Anonymous User Upload Flow
**Task:** 1G - Job Status API

---

## What Was Implemented

Task 1G implemented the Job Status API with two endpoints:
1. **GET /api/job/[id]** - Retrieve job status and metadata
2. **DELETE /api/job/[id]** - Cancel a job by setting status to 'cancelled'

This task follows the same three-layer testing pattern established in Tasks 1E and 1F.

### Files Created

1. **`src/lib/server/job-status.ts`** (Created)
   - Business logic for job status retrieval and cancellation
   - Exported `handleGetJob` and `handleCancelJob` RequestHandlers
   - Utility functions: `validateJobOwnership`, `isTerminalState`
   - Response types: `JobStatusResponse`, `CancelJobResponse`

2. **`src/routes/api/job/[id]/+server.ts`** (Created)
   - Thin wrapper that delegates to handlers

3. **`tests/handler/api/job-status.test.ts`** (Created)
   - Handler tests for job status functionality (23 tests)

---

## API Endpoints

### GET /api/job/[id]

**Response (200 OK):**
```json
{
  "id": "job_abc123",
  "status": "queued",
  "pdfFilename": "document.pdf",
  "pdfPageCount": 42,
  "pdfKey": "uploads/user123/uuid.pdf",
  "epubKey": null,
  "templateId": null,
  "errorMessage": null,
  "reviewPages": null,
  "pipelineStep": null,
  "ocrModel": "lightonai/LightOnOCR-2-1B",
  "layoutModel": "microsoft/layoutlmv3-base",
  "createdAt": "2026-03-13T09:00:00.000Z",
  "updatedAt": "2026-03-13T09:00:00.000Z"
}
```

**Error Responses:**
| Status | Scenario |
|--------|----------|
| 401 | User not authenticated |
| 403 | Job owned by different user |
| 404 | Job not found |

### DELETE /api/job/[id]

**Response (200 OK):**
```json
{
  "id": "job_abc123",
  "status": "cancelled"
}
```

**Error Responses:**
| Status | Scenario |
|--------|----------|
| 401 | User not authenticated |
| 403 | Job owned by different user |
| 404 | Job not found |
| 400 | Job already complete/failed/cancelled (terminal states) |

---

## Key Design Decisions

### 1. Terminal State Check for Cancellation

Jobs in terminal states (complete, failed, cancelled) cannot be cancelled:

```typescript
const TERMINAL_STATES: JobStatus[] = ['complete', 'failed', 'cancelled'];

export function isTerminalState(status: JobStatus): boolean {
  return TERMINAL_STATES.includes(status);
}
```

This prevents:
- Confusion from "cancelling" a complete job
- Overwriting EPUB files that were already generated
- Inconsistent state transitions

### 2. Response Excludes userId

The `JobStatusResponse` type intentionally excludes `userId`:

```typescript
export interface JobStatusResponse extends Omit<Job, 'userId'> {
  // userId is intentionally excluded - not needed by client
}
```

The client already knows who they are; exposing user IDs in responses is unnecessary and a potential security concern.

### 3. Parameter Validation

Both handlers validate the `params.id` parameter:

```typescript
if (!params.id) {
  return error(400, 'Job ID is required');
}
```

This handles edge cases where the route might be called without an ID (though SvelteKit routing typically prevents this).

### 4. Ownership Validation Pattern

Same pattern as PDF ownership validation in job creation:

```typescript
export function validateJobOwnership(job: Job, userId: string): boolean {
  return job.userId === userId;
}
```

Simple equality check - if the job's userId doesn't match the authenticated user, return 403.

---

## Test Results

```
Handler Tests: 60 passed (12 upload + 25 job-create + 23 job-status)
```

### Handler Tests Breakdown (23 tests)

- **Utility Functions (9 tests)**
  - `validateJobOwnership`: matching user, different user
  - `isTerminalState`: all 7 job statuses

- **GET Handler (4 tests)**
  - 401 for missing user
  - 404 for non-existent job
  - 403 for job owned by different user
  - 200 with full job data for valid request

- **DELETE Handler (10 tests)**
  - 401 for missing user
  - 404 for non-existent job
  - 403 for job owned by different user
  - 400 for complete job (terminal)
  - 400 for failed job (terminal)
  - 400 for cancelled job (terminal)
  - 200 for queued job cancellation
  - 200 for processing job cancellation
  - 200 for needs_review job cancellation
  - 200 for resuming job cancellation

---

## Response Type Pattern

When testing handler responses, cast the JSON result:

```typescript
import { type JobStatusResponse, type CancelJobResponse } from '$lib/server/job-status';

// In test
const data = (await response.json()) as JobStatusResponse;
expect(data.id).toBe(jobId);
expect(data.status).toBe('queued');
```

This provides type safety and IDE autocomplete in tests.

---

## Checklist for Future API Endpoints

Following the established pattern from Tasks 1E, 1F, and 1G:

- [ ] Create business logic in `src/lib/server/{feature}.ts`
- [ ] Export `handle{Feature}` RequestHandler
- [ ] Export utility functions for unit testing
- [ ] Export response types for test type safety
- [ ] Create thin route wrapper in `src/routes/api/{feature}/+server.ts`
- [ ] Create handler tests in `tests/handler/api/{feature}.test.ts`
- [ ] Use `createRequestEvent` and `toHandlerEvent` from test helpers
- [ ] Use `createMockUser` for tests that don't need database
- [ ] Use real D1 operations for tests that verify data persistence
- [ ] Cast response.json() results with proper types
- [ ] Handle SvelteKit errors with try/catch

---

## Next Steps

Task 1H will implement:
- Landing Page Upload Component
- Client-side PDF validation
- Sequential API calls (upload → create job → redirect)