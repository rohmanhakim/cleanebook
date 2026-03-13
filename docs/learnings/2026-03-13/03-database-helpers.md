# Learning: Database Helpers (Task 1D)

**Date:** 2026-03-13
**Phase:** 001 - Anonymous User Upload Flow
**Task:** 1D - Database Helpers

---

## What Was Implemented

Task 1D requirements were already implemented during Task 1C. This task added comprehensive integration tests for all database helpers.

### Files Created

1. **`tests/integration/db.test.ts`** (Created)
   - 22 integration tests covering Job and User helpers
   - Tests for all CRUD operations
   - Tests for job status lifecycle transitions

---

## Database Helpers Summary

The `src/lib/server/db.ts` module provides:

### Row Mappers

- `rowToUser(row, prefix?)` - Maps DB row to User with optional prefix for JOINs
- `rowToJob(row)` - Maps DB row to Job
- `rowToTemplate(row)` - Maps DB row to Template

### User Helpers

- `getUserById(db, id)` - Fetch user by ID
- `getUserByEmail(db, email)` - Fetch user by email
- `createAnonymousUser(db)` - Create anon user with `anon_` prefix ID
- `claimAnonymousUser(db, anonId, {email, name, passwordHash})` - Convert anon to registered
- `incrementConversionsTotal(db, userId)` - Increment lifetime conversions
- `incrementUserConversions(db, userId)` - Increment monthly conversions

### Job Helpers

- `getJobById(db, id)` - Fetch job by ID
- `getJobsByUserId(db, userId)` - Fetch all jobs for user (ordered by created_at DESC)
- `createJob(db, job)` - Create new job
- `updateJobStatus(db, id, status, extra?)` - Update job status with optional fields

### Template Helpers

- `getTemplateById(db, id)` - Fetch template by ID

---

## Key Technical Decisions

### 1. Row Mapper Pattern

All DB queries use row mappers to convert snake_case to camelCase:

```typescript
export function rowToUser(row: Record<string, unknown>, prefix = ''): User {
  const get = (field: string) => row[prefix ? `${prefix}${field}` : field];
  // ...
}
```

The optional `prefix` parameter supports JOIN queries where columns need disambiguation.

### 2. Boolean Conversion for SQLite

SQLite stores booleans as INTEGER (0/1). The row mapper handles multiple representations:

```typescript
const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1';
  return Boolean(value);
};
```

### 3. Anonymous User ID Format

Anonymous users get IDs with `anon_` prefix plus 21 random characters:

```typescript
const id = `anon_${nanoid(21)}`; // anon_ prefix + 21 random chars = 26 total
```

### 4. Job Status Transitions

Jobs support the following status flow:

```
queued → processing → complete
                   ↘ needs_review → resuming → complete
                   ↘ failed
queued → cancelled
```

---

## Test Results

```
Unit Tests: 25 passed
Integration Tests: 35 passed (auth: 10 + db: 22 + bindings: 3)
Total: 60 tests passing
```

---

## Integration Test Patterns

### Test Database Setup

Each integration test file creates its own tables:

```typescript
const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS users (...);
  CREATE TABLE IF NOT EXISTS jobs (...);
  -- etc.
`;

async function setupTestDatabase() {
  await env.DB.batch([env.DB.prepare(CREATE_TABLES_SQL)]);
}

describe('...', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
});
```

### Testing Job Lifecycle

```typescript
it('should support full lifecycle: queued → processing → complete', async () => {
  // Create
  await createJob(env.DB, job);
  let result = await getJobById(env.DB, job.id);
  expect(result?.status).toBe('queued');

  // Processing
  await updateJobStatus(env.DB, job.id, 'processing', { pipelineStep: 'ocr' });

  // Complete
  await updateJobStatus(env.DB, job.id, 'complete', {
    epubKey: `epubs/${user.id}/${job.id}.epub`,
    pipelineStep: 'finalized',
  });
});
```

---

## Next Steps

Task 1E will implement:
- Upload API endpoint (`POST /api/upload`)
- PDF validation and page count extraction
- R2 storage integration