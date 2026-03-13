# Learning: Anonymous User TypeScript Types and Constants (Task 1B)

**Date:** 2026-03-13
**Phase:** 001 - Anonymous User Upload Flow
**Task:** 1B - TypeScript Types and Constants

---

## What Was Implemented

Updated TypeScript types and constants to support anonymous trial users.

### Changes Made

1. **Updated `src/lib/shared/types.ts`**:
   - Added `'anonymous'` to `UserPlan` type (placed first as lowest tier)
   - Added `isAnonymous: boolean` to `User` interface
   - Added `conversionsTotal: number` to `User` interface

2. **Updated `src/lib/shared/constants.ts`**:
   - Added `PLAN_LIMITS.anonymous` object with:
     - `conversionsTotal: 1` (lifetime, not per month)
     - `maxPagesPerPdf: 50`
     - `canSaveTemplates: false`
     - `canBatch: false`
     - `serverSideRender: false`
     - `canDownloadEpub: false` (key gate for signup)
   - Added `canDownloadEpub: true` to other plans for consistency

---

## Key Design Decisions

### 1. `conversionsTotal` vs `conversionsPerMonth`

Anonymous users have no concept of "month" - they get 1 lifetime conversion:
- `conversionsTotal` tracks lifetime usage for anonymous users
- `conversionsThisMonth` tracks monthly usage for registered users with reset cycles
- Both fields exist on the `User` interface; which one to use depends on `isAnonymous`

### 2. `canDownloadEpub: false` as the Key Gate

Per the project principles:
> EPUB download gates signup for anonymous — anonymous users can upload, run OCR, and see the full EPUB preview. The download button is the only gate.

This property is now explicit in `PLAN_LIMITS` for all plans.

### 3. Type Ordering

`'anonymous'` placed first in the `UserPlan` union type since it's the lowest tier and makes the type read naturally in order of increasing privileges.

---

## Type Check Verification

```bash
pnpm run check
# svelte-check found 0 errors and 3 warnings in 1 file
```

The warnings are pre-existing accessibility issues in `landing-footer.svelte` (placeholder `href="#"` links), unrelated to our changes.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/shared/types.ts` | Added `'anonymous'` to `UserPlan`, added `isAnonymous` and `conversionsTotal` to `User` |
| `src/lib/shared/constants.ts` | Added `anonymous` object to `PLAN_LIMITS`, added `canDownloadEpub` to all plans |

---

## Next Steps

Task 1C will implement authentication infrastructure:
- Create `src/lib/server/auth.ts` with session management
- Update `src/hooks.server.ts` for lazy anonymous user creation