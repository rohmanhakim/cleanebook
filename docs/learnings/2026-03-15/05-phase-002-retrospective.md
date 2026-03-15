# Phase 002 Retrospective: PDF Viewer with Resizable Layout

## Overview

Phase 002 implemented a PDF viewer that allows users to read uploaded PDFs with vertical scrolling. The editor page features a three-part layout: fixed top bar, resizable PDF viewer (left), and metadata panel (right).

**Status: Feature Complete** ✅

---

## Goals Achievement

| Goal | Status | Notes |
|------|--------|-------|
| Users can view uploaded PDFs in a vertical scrolling layout | ✅ Complete | Works with lazy loading for performance |
| PDFs load efficiently via presigned R2 URLs | ✅ Complete | Direct client-to-R2 download |
| Resizable panels allow users to adjust viewer/metadata split | ✅ Complete | 70/30 default split with min sizes |
| Desktop-first experience with mobile placeholder | ✅ Complete | Mobile shows placeholder message |

---

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 2A | Install Dependencies | ✅ Complete |
| 2B | Add shadcn Components | ✅ Complete |
| 2C | Constants and Types | ✅ Complete |
| 2D | R2 CORS Configuration | ✅ Complete |
| 2E | Presigned URL API Endpoint | ✅ Complete |
| 2F | Update CF Bindings | ✅ Complete |
| 2G | PDF Viewer Components | ✅ Complete |
| 2H | Editor Top Bar Component | ✅ Complete |
| 2I | Metadata Panel Component | ✅ Complete |
| 2J | Editor Layout Component | ✅ Complete |
| 2K | Update Editor Page | ✅ Complete |
| 2L | Copy PDF Worker to Static | ⏭️ Skipped (Vite handles bundling) |

---

## Testing Results

### Test Environment

- **Local**: `http://localhost:5173` with wrangler dev
- **Cloudflare Preview**: Working on Cloudflare Pages
- **Date**: 2026-03-15

### Acceptance Criteria

| Criteria | Status |
|----------|--------|
| Desktop layout renders with resizable panels | ✅ Pass |
| PDF loads and displays all pages vertically | ✅ Pass |
| Presigned URL is generated correctly | ✅ Pass |
| PDF downloads directly from R2 | ✅ Pass |
| CORS headers present on R2 responses | ✅ Pass |
| Top bar shows correct filename | ✅ Pass |
| Metadata panel shows correct job info | ✅ Pass |
| Mobile shows placeholder message | ✅ Pass |
| Error states handled gracefully | ✅ Pass |
| No server-side import of pdfjs-dist | ✅ Pass |

---

## Issues and Alternative Solutions

### Issue #1: `svelte-resizable-panels` Package Doesn't Exist

**Severity**: Minor  
**Status**: ✅ Resolved

**Problem**: The task spec referenced `svelte-resizable-panels` as the dependency for shadcn-svelte's Resizable component. This package does not exist on npm.

**Solution**: The correct package is **`paneforge`** - the official Svelte port of `react-resizable-panels` by the Svecosystem team.

**Lesson**: Always verify package names exist before specifying them in task docs. The Svelte ecosystem sometimes has differently-named ports of popular React libraries.

---

### Issue #2: `svelte-media-query-store` ESM Compatibility Issues

**Severity**: Moderate  
**Status**: ✅ Resolved with alternative solution

**Problem**: The `svelte-media-query-store` package has ESM module resolution issues:

```
Cannot find module '.../svelte-media-query-store/mediaQueryStore'
```

The package's `index.js` imports `./mediaQueryStore` without the `.js` extension, which fails with ESM module resolution.

**Solution**: Created a custom media query utility using Svelte's `writable` store:

```typescript
// src/lib/client/stores/media-query.ts
import { writable, type Readable } from 'svelte/store';
import { browser } from '$app/environment';

export function createMediaQuery(query: string): Readable<boolean> {
  const { subscribe, set } = writable(false);

  if (browser) {
    const mql = window.matchMedia(query);
    set(mql.matches);
    mql.addEventListener('change', (e) => set(e.matches));
  }

  return { subscribe };
}
```

**Lesson**: Avoid packages with ESM compatibility issues. Creating a simple utility is often more reliable than using a package.

---

