# Phase 001: Anonymous User Upload Flow

## Overview

Implement the core user flow: anonymous visitor uploads PDF from landing page → automatically redirects to editor route. This establishes the foundation for the entire application.

## Goals

1. Anonymous users can upload PDFs without signup
2. PDFs are stored in R2 for persistence and pipeline processing
3. Jobs are created in D1 to track conversion state
4. Users are redirected to editor route showing PDF metadata

## Constraints

- Anonymous users: 1 conversion total (lifetime), max 50 pages, no templates
- Basic Auth stays active during development for spam prevention
- PDF rendering is client-side, but storage is server-side (R2)

---

## Task 1A: Database Schema for Anonymous Users

### Files

| File | Action |
|------|--------|
| `migrations/0003_anonymous.sql` | Create |
| `migrations/0001_initial.sql` | Update |

### Tasks

- [ ] Create `migrations/0003_anonymous.sql` with:
  - `is_anonymous INTEGER NOT NULL DEFAULT 0`
  - `conversions_total INTEGER NOT NULL DEFAULT 0`
  - Modify `email` to nullable (`TEXT UNIQUE` instead of `TEXT NOT NULL UNIQUE`)
  - Modify `name` default to `'Anonymous'`
  - Add index `idx_users_is_anonymous`
  - Add partial index `idx_users_anon_created` for cleanup cron

- [ ] Update `migrations/0001_initial.sql` to include anonymous columns (for fresh installs)

### Rationale

Anonymous users need a real user row in the database with `is_anonymous=1` and `plan='anonymous'`. This allows the same session and auth flow for both anonymous and registered users. The `conversions_total` column tracks lifetime conversions (not monthly) for anonymous users since they have no concept of "month".

---

## Task 1B: TypeScript Types and Constants

### Files

| File | Action |
|------|--------|
| `src/lib/shared/types.ts` | Update |
| `src/lib/shared/constants.ts` | Update |

### Tasks

- [ ] Update `UserPlan` type to include `'anonymous'`
- [ ] Add `isAnonymous: boolean` to `User` interface
- [ ] Add `conversionsTotal: number` to `User` interface
- [ ] Add `PLAN_LIMITS.anonymous` with:
  - `conversionsTotal: 1`
  - `maxPagesPerPdf: 50`
  - `canSaveTemplates: false`
  - `canBatch: false`
  - `serverSideRender: false`
  - `canDownloadEpub: false`

### Rationale

TypeScript types must match the database schema. Having explicit anonymous plan limits centralizes all plan constraints in one place for easy reference and enforcement.

---

## Task 1C: Authentication Infrastructure

### Files

| File | Action |
|------|--------|
| `src/lib/server/auth.ts` | Create |
| `src/hooks.server.ts` | Update |

### Tasks

- [ ] Create `src/lib/server/auth.ts` with:
  - `generateSessionToken()` - 20 random bytes, base64url encoded
  - `sessionTokenToId()` - SHA256 hash for DB storage
  - `createSession(db, userId, token)` - insert session
  - `validateSessionToken(db, token)` - validate and return user
  - `invalidateSession(db, token)` - delete session
  - `setSessionCookie(token)` / `clearSessionCookie()` - cookie helpers
  - `getSessionTokenFromCookies(cookieHeader)` - parse cookie

- [ ] Update `src/hooks.server.ts`:
  - Keep Basic Auth gating (development phase)
  - Add session validation from cookie
  - Lazy anonymous user creation only on specific routes:
    - `/api/upload`
    - `/api/job/*`
    - `/editor/*`
  - Set session cookie on response when new anonymous user created

### Rationale

Session management uses `@oslojs/crypto` and `@oslojs/encoding` (not lucia - deprecated). Lazy anonymous creation prevents flooding D1 with bot traffic - only real interactions (upload, editor access) trigger user creation. Session cookie works identically for anonymous and registered users.

---

## Task 1D: Database Helpers

### Files

| File | Action |
|------|--------|
| `src/lib/server/db.ts` | Update |

### Tasks

- [ ] Implement `getJobById(db, id)` with row mapper
- [ ] Implement `getJobsByUserId(db, userId)` with row mapper
- [ ] Implement `createJob(db, job)` 
- [ ] Implement `updateJobStatus(db, id, status, extra?)`
- [ ] Implement `getUserById(db, id)` with row mapper
- [ ] Implement `getUserByEmail(db, email)` with row mapper
- [ ] Add `createAnonymousUser(db)` - creates user with `id='anon_*'`
- [ ] Add `claimAnonymousUser(db, anonId, {email, name, passwordHash})`
- [ ] Add `incrementConversionsTotal(db, userId)`
- [ ] Add row mappers `rowToUser()` and `rowToJob()` for snake_case → camelCase

### Rationale

All D1 queries go through helper functions. Row mappers centralize the snake_case (DB) to camelCase (TypeScript) conversion. Anonymous user helpers abstract the creation and claiming logic.

