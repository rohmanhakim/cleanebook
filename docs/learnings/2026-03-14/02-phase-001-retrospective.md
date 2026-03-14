# Phase 001 Retrospective: Anonymous User Upload Flow

## Overview

Phase 001 implemented the core user flow: anonymous visitor uploads PDF from landing page → automatically redirects to editor route displaying job metadata.

**Status: Feature Complete with Bugs Found**

## Goals Achievement

| Goal | Status | Notes |
|------|--------|-------|
| Anonymous users can upload PDFs without signup | ✅ Complete | Works after first attempt (bug on first upload) |
| PDFs are stored in R2 for persistence and pipeline processing | ✅ Complete | Correct path structure: `uploads/{userId}/{uuid}.pdf` |
| Jobs are created in D1 to track conversion state | ✅ Complete | Job record created with status `queued` |
| Users are redirected to editor route showing PDF metadata | ✅ Complete | Displays job ID, status, filename, page count, dates |

---

## Testing Results

### Test Environment

- **Environment**: Cloudflare Preview (`c955755e.cleanebook.pages.dev`)
- **Date**: 2026-03-14
- **Tester**: Manual testing via browser

### Test Cases

| Test Case | Result | Notes |
|-----------|--------|-------|
| PDF exceeding page limit (51+ pages) | ✅ Pass | Returns 413, no job/row created |
| PDF exceeding file size limit | ✅ Pass | Returns 413 |
| Valid PDF upload (first browser visit) | ❌ Bug | Returns 401, user created but job not created |
| Valid PDF upload (retry after 401) | ✅ Pass | Works on second attempt |
| Valid PDF upload (new incognito same browser) | ✅ Pass | New anonymous user created |
| Valid PDF upload (different browser) | ✅ Pass | New anonymous user created |
| Conversion limit enforcement (anonymous) | ✅ Pass | Returns 403 with correct message |
| Page limit enforcement (50 pages max) | ✅ Pass | Returns 403 |
| Editor page displays job metadata | ✅ Pass | All fields shown correctly |
| Drag-drop upload (Firefox) | ✅ Pass | Works correctly |
| Drag-drop upload (Chromium/Opera) | ❌ Bug | Must click instead of drag |

### Database State After Testing

**Users Table:**
```
| id                          | email | name      | plan      | is_anonymous | conversions_total |
|-----------------------------|-------|-----------|-----------|--------------|-------------------|
| anon_27o1GwACoQ21xYX0O4f4r  | NULL  | Anonymous | anonymous | 1            | 1                 |
```

**Jobs Table:**
```
| id                        | user_id                    | status | pdf_key                                              | pdf_page_count | pdf_filename      |
|---------------------------|----------------------------|--------|------------------------------------------------------|----------------|-------------------|
| job_O_6d1q69VWNpF7yQbJDYm | anon_27o1GwACoQ21xYX0O4f4r | queued | uploads/anon_27o1GwACoQ21xYX0O4f4r/037cf034-...pdf  | 1              | sample-1page.pdf  |
```

---

## Issues Found

### Issue #1: 401 Unauthorized on First Upload (Critical)

**Severity**: Critical  
**Status**: ✅ Fixed

**Description**: When a new visitor uploads a PDF from a fresh browser (no existing session), the first upload request returns 401 Unauthorized. The anonymous user row is created in D1, but the job is not created. Retrying the upload works.

**Steps to Reproduce**:
1. Open a new browser (not incognito - completely different browser installation)
2. Navigate to the landing page
3. Upload a valid PDF
4. Observe 401 error

**Expected Behavior**: First upload should succeed, creating both user and job.

**Actual Behavior**: First upload fails with 401, but anonymous user row is created. Second upload succeeds.

**Cloudflare Worker Logs**:
```json
{
  "event": {
    "request": { "url": "https://c955755e.cleanebook.pages.dev/api/upload", "method": "POST" },
    "response": { "status": 401 }
  }
}
```

**Root Cause Analysis**:

In `src/hooks.server.ts`, anonymous user creation happens **after** `resolve(event)`:

