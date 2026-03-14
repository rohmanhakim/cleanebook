# Phase 002: PDF Viewer with Resizable Layout

## Overview

Implement a PDF viewer that allows users to read PDF contents with vertical scrolling. The editor page will have a three-part layout: fixed top bar, resizable PDF viewer (left), and metadata panel (right).

## Goals

1. Users can view uploaded PDFs in a vertical scrolling layout
2. PDFs load efficiently via presigned R2 URLs (direct client-to-R2 download)
3. Resizable panels allow users to adjust viewer/metadata split
4. Desktop-first experience with mobile placeholder

## Constraints

- PDF rendering is **client-side only** (pdfjs-dist) - never import in server routes
- Presigned URLs provide secure, time-limited access to R2 objects
- No advanced features: find, navigation, zoom, panning, text selection (future phases)

---

## Task 2A: Install Dependencies

### Files

| File | Action |
|------|--------|
| `package.json` | Update |

### Tasks

- [ ] Install AWS SDK packages for R2 presigned URLs:
  - `@aws-sdk/client-s3`
  - `@aws-sdk/s3-request-presigner`
- [ ] Install `svelte-resizable-panels` (dependency for shadcn Resizable)
- [ ] Install `svelte-media-query-store` for responsive detection
- [ ] Run `pnpm install`

### Rationale

AWS SDK packages enable S3-compatible presigned URL generation for R2. The `svelte-resizable-panels` is required by shadcn-svelte's Resizable component. The media query store provides reactive desktop/mobile detection.

---

## Task 2B: Add shadcn Components

### Files

| File | Action |
|------|--------|
| `src/lib/components/ui/resizable/` | Create |
| `src/lib/components/ui/skeleton/` | Create |

### Tasks

- [ ] Run `npx shadcn-svelte@latest add resizable`
- [ ] Run `npx shadcn-svelte@latest add skeleton`

### Rationale

Resizable provides the split-panel layout. Skeleton provides loading placeholders while PDF loads.

---

## Task 2C: Constants and Types

### Files

| File | Action |
|------|--------|
| `src/lib/shared/constants.ts` | Update |
| `src/lib/shared/types.ts` | Update |

### Tasks

- [ ] Add to `constants.ts`:
  ```typescript
  // PDF presigned URL configuration
  export const PDF_PRESIGNED_URL_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours (configurable)
  ```
- [ ] Add to `types.ts`:
  ```typescript
  // PDF viewer state
  export interface PdfViewerState {
    isLoading: boolean;
    error: string | null;
    currentPage: number;
    totalPages: number;
    scale: number;
  }
  
  // Presigned URL response
  export interface PresignedUrlResponse {
    url: string;
    expiresAt: string; // ISO datetime
  }
  ```

### Rationale

Configurable expiry time allows tuning based on usage patterns. Types ensure type safety across client and server.

---

## Task 2D: R2 CORS Configuration

### Files

| File | Action |
|------|--------|
| `wrangler.dev.jsonc` | Update |
| `wrangler.prod.jsonc` | Update |

### Tasks

- [ ] Add CORS configuration to R2 bucket for browser access:
  ```jsonc
  // In wrangler config, R2 bucket needs CORS rules
  // This may need to be configured via Cloudflare dashboard or API
  // since wrangler doesn't support R2 CORS in config yet
  ```
- [ ] Document CORS configuration steps in task notes

### Rationale

Browsers require CORS headers when fetching from R2. The presigned URL points to R2's S3-compatible endpoint, which needs CORS configured to allow cross-origin requests from the app domain.

### Implementation Notes

CORS configuration for R2 is done via:
1. Cloudflare Dashboard → R2 → Bucket → Settings → CORS Policy
2. Or via S3 API with `PutBucketCors`

Example CORS policy:
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://cleanebook.app", "http://localhost:5173"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

---

## Task 2E: Presigned URL API Endpoint

### Files

| File | Action |
|------|--------|
| `src/routes/api/pdf/[jobId]/signed-url/+server.ts` | Create |
| `src/lib/server/r2.ts` | Create |

### Tasks

