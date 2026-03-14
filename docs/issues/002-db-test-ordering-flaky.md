# Issue #002: Flaky Test - getJobsByUserId Ordering

## Status

**Open** - Needs fix in next task

## Severity

Minor - Test reliability issue, not a production bug

## Description

The integration test `getJobsByUserId > should return jobs ordered by created_at DESC` is flaky and fails intermittently.

**Error Message:**
```
AssertionError: expected 'job_older_RanSasZPCw-Hxd3KFrOKN' to be 'job_newer_9NiB8iepQeu-xFX2tSiIj' // Object.is equality

Expected: "job_newer_9NiB8iepQeu-xFX2tSiIj"
Received: "job_older_RanSasZPCw-Hxd3KFrOKN"
```

## Location

`tests/integration/db.test.ts:380-395`

## Steps to Reproduce

1. Run integration tests: `pnpm test:integration --run`
2. The test may pass or fail depending on timing

## Root Cause Analysis

The test creates two jobs with a 10ms delay between them:

```typescript
const job1: Omit<Job, 'createdAt' | 'updatedAt'> = {
  id: `job_older_${nanoid()}`,
  // ...
};

// Small delay to ensure different timestamps
await new Promise((resolve) => setTimeout(resolve, 10));

const job2: Omit<Job, 'createdAt' | 'updatedAt'> = {
  id: `job_newer_${nanoid()}`,
  // ...
};

await createJob(env.DB, job1);
await createJob(env.DB, job2);

const result = await getJobsByUserId(env.DB, user.id);

// Newer job should be first
expect(result[0].id).toBe(job2.id);
expect(result[1].id).toBe(job1.id);
```

**The Problem:** D1/SQLite's `datetime('now')` function has only **1-second resolution**. The 10ms delay is insufficient - both jobs can get the same `created_at` timestamp, making the ordering non-deterministic.

When timestamps are equal, SQLite returns rows in insertion order (older first), but the test expects newer-first ordering.

## Proposed Solutions

### Option 1: Use Explicit Timestamps in Test (Recommended)

Modify the test to use explicit timestamps instead of relying on `DEFAULT (datetime('now'))`:

```typescript
// Create job1 with explicit older timestamp
await env.DB.prepare(`
  INSERT INTO jobs (id, user_id, status, pdf_key, pdf_page_count, pdf_filename, created_at, updated_at, ocr_model, layout_model)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 second'), datetime('now', '-1 second'), ?, ?)
`).bind(...).run();

// Create job2 with current timestamp
await createJob(env.DB, job2);
```

**Pros:** Reliable, doesn't slow down tests
**Cons:** More verbose test code

### Option 2: Increase Delay to >1 Second

```typescript
await new Promise((resolve) => setTimeout(resolve, 1100));
```

**Pros:** Simple change
**Cons:** Slows down test suite

### Option 3: Add Auto-Increment for Ordering

Add a separate ordering column or use `rowid` for deterministic ordering:

```sql
ALTER TABLE jobs ADD COLUMN sort_order INTEGER PRIMARY KEY AUTOINCREMENT;
```

**Pros:** Deterministic ordering independent of timestamps
**Cons:** Schema change, migration needed

## Recommendation

**Option 1** is recommended - use explicit timestamps in the test. This keeps tests fast while ensuring reliability.

## Related Files

- `tests/integration/db.test.ts` - Flaky test location
- `src/lib/server/db.ts` - `getJobsByUserId()` implementation
- `migrations/0001_initial.sql` - Schema definition

## Related Issues

- Issue #001: API Testing CSRF Issue (resolved)

## History

- 2026-03-14: Issue identified during Phase 001 retrospective