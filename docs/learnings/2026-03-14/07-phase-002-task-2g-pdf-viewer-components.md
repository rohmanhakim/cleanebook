# Phase 002 Task 2G: PDF Viewer Components

**Date:** 2026-03-14
**Task:** Create PDF viewer components for rendering uploaded PDFs

---

## What Was Done

1. Created `src/lib/components/app/pdf-page-canvas.svelte` - Single page canvas renderer
2. Created `src/lib/components/app/pdf-viewer.svelte` - Full PDF viewer with lazy loading
3. Updated `src/routes/(app)/editor/[jobId]/+page.svelte` - Integrated PDF viewer

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/components/app/pdf-page-canvas.svelte` | Created |
| `src/lib/components/app/pdf-viewer.svelte` | Created |
| `src/routes/(app)/editor/[jobId]/+page.svelte` | Updated |

---

## Key Learnings

### 1. pdfjs-dist Worker Configuration with Vite

For pdfjs-dist v5.x with Vite/SvelteKit, configure the worker using the URL constructor:

```typescript
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;
```

This approach:
- Works with Vite's bundling
- Doesn't require copying worker files to `static/`
- Is compatible with Cloudflare Workers deployment

### 1a. CRITICAL: Avoid SSR Issues with pdfjs-dist

**Problem:** pdfjs-dist uses browser APIs like `DOMMatrix` which don't exist in Node.js. When SvelteKit SSR evaluates a static import of pdfjs-dist, it throws:

```
Error: DOMMatrix is not defined
```

**Solution:** Use dynamic imports inside `onMount` to ensure pdfjs-dist is only loaded on the client:

```typescript
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type * as pdfjs from 'pdfjs-dist';  // Type-only import is safe

  // Type aliases for pdfjs types
  type PDFDocumentProxy = pdfjs.PDFDocumentProxy;
  type PDFPageProxy = pdfjs.PDFPageProxy;

  // PDF library reference (loaded dynamically on client)
  let pdfjsLib: typeof pdfjs | null = $state(null);

  onMount(async () => {
    if (!browser) return;

    try {
      // Dynamic import - only runs in browser
      const pdfjsModule = await import('pdfjs-dist');
      pdfjsLib = pdfjsModule;

      // Set worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).href;

      // Now you can use pdfjsLib to load PDFs
    } catch (e) {
      console.error('Failed to initialize PDF.js:', e);
    }
  });
</script>
```

**Key points:**
- `import type * as pdfjs from 'pdfjs-dist'` is safe - types are erased at compile time
- Dynamic `await import('pdfjs-dist')` inside `onMount` only runs in the browser
- Always check `if (!pdfjsLib) return` before using the library
- This pattern applies to any library that uses browser-only APIs

### 2. SvelteSet for Reactive Collections

When tracking visible pages for lazy rendering, use `SvelteSet` from `svelte/reactivity`:

```typescript
import { SvelteSet } from 'svelte/reactivity';

// SvelteSet is already reactive - no $state needed
let visiblePages = new SvelteSet<number>();

// Mutations (add/delete) trigger reactivity automatically
visiblePages.add(pageIndex);
visiblePages.clear();
```

**Important:** Do NOT wrap `SvelteSet` with `$state()` - it's already reactive. Use `.clear()` instead of reassigning with `new SvelteSet()`.

### 3. IntersectionObserver for Lazy Page Rendering

Use a Svelte action to observe page elements:

```typescript
function observePage(node: HTMLElement) {
  observer?.observe(node);
  return {
    destroy() {
      observer?.unobserve(node);
    },
  };
}
```

Then use it in the template:
```svelte
<div use:observePage>
  <PdfPageCanvas {page} render={visiblePages.has(i)} />
</div>
```

### 4. PDF.js RenderParameters in v5.x

The `render()` method requires both `canvasContext` and `canvas` properties:

```typescript
await page.render({
  canvasContext: context,
  viewport,
  canvas: canvasElement,  // Required in v5.x
}).promise;
```

### 5. Svelte 5 Each Block Key Requirement

ESLint requires keys for each blocks. Use this pattern for array iteration:

```svelte
{#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
  <Skeleton />
{/each}
```

---

## Troubleshooting

### Issue: 404 Error When Loading PDF via Presigned URL

**Symptoms:**
```
Unexpected server response (404) while retrieving PDF "https://cleanebook-files.ad5e009ffc12ea689d5ad54043254f8a.r2.cloudflarestorage.com/uploads/..."
```

**Root Cause:**
Local R2 buckets (miniflare) don't have S3-compatible endpoints accessible from browsers. Files uploaded to local R2 via the binding cannot be accessed via presigned URLs that point to `*.r2.cloudflarestorage.com`.

**Solution: Use Proxy Endpoint for Local Development**

1. **Create a file serving endpoint** at `/api/pdf/[jobId]/file/+server.ts` that reads from R2 binding directly:
```typescript
const object = await r2.get(job.pdfKey);
const arrayBuffer = await object.arrayBuffer();
return new Response(arrayBuffer, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${job.pdfFilename}"`,
  },
});
```

2. **Modify signed-url endpoint** to detect local development and return proxy URL:
```typescript
function isLocalDevelopment(bucketName: string): boolean {
  return bucketName.endsWith('-local');
}