---

## Task 1E: Upload API

### Files

| File | Action |
|------|--------|
| `src/routes/api/upload/+server.ts` | Create |

### Tasks

- [ ] Create `POST /api/upload` endpoint:
  - Accept `multipart/form-data` with `file` field
  - Validate PDF magic bytes (`%PDF-`)
  - Use `pdfjs-serverless` to extract page count
  - Enforce page limit based on user plan
  - Generate R2 key: `uploads/{userId}/{uuid}.pdf`
  - Stream to R2 (don't buffer entire file in memory)
  - Return `{ key, filename, pageCount, sizeBytes }`

### Rationale

Server-side upload is required because R2 storage is needed for pipeline processing. Client-side rendering is for viewing, not storage. Page limit enforcement happens at upload time to fail fast before consuming R2 storage.

---

## Task 1F: Job Creation API

### Files

| File | Action |
|------|--------|
| `src/routes/api/job/create/+server.ts` | Create |

### Tasks

- [ ] Create `POST /api/job/create` endpoint:
  - Accept `{ pdfKey, pdfFilename, pdfPageCount, templateId?, ocrModel?, layoutModel? }`
  - Validate user owns the PDF (key starts with `uploads/{userId}/`)
  - Check conversion limits:
    - Anonymous: `conversions_total < 1`
    - Free: `conversions_this_month < 3`
    - etc.
  - Create job in D1 with `status='queued'`
  - Return `{ jobId, status: 'queued' }`

### Rationale

Separating upload from job creation allows the client to handle errors at each step. Job record tracks the conversion state throughout the pipeline. The OCR workflow will be triggered later (not part of this phase).

---

## Task 1G: Job Status API

### Files

| File | Action |
|------|--------|
| `src/routes/api/job/[id]/+server.ts` | Create |

### Tasks

- [ ] Create `GET /api/job/[id]` endpoint:
  - Validate user owns the job
  - Return job status, page count, filename, pipeline step, etc.
- [ ] Create `DELETE /api/job/[id]` endpoint:
  - Set job status to 'cancelled'

### Rationale

Job status API is needed for the editor page to display current state. Future phases will use TanStack Query to poll this endpoint during processing.

---

## Task 1H: Landing Page Upload Component

### Files

| File | Action |
|------|--------|
| `src/lib/components/marketing/upload-dropzone.svelte` | Update |

### Tasks

- [ ] Add hidden `<input type="file" accept=".pdf">`
- [ ] Add drag-drop event handlers
- [ ] Add click handler to trigger file input
- [ ] On file select:
  1. Validate file type client-side
  2. Show loading state
  3. POST to `/api/upload` with FormData
  4. POST to `/api/job/create` with response
  5. `goto('/editor/{jobId}')` on success
- [ ] Show error toasts on failure using svelte-sonner

### Rationale

The dropzone is the entry point for the entire user flow. Client-side validation prevents unnecessary API calls for non-PDF files. Sequential API calls (upload → create job) allow handling each error case appropriately.

---

## Task 1I: Editor Route

### Files

| File | Action |
|------|--------|
| `src/routes/(app)/editor/[jobId]/+page.svelte` | Create |
| `src/routes/(app)/editor/[jobId]/+page.server.ts` | Create |
| `src/routes/(app)/+layout.server.ts` | Create |

### Tasks

- [ ] Create `src/routes/(app)/+layout.server.ts`:
  - Auth guard: allow anonymous users (don't redirect to login)
  
- [ ] Create `src/routes/(app)/editor/[jobId]/+page.server.ts`:
  - Load job data from D1
  - Validate user owns the job
  - Pass job data to page

- [ ] Create `src/routes/(app)/editor/[jobId]/+page.svelte`:
  - Display job metadata as text:
    - Job ID
    - Status
    - Filename
    - Page count
    - Created date
  - Show placeholder message: "PDF viewer and region editor will go here"

### Rationale

This establishes the editor route structure without implementing the full editor. The page successfully renders with job data, proving the complete upload → redirect → display flow works. Future phases will add PDF viewer and region editor.

---

## Testing Checklist

After implementation, verify:

- [ ] Anonymous user can upload PDF from landing page
- [ ] Anonymous user row created in D1 with `is_anonymous=1`
- [ ] Session cookie is set correctly
- [ ] PDF stored in R2 at correct path
- [ ] Job created in D1 with correct `pdf_key`
- [ ] Redirect to `/editor/{jobId}` works
- [ ] Editor page displays job metadata
- [ ] Page limit enforced (50 for anonymous)
- [ ] Conversion limit enforced (1 total for anonymous)
- [ ] Basic Auth still works for development

---

## Future Phases (Not In Scope)

- Phase 002: PDF viewer in editor
- Phase 003: Region editor with Konva.js
- Phase 004: OCR pipeline integration
- Phase 005: EPUB preview and download
- Phase 006: Anonymous → registered account claiming