- [ ] Create `src/lib/server/r2.ts` with:
  ```typescript
  import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
  import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
  import type { Platform } from '@cloudflare/workers-types';
  import { PDF_PRESIGNED_URL_EXPIRY_SECONDS } from '$lib/shared/constants';
  
  /**
   * Create S3 client for R2
   * R2 uses S3-compatible API with account-specific endpoint
   */
  export function createR2Client(platform: Platform): S3Client {
    const accountId = platform.env.R2_ACCOUNT_ID; // Need to add to bindings
    const accessKeyId = platform.env.R2_ACCESS_KEY_ID; // Need to add to bindings
    const secretAccessKey = platform.env.R2_SECRET_ACCESS_KEY; // Need to add to bindings
    
    return new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  
  /**
   * Generate a presigned URL for downloading a PDF from R2
   * URL is valid for PDF_PRESIGNED_URL_EXPIRY_SECONDS seconds
   */
  export async function generatePresignedUrl(
    client: S3Client,
    bucketName: string,
    key: string
  ): Promise<{ url: string; expiresAt: Date }> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    const url = await getSignedUrl(client, command, {
      expiresIn: PDF_PRESIGNED_URL_EXPIRY_SECONDS,
    });
    
    const expiresAt = new Date(Date.now() + PDF_PRESIGNED_URL_EXPIRY_SECONDS * 1000);
    
    return { url, expiresAt };
  }
  ```

- [ ] Create `src/routes/api/pdf/[jobId]/signed-url/+server.ts`:
  ```typescript
  import { error, json } from '@sveltejs/kit';
  import type { RequestHandler } from './$types';
  import { getJobById } from '$lib/server/db';
  import { createR2Client, generatePresignedUrl } from '$lib/server/r2';
  import { PDF_PRESIGNED_URL_EXPIRY_SECONDS } from '$lib/shared/constants';
  
  export const GET: RequestHandler = async ({ params, locals, platform }) => {
    const { jobId } = params;
    const user = locals.user;
    
    if (!user) {
      error(401, 'Unauthorized');
    }
    
    const db = platform?.env?.DB;
    if (!db) {
      error(500, 'Database not available');
    }
    
    // Get job and verify ownership
    const job = await getJobById(db, jobId);
    if (!job || job.userId !== user.id) {
      error(404, 'Job not found');
    }
    
    // Create R2 client and generate presigned URL
    const r2Client = createR2Client(platform!);
    const bucketName = platform?.env?.R2_BUCKET_NAME || 'cleanebook-uploads'; // Add to bindings
    
    const { url, expiresAt } = await generatePresignedUrl(r2Client, bucketName, job.pdfKey);
    
    return json({
      url,
      expiresAt: expiresAt.toISOString(),
      expiresIn: PDF_PRESIGNED_URL_EXPIRY_SECONDS,
    });
  };
  ```

### Rationale

Presigned URLs allow clients to download directly from R2 without server proxying. This minimizes server load and provides the fastest possible experience. The server only validates auth and generates the URL.

---

## Task 2F: Update CF Bindings

### Files

| File | Action |
|------|--------|
| `src/app.d.ts` | Update |
| `wrangler.dev.jsonc` | Update |
| `wrangler.prod.jsonc` | Update |

### Tasks

- [ ] Add R2 credentials to `app.d.ts` Platform.env interface:
  ```typescript
  interface Platform {
    env: {
      // ... existing bindings ...
      // R2 S3-compatible API credentials
      R2_ACCOUNT_ID: string;
      R2_ACCESS_KEY_ID: string;
      R2_SECRET_ACCESS_KEY: string;
      R2_BUCKET_NAME: string;
    };
  }
  ```
