# CleanEbook — UI Routes & Components

## Route Map

### Marketing (prerendered, static)

| Route | Page | Key components |
|---|---|---|
| `/` | Landing page | `Hero`, `HowItWorks`, `Features`, `Pricing` |
| `/pricing` | Pricing detail | `Pricing`, comparison table |
| `/about` | About | Static content |
| `/contact` | Contact | `sveltekit-superforms` contact form |

### Auth

| Route | Page | Notes |
|---|---|---|
| `/login` | Email + password login | Form action, no JS required |
| `/register` | Sign up | Form action |
| `/login/github` | GitHub OAuth redirect | Server-only route |
| `/login/github/callback` | GitHub callback | Server-only route |
| `/logout` | POST only | Clears session cookie |

### App (auth-gated)

| Route | Page | Key components |
|---|---|---|
| `/dashboard` | Job history + usage | `JobsTable`, usage meter |
| `/upload` | Upload entry point | Drop zone, file picker |
| `/editor/:jobId` | Main editor | `PDFViewer`, `RegionEditor`, `JobStatusBar`, `ExceptionQueue`, `EpubPreview` |
| `/templates` | Saved templates list | Templates grid |
| `/templates/:id` | Edit template rules | `TemplateRules`, `RegionEditor` |
| `/settings` | Account settings | BYOK key form, plan info, profile |

### Admin (role=admin only)

| Route | Page |
|---|---|
| `/admin` | Overview: users, jobs, revenue summary |
| `/admin/users` | User management table |
| `/admin/jobs` | All jobs with retry/cancel |
| `/admin/models` | HF model configuration |
| `/admin/settings` | Global feature flags, plan limits |

---

## Editor Page — The Core UI

`/editor/:jobId` is the most complex page. It has distinct phases:

### Phase 1: Template Selection
- Show saved templates
- Option to start fresh (define new rules)
- "Auto-detect" option (skips editor, goes straight to pipeline — for simple uniform books)

### Phase 2: Region Editor (if no template or user wants to refine)
```
┌─────────────────────────────────────────────────────────┐
│  Toolbar: [▣ Content] [⬡ Figure] [⊘ Chrome] [≡ Code]   │
│           [↑ Heading] [— Caption] [∗ Footnote]          │
├───────────────────────┬─────────────────────────────────┤
│   PDF Viewer          │   EPUB Preview (live)           │
│   (PDF.js canvas)     │   Updates as regions are drawn  │
│                       │                                 │
│   User draws          │   Shows structured text         │
│   bounding boxes      │   output in real-time           │
│   on the page         │                                 │
│                       │                                 │
│   [← Prev] [→ Next]   │                                 │
├───────────────────────┴─────────────────────────────────┤
│  Sample page: 1  [Apply to all pages →]  [Save template]│
└─────────────────────────────────────────────────────────┘
```

### Phase 3: Processing (status polling)
```
┌──────────────────────────────────────────────────┐
│  Converting: my-book.pdf                         │
│                                                  │
│  ████████████░░░░░░  Step 3 of 5: OCR            │
│  Processing pages 45–55 of 312                   │
│                                                  │
│  Model: lightonai/LightOnOCR-2-1B                │
└──────────────────────────────────────────────────┘
```

### Phase 4: Exception Queue (if review pages exist)
```
┌──────────────────────────────────────────────────┐
│  ⚠ 4 pages need your review                     │
│                                                  │
│  [Page 47] [Page 103] [Page 201] [Page 287]      │
│                                                  │
│  Click each to confirm or correct regions,       │
│  then click Continue.                            │
│                                                  │
│  [Continue →]                                    │
└──────────────────────────────────────────────────┘
```

### Phase 5: Complete
```
┌──────────────────────────────────────────────────┐
│  ✓ Your EPUB is ready                           │
│                                                  │
│  my-book.epub  ·  2.4 MB  ·  312 pages          │
│                                                  │
│  [⬇ Download EPUB]  [Convert another →]         │
│                                                  │
│  Save template for future use?                   │
│  [Save as "O'Reilly Books"]                      │
└──────────────────────────────────────────────────┘
```

---

## TanStack Query Usage

Job status polling on the editor page:

```typescript
// src/routes/(app)/editor/[jobId]/+page.svelte
import { createQuery } from '@tanstack/svelte-query';

const jobQuery = createQuery({
  queryKey: ['job', jobId],
  queryFn: () => fetch(`/api/job/${jobId}`).then(r => r.json()),
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    // Stop polling when terminal state reached
    if (status === 'complete' || status === 'failed' || status === 'cancelled') {
      return false;
    }
    // Poll faster during active processing
    if (status === 'processing') return 2000;
    // Slower poll when waiting for user review
    if (status === 'needs_review') return 10000;
    return 3000;
  },
});
```

---

## Svelte Stores

### job.ts
```typescript
// Writable store — current active job state
// Updated by TanStack Query results
export const currentJob = writable<Job | null>(null);
export const jobPhase = derived(currentJob, ($job) => {
  if (!$job) return 'idle';
  if ($job.status === 'queued' || $job.status === 'processing') return 'processing';
  if ($job.status === 'needs_review') return 'review';
  if ($job.status === 'complete') return 'complete';
  if ($job.status === 'failed') return 'error';
  return 'idle';
});
```

### editor.ts
```typescript
// Editor state — region drawing, selected tool, page navigation
export const selectedTool = writable<RegionLabel>('content');
export const currentPageIndex = writable(0);
export const drawnRegions = writable<Map<number, RegionRule[]>>(new Map());
// (keyed by page index)
```

---

## shadcn-svelte Components Used

Install these components via the CLI:
```bash
npx shadcn-svelte@latest add button
npx shadcn-svelte@latest add dialog
npx shadcn-svelte@latest add progress
npx shadcn-svelte@latest add tabs
npx shadcn-svelte@latest add badge
npx shadcn-svelte@latest add tooltip
npx shadcn-svelte@latest add dropdown-menu
npx shadcn-svelte@latest add select
npx shadcn-svelte@latest add input
npx shadcn-svelte@latest add label
npx shadcn-svelte@latest add separator
npx shadcn-svelte@latest add sheet
npx shadcn-svelte@latest add skeleton
npx shadcn-svelte@latest add table
npx shadcn-svelte@latest add alert
```

These are copied into `src/lib/components/ui/`. Do NOT edit them — 
re-run the add command to update. Customize via CSS variables in `app.css`.

---

## Toast Notifications (svelte-sonner)

```svelte
<!-- src/app.html or root +layout.svelte -->
<script>
  import { Toaster } from 'svelte-sonner';
</script>
<Toaster position="bottom-right" richColors />
```

```typescript
// Usage anywhere
import { toast } from 'svelte-sonner';

toast.success('EPUB ready!');
toast.error('Conversion failed', { description: error.message });
toast.info('3 pages need your review');
toast.loading('Processing...', { id: 'job-toast' });
toast.dismiss('job-toast');
```