if (isLocalDevelopment(bucketName)) {
  return json({
    url: `/api/pdf/${jobId}/file`,
    isProxy: true,
  });
}
// Otherwise generate real presigned URL for production
```

**Why this works:**
- Local buckets use names ending with `-local` (e.g., `cleanebook-files-local`)
- The proxy endpoint uses the R2 binding which works with local emulated R2
- Production still uses presigned URLs for direct client-to-R2 downloads (better performance)

**Files involved:**
- `src/routes/api/pdf/[jobId]/file/+server.ts` - New proxy endpoint
- `src/routes/api/pdf/[jobId]/signed-url/+server.ts` - Modified to return proxy URL for local dev

---

## Issue: ES2024 Map Method Not Supported in Cloudflare (2026-03-15)

**Symptoms:**
```
TypeError: this[#methodPromises].getOrInsertComputed is not a function
    #cacheSimpleMethod pdf.mjs:15511
    getOptionalContentConfig pdf.mjs:15967
    render pdf.mjs:14876
```

**Root Cause:**
pdfjs-dist v5.5.207 uses ES2024 Map methods (`Map.prototype.getOrInsertComputed`) which are not supported in Cloudflare Pages/Workers runtime. This only manifests in the production/preview environment, not in local development.

**Why Vite build target doesn't help:**
Setting `build.target: 'es2022'` in `vite.config.ts` only affects your application code, not the already-bundled npm packages like `pdfjs-dist`. The library is pre-bundled with ES2024 features.

**Solution: Downgrade to pdfjs-dist v4.x**

pdfjs-dist v4.x doesn't use ES2024 features and is more battle-tested for production environments:
- v4.9.155 is the latest v4 release
- Same API for basic PDF rendering
- Widely deployed with proven compatibility

```bash
pnpm remove pdfjs-dist
pnpm add pdfjs-dist@^4.9.155
```

Worker path in v4.x (same as v5.x):
```typescript
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;
```

**Note:** The `canvas` property is still required in `render()` for v4.x TypeScript types.

**Key takeaway:** Avoid bleeding-edge library versions (v5.x) for production deployment on edge runtimes like Cloudflare. Prefer battle-tested versions (v4.x).

**When can you upgrade to v5.x?** Monitor these:
1. **Cloudflare Workers Changelog** - Watch for V8 engine updates (needs V8 v12.4+)
2. **MDN compatibility table** - Check `Map.prototype.getOrInsertComputed` support
3. **pdfjs-dist GitHub issues** - Look for ES2024 compatibility discussions
4. **Test before upgrading** - Always deploy to preview environment first

Estimated timeline: 6-12 months for ES2024 support in Workers runtime.

---

## Component Architecture

### PdfPageCanvas

**Responsibility:** Render a single PDF page to canvas

**Props:**
- `page: PDFPageProxy` - The PDF page to render
- `scale?: number` - Scale factor (default: 1.5)
- `render?: boolean` - Whether to render immediately (default: true)

**State:**
- Canvas element reference
- Rendered flag to prevent re-rendering

### PdfViewer

**Responsibility:** Load and display full PDF document

**Props:**
- `presignedUrl: string` - Presigned URL to PDF file
- `scale?: number` - Scale factor (default: 1.5)

**State:**
- PDF document and pages
- Loading/error states
- Set of visible page indices

**Flow:**
1. Load PDF document from presigned URL
2. Render first 3 pages immediately
3. Load remaining pages in background
4. Use IntersectionObserver to render pages on scroll

---

## Testing Notes

For manual testing:
1. Start dev server: `pnpm dev`
2. Upload a PDF at landing page
3. Verify PDF loads and displays in editor page
4. Check Network tab to confirm PDF downloads from R2 (not proxied through server)

Test fixtures available at `tests/fixtures/pdfs/`:
- `sample-1page.pdf`
- `sample-10pages.pdf`
- `sample-51pages.pdf`