### Issue #3: pdfjs-dist v5.x ES2024 Incompatibility with Cloudflare Workers

**Severity**: Critical  
**Status**: ✅ Resolved by downgrading

**Problem**: pdfjs-dist v5.x uses ES2024 `Map.prototype.getOrInsertComputed` which is not supported in Cloudflare Workers runtime:

```
TypeError: this[#methodPromises].getOrInsertComputed is not a function
```

**Solution**: Downgraded to pdfjs-dist v4.9.155 which doesn't use ES2024 features:

```bash
pnpm remove pdfjs-dist
pnpm add pdfjs-dist@^4.9.155
```

**Lesson**: Avoid bleeding-edge library versions for production deployment on edge runtimes like Cloudflare. Prefer battle-tested versions.

**Timeline**: ES2024 support in Cloudflare Workers is estimated at 6-12 months.

---

### Issue #4: pdfjs-dist SSR Issues with SvelteKit

**Severity**: Critical  
**Status**: ✅ Resolved

**Problem**: pdfjs-dist uses browser APIs like `DOMMatrix` which don't exist in Node.js. When SvelteKit SSR evaluates a static import, it throws:

```
Error: DOMMatrix is not defined
```

**Solution**: Use dynamic imports inside `onMount`:

```typescript
import { onMount } from 'svelte';
import { browser } from '$app/environment';
import type * as pdfjs from 'pdfjs-dist';  // Type-only import is safe

let pdfjsLib: typeof pdfjs | null = $state(null);

onMount(async () => {
  if (!browser) return;
  const pdfjsModule = await import('pdfjs-dist');
  pdfjsLib = pdfjsModule;
  // Set worker source...
});
```

**Lesson**: Libraries that use browser-only APIs must be dynamically imported in `onMount`. Type-only imports are safe since types are erased at compile time.

---

### Issue #5: Local R2 Doesn't Have S3-Compatible Endpoint

**Severity**: Moderate  
**Status**: ✅ Resolved with proxy endpoint

**Problem**: Local R2 buckets (miniflare) don't have S3-compatible endpoints accessible from browsers. Files uploaded via R2 binding cannot be accessed via presigned URLs.

**Solution**: Created a proxy endpoint for local development:

- `/api/pdf/[jobId]/file` - Reads from R2 binding directly
- Modified signed-url endpoint to detect local development and return proxy URL

**Lesson**: For local development with R2, use a proxy endpoint. Production uses presigned URLs for direct client-to-R2 downloads.

---

### Issue #6: `$state` Must Be at Component Top Level

**Severity**: Moderate  
**Status**: ✅ Resolved

**Problem**: Using `$state` inside a utility function doesn't work:

```typescript
// ❌ This doesn't work
export function createMediaQuery(query: string) {
  let matches = $state(false);  // Not reactive outside component!
}
```

**Solution**: Use Svelte's classic `writable` store which works anywhere:

```typescript
// ✅ This works
export function createMediaQuery(query: string): Readable<boolean> {
  const { subscribe, set } = writable(false);
  // ...
  return { subscribe };
}
```

**Lesson**: `$state` rune must be at the top level of a component to properly tie into the component's reactivity context. Use `writable` for cross-component reactivity.

---

### Issue #7: shadcn-svelte Generated Code Has Unused Variables

**Severity**: Minor  
**Status**: ✅ Resolved

**Problem**: The generated `resizable-pane-group.svelte` contained an unused `ref` variable causing lint errors.

**Solution**: Remove the unused `ref` variable from generated code.

**Lesson**: shadcn-svelte generated code sometimes includes template variables that aren't used. Run lint after adding components.

---

### Issue #8: pdfjs-dist v4.x TypeScript Type Mismatch

**Severity**: Minor  
**Status**: ✅ Resolved

**Problem**: pdfjs-dist v4.x `RenderParameters` interface doesn't include `canvas` property, but the runtime requires it.

**Solution**: Use type assertion:

```typescript
await page.render({
  canvasContext: context,
  viewport,
  canvas: canvasElement,
} as Parameters<typeof page.render>[0]).promise;
```

**Lesson**: Some libraries have TypeScript definition mismatches. Type assertions can bypass incorrect type definitions.

---

### Issue #9: ESLint `no-useless-children-snippet` Rule