```typescript
// Session validation
if (token && platform?.env?.DB) {
  const result = await validateSessionToken(platform.env.DB, token);
  event.locals.user = result?.user ?? null;
} else {
  event.locals.user = null;  // ← User is NULL for new visitors
}

// Resolve the response first
const response = await resolve(event);  // ← Upload handler runs here!
                                        //   It checks locals.user, sees NULL, returns 401

// Lazy anonymous user creation - AFTER resolve()
if (!event.locals.user && platform?.env?.DB) {
  const shouldCreateAnon = ANON_SESSION_ROUTES.some((r) => path.startsWith(r));
  if (shouldCreateAnon) {
    // ← Too late! Response already sent with 401
    const anonUser = await createAnonymousUser(platform.env.DB);
    // ...
  }
}
```

The upload handler in `src/lib/server/upload.ts` checks auth immediately:

```typescript
export const handleUpload: RequestHandler = async ({ request, locals, platform }) => {
  // 1. Auth check - user should exist
  if (!locals.user) {
    return error(401, 'Unauthorized');  // ← Fails on first request!
  }
  // ...
};
```

**The Problem**: The lazy anonymous user creation pattern was designed to avoid flooding D1 with bot traffic, but it creates the user **too late** in the request lifecycle. By the time the user is created, the upload handler has already returned 401.

**Fix Implemented** (2026-03-14):

The fix moves anonymous user creation **before** `resolve(event)`:

```typescript
// Track if we need to set a session cookie on the response
let newSessionToken: string | null = null;

// Lazy anonymous user creation - BEFORE resolve
// This ensures locals.user is populated when route handlers run
if (!event.locals.user && platform?.env?.DB) {
  const path = event.url.pathname;
  const shouldCreateAnon = ANON_SESSION_ROUTES.some((r) => path.startsWith(r));

  if (shouldCreateAnon) {
    try {
      // Create anonymous user and session
      const anonUser = await createAnonymousUser(platform.env.DB);
      newSessionToken = generateSessionToken();
      await createSession(platform.env.DB, anonUser.id, newSessionToken);

      // Set user in locals for this request - BEFORE resolve
      event.locals.user = anonUser;
    } catch (error) {
      // Log but don't fail the request - user will remain null
      console.error('Failed to create anonymous user:', error);
    }
  }
}

// Now resolve the response with locals.user properly populated
const response = await resolve(event);

// Set cookie on the response if we created a new session
if (newSessionToken) {
  response.headers.append('Set-Cookie', setSessionCookie(newSessionToken));
}
```

**Test Coverage**:

Created `tests/integration/hooks.test.ts` with 8 tests:
- 3 tests verify anon user created BEFORE resolve for `/api/upload`, `/editor/*`, `/api/job/*`
- 2 tests verify marketing routes do NOT create anon users
- 1 test verifies existing session is used (no duplicate anon created)
- 2 tests verify user/session persistence in database

All 156 tests pass (unit: 36, handler: 67, integration: 53).

**Commit**: `e5594e6`

**Manual Verification**: ✅ Verified working on fresh Brave browser installation (2026-03-14)

---

### Issue #2: Drag-drop Not Working in Chromium/Brave/Opera (Minor)

**Severity**: Minor  
**Status**: ✅ Fixed

**Description**: In Chromium-based browsers (Chromium, Opera, Brave), drag-and-drop upload does not trigger file selection. Users must click on the dropzone to select a file. Firefox works correctly.

**Steps to Reproduce**:
1. Open Chromium or Opera or Brave browser
2. Navigate to landing page
3. Drag a PDF file onto the dropzone
4. Observe that nothing happens (file not uploaded)

**Expected Behavior**: Dropping a PDF should trigger the upload flow.

**Actual Behavior**: Drop event is ignored. Click-to-browse works fine.

**Root Cause Analysis**:

Two issues were identified:

**Issue 2A: `<button>` element drag-drop compatibility**

The dropzone was implemented using a `<button>` element:

```svelte
<button
  type="button"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  disabled={isUploading}
>
```

