# Phase 002 Task 2K: Update Editor Page

**Date:** 2026-03-15
**Task:** Integrate all editor components into the editor page

---

## What Was Done

1. Updated `+page.server.ts` to load job data and validate ownership
2. Updated `+page.svelte` to integrate all components:
   - EditorTopBar (fixed header)
   - EditorLayout (resizable panels)
   - PdfViewer (PDF rendering)
   - MetadataPanel (job info display)
3. Implemented client-side presigned URL fetching
4. Added loading and error states

---

## Files Modified

| File | Action |
|------|--------|
| `src/routes/(app)/editor/[jobId]/+page.server.ts` | Updated |
| `src/routes/(app)/editor/[jobId]/+page.svelte` | Updated |

---

## Key Implementation Details

### Server-Side: Job Loading and Validation

```typescript
// +page.server.ts
export const load: PageServerLoad = async ({ params, locals, platform }) => {
  const { jobId } = params;
  const user = locals.user;

  if (!user) {
    error(404, { message: 'Job not found' });
  }

  const db = platform?.env?.DB;
  if (!db) {
    error(500, { message: 'Database not available' });
  }

  const job = await getJobById(db, jobId);

  // Return 404 for both not found and wrong owner (don't reveal existence)
  if (!job || job.userId !== user.id) {
    error(404, { message: 'Job not found' });
  }

  return { job };
};
```

**Key points:**
- Returns 404 for both "not found" and "wrong owner" (security best practice)
- Uses `getJobById` from `$lib/server/db`
- Passes job data to the client

### Client-Side: Presigned URL Fetching

```typescript
// +page.svelte
let presignedUrl: string | null = $state(null);
let isLoadingUrl = $state(true);
let urlError: string | null = $state(null);

$effect(() => {
  fetchPresignedUrl(data.job.id);
});

async function fetchPresignedUrl(jobId: string) {
  try {
    isLoadingUrl = true;
    urlError = null;

    const response = await fetch(`/api/pdf/${jobId}/signed-url`);
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('You must be signed in to view this PDF');
      } else if (response.status === 404) {
        throw new Error('PDF not found or you do not have access');
      }
      throw new Error('Failed to get PDF URL');
    }

    const result: PresignedUrlResponse = await response.json();
    presignedUrl = result.url;
  } catch (e) {
    urlError = e instanceof Error ? e.message : 'Failed to load PDF';
  } finally {
    isLoadingUrl = false;
  }
}
```

**Key points:**
- Uses `$effect()` to fetch on component mount
- Handles specific HTTP error codes with user-friendly messages
- Stores URL in state for PdfViewer to consume

### Layout Integration with Snippets

```svelte
<EditorTopBar filename={data.job.pdfFilename} />

<div class="pt-14 h-full">
  <EditorLayout>
    {#snippet viewer()}
      <div class="h-full overflow-auto bg-muted/30 p-4">
        {#if isLoadingUrl}
          <!-- Loading skeletons -->
        {:else if urlError}
          <!-- Error state -->
        {:else if presignedUrl}
          <PdfViewer {presignedUrl} />
        {/if}
      </div>
    {/snippet}

    {#snippet metadataPanel()}
      <div class="h-full overflow-auto bg-background border-l">
        <MetadataPanel job={data.job} />
      </div>
    {/snippet}
  </EditorLayout>
</div>
```

**Key points:**
- Uses Svelte 5 snippets for content projection
- `pt-14` offsets for fixed top bar (h-14 = 3.5rem)
- Three-way conditional: loading / error / success

### Loading State

```svelte
{#if isLoadingUrl}
  <div class="space-y-4">
    {#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
      <Skeleton class="h-100 w-full" />
    {/each}
  </div>
{/if}
```

Uses shadcn Skeleton component for loading placeholders.

### Error State

```svelte
{#else if urlError}
  <div class="flex flex-col items-center justify-center h-full text-center">
    <div class="text-red-500 mb-4">
      <!-- SVG warning icon -->
    </div>
    <h3 class="text-lg font-semibold text-red-500 mb-2">Failed to load PDF</h3>
    <p class="text-muted-foreground">{urlError}</p>
  </div>
{/if}
```

User-friendly error display with context-specific messages.

---

## Component Architecture

```
+page.svelte
├── EditorTopBar (fixed, h-14)
│   ├── Logo (left)
│   ├── Filename (center)
│   └── Sign In button (right)
│
└── EditorLayout (fills remaining height)
    ├── [viewer snippet]
    │   └── PdfViewer
    │       └── PdfPageCanvas (for each page)
    │
    └── [metadataPanel snippet]
        └── MetadataPanel
            └── Job info display
```

---

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| Desktop layout renders with resizable panels | ✅ |
| PDF loads and displays all pages vertically | ✅ |
| Presigned URL is generated correctly | ✅ |
| Top bar shows correct filename | ✅ |
| Metadata panel shows correct job info | ✅ |
| Mobile shows placeholder message | ✅ |
| Error states handled gracefully | ✅ |
| No server-side import of pdfjs-dist | ✅ |

---

## PDF Worker Configuration

The PDF worker is configured dynamically in `pdf-viewer.svelte`:

```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;
```

This uses Vite's module resolution to bundle the worker, avoiding the need for Task 2L (copying worker to static).

---

## Related Tasks

- **Task 2E:** Presigned URL API Endpoint
- **Task 2G:** PDF Viewer Components
- **Task 2H:** Editor Top Bar Component
- **Task 2I:** Metadata Panel Component
- **Task 2J:** Editor Layout Component