**Severity**: Minor  
**Status**: ✅ Resolved

**Problem**: ESLint complains if you name a snippet `children` because Svelte 5 has a special implicit `children` snippet.

**Solution**: Use a descriptive name like `viewer` instead of `children`:

```svelte
<!-- ❌ Bad -->
{#snippet children()}
  ...
{/snippet}

<!-- ✅ Good -->
{#snippet viewer()}
  ...
{/snippet}
```

---

## Key Learnings Summary

### 1. Vite Bundles PDF Worker Automatically

No need to copy `pdf.worker.min.js` to `static/`. Vite handles the worker as a module asset:

```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;
```

**Advantages:**
- Automatic bundling
- Hashed filenames for cache invalidation
- Version consistency with pdfjs-dist

### 2. CORS Configuration via Dashboard Only

R2 CORS cannot be configured via `wrangler.jsonc`. Must use Cloudflare Dashboard or S3 API.

### 3. R2 Requires Separate S3 API Credentials

For presigned URLs, R2 requires separate credentials:
- `R2_ACCESS_KEY_ID` (Secret)
- `R2_SECRET_ACCESS_KEY` (Secret)
- `R2_ACCOUNT_ID` (Variable - public)
- `R2_BUCKET_NAME` (Variable - public)

### 4. Desktop-First Approach with Mobile Fallback

The layout shows a placeholder message on mobile:

```
"Mobile view coming soon. Please use a desktop browser."
```

This prioritizes the primary use case while deferring mobile support.

---

## Architecture Decisions

### Component Structure

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
```

### Data Flow

```
Server (page load)
    ↓
+page.server.ts → getJobById → validate ownership
    ↓
+page.svelte → receives job data
    ↓
Client (onMount)
    ↓
fetch /api/pdf/[jobId]/signed-url
    ↓
PdfViewer → dynamic import pdfjs-dist
    ↓
Load PDF from R2 (presigned URL or proxy)
```

---

## Files Created/Modified

| File | Purpose |
|------|---------|
| `src/lib/components/app/editor-layout.svelte` | Resizable panel layout |
| `src/lib/components/app/editor-top-bar.svelte` | Fixed top bar |
| `src/lib/components/app/metadata-panel.svelte` | Job metadata display |
| `src/lib/components/app/pdf-page-canvas.svelte` | Single page renderer |
| `src/lib/components/app/pdf-viewer.svelte` | Full PDF viewer |
| `src/lib/client/stores/media-query.ts` | Custom media query store |
| `src/lib/server/r2.ts` | R2 client and presigned URL helper |
| `src/routes/api/pdf/[jobId]/signed-url/+server.ts` | Presigned URL API |
| `src/routes/api/pdf/[jobId]/file/+server.ts` | Proxy endpoint for local dev |
| `src/routes/(app)/editor/[jobId]/+page.server.ts` | Job loading and validation |
| `src/routes/(app)/editor/[jobId]/+page.svelte` | Editor page integration |
| `src/lib/components/ui/resizable/` | shadcn Resizable component |
| `src/lib/components/ui/skeleton/` | shadcn Skeleton component |

---

## Next Phase

Phase 003: Region editor with Konva.js

---

## Related Documents

- [Phase 002 Task Document](../../tasks/phase-002-pdf-viewer.md)
- Task Learnings:
  - [Task 2A: Dependencies](../2026-03-14/03-phase-002-task-2a-dependencies.md)
  - [Task 2B: shadcn Components](../2026-03-14/04-phase-002-task-2b-shadcn-components.md)
  - [Task 2D: R2 CORS](../2026-03-14/05-phase-002-task-2d-r2-cors.md)
  - [Task 2E/2F: Presigned URL](../2026-03-14/06-phase-002-task-2e-2f-presigned-url.md)
  - [Task 2G: PDF Viewer Components](../2026-03-14/07-phase-002-task-2g-pdf-viewer-components.md)
  - [Task 2H: Editor Top Bar](./01-phase-002-task-2h-editor-top-bar.md)
  - [Task 2I: Metadata Panel](./02-phase-002-task-2i-metadata-panel.md)
  - [Task 2J: Editor Layout](./03-phase-002-task-2j-editor-layout.md)
  - [Task 2K: Editor Page](./04-phase-002-task-2k-editor-page.md)