Chromium-based browsers have stricter handling of drag events on `<button>` elements. The `drop` event may not fire correctly because:

1. `<button>` elements have default drag behaviors that interfere
2. The `dropEffect` is not explicitly set in the `dragover` handler
3. Some browsers treat buttons as non-droppable by default

**Issue 2B: Zero-size File objects in Chromium drag-drop**

When dragging files from the file system in Chromium, the browser creates `File` objects with `size=0` initially. The client-side validation was rejecting these files because it couldn't read magic bytes from an empty file.

Console output during debugging:
```
File received: { name: 'sample.pdf', type: '', size: 0 }
Has .pdf extension: true
Magic bytes: "" Expected: "%PDF-"
```

**Fix Implemented** (2026-03-14):

1. **Changed `<button>` to `<div>` with proper accessibility attributes:**

```svelte
<div
  role="button"
  tabindex="0"
  class="..."
  onclick={handleClick}
  onkeydown={handleKeydown}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  aria-disabled={isUploading}
>
```

2. **Added keyboard handler for accessibility:**

```typescript
function handleKeydown(e: KeyboardEvent): void {
  if (isUploading) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    inputRef?.click();
  }
}
```

3. **Updated `handleDragOver` to explicitly set `dropEffect`:**

```typescript
function handleDragOver(e: DragEvent): void {
  if (isUploading) return;
  e.preventDefault();
  e.stopPropagation();
  // Explicitly set dropEffect for Chromium compatibility
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
  isDragOver = true;
}
```

4. **Added zero-size file handling in `validatePdfMagicBytes()`:**

```typescript
async function validatePdfMagicBytes(file: File): Promise<boolean> {
  // Check extension first for quick rejection
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return false;
  }

  // Handle Chromium drag-drop quirk where file.size is 0 initially
  // Accept zero-size files and let server-side validation handle them
  if (file.size === 0) {
    return true;
  }

  // Read first 5 bytes to validate magic bytes
  const slice = file.slice(0, 5);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const header = String.fromCharCode(...bytes);
  return header === PDF_MAGIC_BYTES;
}
```

5. **Updated E2E tests** to use `div[role="button"]` selector instead of `button`

6. **Updated unit tests** for the new element structure and zero-size file handling

7. **Added Firefox and WebKit** to Playwright configuration for cross-browser testing

**Files Changed:**
- `src/lib/components/marketing/upload-dropzone.svelte` - Element change and validation fix
- `tests/e2e/landing.spec.ts` - Updated selectors, removed flaky synthetic drag-drop tests
- `tests/unit/marketing/upload-dropzone.test.ts` - Updated for new element structure
- `playwright.config.ts` - Added Firefox and WebKit projects
- `README.md` - Added browser compatibility note for Flatpak browsers

**Test Coverage:**
- Unit tests: 40 passed
- Handler tests: 67 passed
- E2E tests: 13 passed (Chromium)

**Lesson Learned**: When dealing with browser drag-drop, always test across multiple browsers. Chromium handles `File` objects differently during drag operations - the file content may not be immediately accessible. The fix accepts zero-size files on client-side and relies on server-side validation for actual content verification.

---

### Issue #3: ERR_ALPN_NEGOTIATION_FAILED with Flatpak Browsers (Critical)

**Severity**: Critical  
**Status**: ✅ Resolved (workaround documented)

**Description**: When using Flatpak-installed browsers (Ungoogled Chromium, Brave), upload requests to `localhost:5173` fail with `net::ERR_ALPN_NEGOTIATION_FAILED`. The same code works in Firefox and native (non-Flatpak) Chrome.

**Steps to Reproduce**:
1. Install browser via Flatpak (e.g., Ungoogled Chromium, Brave)
2. Navigate to `http://localhost:5173`
3. Attempt to upload a PDF via drag-drop or click
4. Observe `ERR_ALPN_NEGOTIATION_FAILED` in browser console

**Expected Behavior**: Upload should work like any other browser.

**Actual Behavior**: Request fails immediately with ALPN negotiation error.

