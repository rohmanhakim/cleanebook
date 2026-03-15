# Phase 002 Task 2I: Metadata Panel Component

**Date:** 2026-03-15
**Task:** Create reusable metadata panel component

---

## What Was Done

1. Created `src/lib/components/app/metadata-panel.svelte` - Reusable metadata panel component
2. Updated `src/routes/(app)/editor/[jobId]/+page.svelte` - Integrated the new component

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/components/app/metadata-panel.svelte` | Created |
| `src/routes/(app)/editor/[jobId]/+page.svelte` | Updated |

---

## Key Learnings

### 1. Component Extraction Pattern (Continued)

This task followed the same pattern as Task 2H (EditorTopBar):

1. **Identify the props** - The component needs the full `Job` object
2. **Move helper functions** - `formatDate` and `statusColors` moved into the component
3. **Replace inline code with component** - Cleaner page component

### 2. Props Design: Single Object vs Multiple Props

When designing component props, consider:

**Option A: Single object prop (chosen)**
```typescript
interface Props {
  job: Job;
}
```

**Option B: Multiple individual props**
```typescript
interface Props {
  filename: string;
  pageCount: number;
  status: JobStatus;
  createdAt: string;
  errorMessage?: string;
  pipelineStep?: string;
}
```

**Why single object is better here:**
- Less prop drilling
- If Job type adds fields, component can use them without prop changes
- Cleaner component usage: `<MetadataPanel job={data.job} />`
- The Job object is already loaded from server-side data

### 3. Conditional Rendering Patterns

For optional fields in the metadata panel:

```svelte
{#if job.errorMessage}
  <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
    <p class="text-sm text-red-800">
      <strong>Error:</strong>
      {job.errorMessage}
    </p>
  </div>
{/if}
```

This pattern:
- Only renders when data exists
- Keeps the UI clean for normal cases
- Provides visibility into issues when they occur

---

## Component Architecture

### MetadataPanel

**Responsibility:** Display document metadata in a sidebar panel

**Props:**
- `job: Job` - The job object containing all metadata (required)

**Features:**
- Document Info heading
- Filename (truncated if too long)
- Page count
- Status badge with color coding
- Upload timestamp
- Error message (conditional)
- Pipeline step (conditional)

**Styling:**
- Uses Tailwind classes for all styling
- Status badge colors defined in `statusColors` map
- Error message uses red color scheme for visibility

---

## Testing Notes

For manual testing:
1. Start dev server: `pnpm dev`
2. Upload a PDF at landing page
3. Navigate to editor page
4. Verify metadata panel shows:
   - Correct filename
   - Page count matches PDF
   - Status badge (should show status)
   - Upload timestamp

Test error state by checking a job with `status: 'failed'` and an `errorMessage`.

---

## Related Tasks

- **Task 2H:** Editor Top Bar Component (previous)
- **Task 2J:** Editor Layout Component (next - resizable panels)