- [ ] Add secrets to wrangler configs (reference only, actual secrets set via dashboard):
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`

### Rationale

R2's presigned URL feature requires S3 API credentials (Access Key ID + Secret Access Key), separate from the native R2 binding. These are created via Cloudflare Dashboard → R2 → Manage R2 API Tokens.

---

## Task 2G: PDF Viewer Components

### Files

| File | Action |
|------|--------|
| `src/lib/components/app/pdf-page-canvas.svelte` | Create |
| `src/lib/components/app/pdf-viewer.svelte` | Create |

### Tasks

- [ ] Create `src/lib/components/app/pdf-page-canvas.svelte`:
  - Accepts `page` (PDFPageProxy) and `scale` as props
  - Renders single page to canvas
  - Handles canvas sizing and scaling
  - Emits `onload` event when rendered

- [ ] Create `src/lib/components/app/pdf-viewer.svelte`:
  - Accepts `presignedUrl` as prop
  - Uses pdfjs-dist to load PDF document
  - Renders all pages in vertical scroll container
  - Shows loading skeleton while pages render
  - Shows error state if PDF fails to load
  - Uses IntersectionObserver for lazy page rendering

### Implementation Sketch

```svelte
<!-- pdf-viewer.svelte -->
<script lang="ts">
  import * as pdfjs from 'pdfjs-dist';
  import PdfPageCanvas from './pdf-page-canvas.svelte';
  import { Skeleton } from '$lib/components/ui/skeleton';
  
  // Set worker source
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  
  interface Props {
    presignedUrl: string;
  }
  
  let { presignedUrl }: Props = $props();
  
  let pdfDoc: pdfjs.PDFDocumentProxy | null = $state(null);
  let pages: pdfjs.PDFPageProxy[] = $state([]);
  let isLoading = $state(true);
  let error: string | null = $state(null);
  
  // Load PDF on mount
  $effect(() => {
    loadPdf(presignedUrl);
  });
  
  async function loadPdf(url: string) {
    try {
      isLoading = true;
      error = null;
      
      const loadingTask = pdfjs.getDocument(url);
      pdfDoc = await loadingTask.promise;
      
      // Load all pages
      pages = await Promise.all(
        Array.from({ length: pdfDoc.numPages }, (_, i) => 
          pdfDoc!.getPage(i + 1)
        )
      );
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load PDF';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="pdf-viewer">
  {#if isLoading}
    <!-- Loading skeletons -->
    {#each Array(5) as _}
      <Skeleton class="h-200 w-full mb-4" />
    {/each}
  {:else if error}
    <div class="text-red-500 p-4">{error}</div>
  {:else}
    {#each pages as page, i}
      <PdfPageCanvas {page} scale={1.5} />
    {/each}
  {/if}
</div>
```

### Rationale

Splitting into page canvas and viewer components allows for future optimizations like virtual scrolling. The viewer handles document loading, the page canvas handles individual page rendering.

---

## Task 2H: Editor Top Bar Component

### Files

| File | Action |
|------|--------|
| `src/lib/components/app/editor-top-bar.svelte` | Create |

### Tasks

- [ ] Create fixed top bar with:
  - Left: Logo linking to root (`/`)
  - Center: PDF filename (truncated if too long)
  - Right: "Sign In" button (non-functional placeholder)
- [ ] Use appropriate styling (fixed position, full width, border bottom)
- [ ] Account for top bar height in main content area

### Implementation Sketch

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  
  interface Props {
    filename: string;
  }
  
  let { filename }: Props = $props();
</script>

<header class="fixed top-0 left-0 right-0 h-14 bg-background border-b z-50">
  <div class="h-full px-4 flex items-center justify-between">
    <!-- Logo -->
    <a href="/" class="font-semibold text-lg hover:opacity-80">
      CleanEbook
    </a>
    
    <!-- Filename -->
    <div class="absolute left-1/2 -translate-x-1/2 max-w-[40%]">
      <span class="text-sm text-muted-foreground truncate block">
        {filename}
      </span>
    </div>
    
    <!-- Sign In -->
    <Button variant="outline" size="sm">
      Sign In
    </Button>
  </div>
</header>
```

### Rationale

The top bar provides context (filename) and navigation (logo, sign in) without cluttering the main viewer area.

---

## Task 2I: Metadata Panel Component

### Files

| File | Action |
|------|--------|
| `src/lib/components/app/metadata-panel.svelte` | Create |

### Tasks

- [ ] Create metadata panel displaying job information:
  - Filename
  - Page count
  - Status (with badge)
  - Created date
- [ ] Use existing job data from page load (no additional API call)
- [ ] Style appropriately for right panel

### Implementation Sketch

```svelte
<script lang="ts">
  import type { Job } from '$lib/shared/types';
  import { Badge } from '$lib/components/ui/badge';
  
  interface Props {
    job: Job;
  }
  
  let { job }: Props = $props();
  
  const statusColors: Record<string, string> = {
    queued: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    complete: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    // ...
  };
</script>

<div class="p-4 space-y-4">
  <h2 class="font-semibold">Document Info</h2>
  
  <dl class="space-y-2 text-sm">
    <div>
      <dt class="text-muted-foreground">Filename</dt>
      <dd class="font-medium">{job.pdfFilename}</dd>
    </div>
    
    <div>
      <dt class="text-muted-foreground">Pages</dt>
      <dd>{job.pdfPageCount}</dd>
    </div>
    
    <div>
      <dt class="text-muted-foreground">Status</dt>
      <dd>
        <Badge class={statusColors[job.status]}>
          {job.status}
        </Badge>
      </dd>
    </div>
    
    <div>
      <dt class="text-muted-foreground">Uploaded</dt>
      <dd>{new Date(job.createdAt).toLocaleString()}</dd>
    </div>
  </dl>
</div>
```

### Rationale

The metadata panel provides at-a-glance information about the current document. Using existing job data avoids unnecessary API calls.

---

## Task 2J: Editor Layout Component

### Files

| File | Action |
|------|--------|
| `src/lib/components/app/editor-layout.svelte` | Create |

### Tasks

- [ ] Create resizable layout using shadcn Resizable:
  - Left panel: PDF viewer (default 70% width)
  - Right panel: Metadata (default 30% width)
  - Minimum sizes for both panels
- [ ] Handle desktop/mobile detection using `svelte-media-query-store`
- [ ] Mobile: Show placeholder message

### Implementation Sketch

```svelte
<script lang="ts">
  import { PaneGroup, Pane, PaneResizer } from '$lib/components/ui/resizable';
  import { createMediaStore } from 'svelte-media-query-store';
  
  interface Props {
    children: import('svelte').Snippet;
    metadataPanel: import('svelte').Snippet;
  }
  
  let { children, metadataPanel }: Props = $props();
  
  // Desktop detection
  const isDesktop = createMediaStore('(min-width: 768px)');
</script>

{#if $isDesktop}
  <div class="h-[calc(100vh-3.5rem)]">
    <PaneGroup direction="horizontal">
      <Pane defaultSize={70} minSize={40}>
        {@render children()}
      </Pane>
      <PaneResizer />
      <Pane defaultSize={30} minSize={20}>
        {@render metadataPanel()}
      </Pane>
    </PaneGroup>
  </div>
{:else}
  <div class="flex items-center justify-center h-full">
    <p class="text-muted-foreground">
      Mobile view coming soon. Please use a desktop browser.
    </p>
  </div>
{/if}
```

### Rationale

Resizable panels let users customize their workspace. The desktop-first approach prioritizes the primary use case while mobile is deferred.

---

## Task 2K: Update Editor Page

### Files

| File | Action |
|------|--------|
| `src/routes/(app)/editor/[jobId]/+page.svelte` | Update |
| `src/routes/(app)/editor/[jobId]/+page.server.ts` | Update |

### Tasks

- [ ] Update `+page.server.ts` to pass all needed job data
- [ ] Update `+page.svelte` to use new layout:
  - Top bar (fixed)
  - Resizable PDF viewer + metadata panel
  - Fetch presigned URL on client-side mount
- [ ] Handle loading and error states for presigned URL fetch

### Implementation Sketch

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import EditorTopBar from '$lib/components/app/editor-top-bar.svelte';
  import EditorLayout from '$lib/components/app/editor-layout.svelte';
  import PdfViewer from '$lib/components/app/pdf-viewer.svelte';
  import MetadataPanel from '$lib/components/app/metadata-panel.svelte';
  import type { PresignedUrlResponse } from '$lib/shared/types';
  
  let { data }: { data: PageData } = $props();
  
  let presignedUrl: string | null = $state(null);
  let isLoading = $state(true);
  let error: string | null = $state(null);
  
  onMount(async () => {
    try {
      const response = await fetch(`/api/pdf/${data.job.id}/signed-url`);
      if (!response.ok) throw new Error('Failed to get PDF URL');
      
      const result: PresignedUrlResponse = await response.json();
      presignedUrl = result.url;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load PDF';
    } finally {
      isLoading = false;
    }
  });
</script>

<svelte:head>
  <title>Editor — {data.job.pdfFilename}</title>
</svelte:head>

<EditorTopBar filename={data.job.pdfFilename} />

<main class="pt-14 h-screen">
  <EditorLayout>
    {#snippet children()}
      <div class="h-full overflow-auto bg-muted/30 p-4">
        {#if isLoading}
          <p>Loading PDF...</p>
        {:else if error}
          <p class="text-red-500">{error}</p>
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
</main>
```

### Rationale

The updated page integrates all components. Presigned URL is fetched client-side to avoid server-side pdfjs-dist issues.

---

## Task 2L: Copy PDF Worker to Static

### Files

| File | Action |
|------|--------|
| `static/pdf.worker.min.js` | Create (copy) |

### Tasks

- [ ] Copy `pdf.worker.min.js` from `pdfjs-dist` package to `static/`:
  - Source: `node_modules/pdfjs-dist/build/pdf.worker.min.mjs`
  - Destination: `static/pdf.worker.min.mjs`
- [ ] Or configure Vite to bundle the worker correctly
- [ ] Document the approach in task notes

### Rationale

pdfjs-dist requires a web worker for PDF parsing. The worker file must be served statically and referenced correctly in the PDF viewer configuration.

---

## Testing Checklist

After implementation, verify:

- [ ] Desktop layout renders with resizable panels
- [ ] PDF loads and displays all pages vertically
- [ ] Presigned URL is generated correctly
- [ ] PDF downloads directly from R2 (check Network tab)
- [ ] CORS headers present on R2 responses
- [ ] Top bar shows correct filename
- [ ] Metadata panel shows correct job info
- [ ] Mobile shows placeholder message
- [ ] Error states handled gracefully
- [ ] No server-side import of pdfjs-dist

---

## Future Phases (Not In Scope)

- Phase 003: Region editor with Konva.js
- Phase 004: OCR pipeline integration
- Phase 005: EPUB preview and download
- Phase 006: Advanced PDF features (zoom, find, navigation)
- Phase 007: Mobile responsive layout