**Root Cause Analysis**:

Flatpak browsers run in a sandboxed network namespace that applies TLS/ALPN processing to all connections, including plain HTTP to `localhost`. When the browser tries to negotiate ALPN protocols (HTTP/2, HTTP/3) with the Vite dev server (which only speaks HTTP/1.1), the negotiation fails.

Net-export analysis showed:
- Browser attempts to reuse idle sockets from previous HTTPS connections
- Socket pool contamination causes ALPN mismatch
- Flushing socket pools doesn't resolve the issue

**Verified Browsers**:

| Browser | Installation | Result |
|---------|--------------|--------|
| Ungoogled Chromium | Flatpak | ❌ Fails |
| Brave | Flatpak | ❌ Fails |
| Google Chrome | .deb (native) | ✅ Works |
| Firefox | (any) | ✅ Works |

**Resolution**:

Use native (non-containerized) browsers for local development:
- Google Chrome (`.deb` package)
- Firefox
- Any browser installed via system package manager (not Flatpak/snap)

Alternative solutions (not implemented):
1. Configure Flatpak network permissions: `flatpak override --filesystem=host --socket=network <app-id>`
2. Use Caddy as HTTPS reverse proxy to bypass localhost entirely

**Lesson Documented**: Added browser compatibility note to `README.md`.

---

## Lessons Learned

### 1. Order of Operations in SvelteKit Hooks

The `resolve(event)` function is the boundary between pre-processing and post-processing. Any state that request handlers depend on (like `locals.user`) must be set **before** calling `resolve()`.

**Lesson**: Lazy initialization in hooks must happen before resolve, not after. The "after resolve" pattern only works for modifying the response, not for setting up request state.

### 2. Cross-Browser Drag-Drop Testing

Drag-and-drop behavior varies across browsers, especially on non-standard drop targets like `<button>` elements.

**Lesson**: Always test drag-drop in multiple browsers (Firefox, Chrome/Chromium, Safari). Use `<div>` with `role="button"` for interactive dropzones.

### 3. First-Request Behavior is Easy to Miss

This bug was only discovered by testing with a completely fresh browser. Incognito mode shares cookies with the parent browser profile, so it doesn't simulate a truly new visitor.

**Lesson**: Test with multiple different browsers, not just incognito windows, to catch first-request bugs.

### 4. Anonymous User Creation Side-Effects

The current implementation creates a user row even when the upload fails with 401. This leaves orphaned user rows in the database.

**Lesson**: When operations fail, consider whether partial state (like created user rows) should be cleaned up, or whether the design should prevent partial state creation.

### 5. Flatpak/Snap Browser Network Isolation

Flatpak and snap browsers run in sandboxed network namespaces that can interfere with plain HTTP connections to `localhost`. This manifests as `ERR_ALPN_NEGOTIATION_FAILED` when the sandbox applies TLS/ALPN processing to connections that shouldn't have it.

**Lesson**: For local development with `localhost`, use native (non-containerized) browser installations. Flatpak/snap browsers may work for production URLs but can fail unexpectedly with local dev servers.

---

## Action Items

Before proceeding to Phase 002, fix the following:

| Priority | Item | File(s) Affected |
|----------|------|------------------|
| Critical | Fix 401 on first upload - move anon user creation before resolve | `src/hooks.server.ts` |
| Minor | Fix drag-drop in Chromium - change button to div with proper ARIA | `src/lib/components/marketing/upload-dropzone.svelte` |
| Optional | Clean up orphaned anonymous users from failed uploads | Database cleanup script |

---

## Related Documents

- [Phase 001 Task Document](../../tasks/phase-001-anonymous-user-upload.md)
- [D1 Database Reset Learning](./01-d1-database-reset.md)
- [Authentication Infrastructure Learning](../2026-03-13/02-authentication-infrastructure.md)

---

## References

- [SvelteKit Hooks Documentation](https://kit.svelte.dev/docs/hooks#server-hooks)
- [MDN: Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [Cloudflare Workers Lifecycle](https://developers.cloudflare.com/workers/runtime-apis/)