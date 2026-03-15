# Phase 002 Task 2J: Editor Layout Component

**Date:** 2026-03-15
**Task:** Create resizable editor layout component

---

## What Was Done

1. Created `src/lib/components/app/editor-layout.svelte` - Resizable layout component
2. Updated `src/routes/(app)/editor/[jobId]/+page.svelte` - Integrated the new layout

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/components/app/editor-layout.svelte` | Created |
| `src/routes/(app)/editor/[jobId]/+page.svelte` | Updated |

---

## Key Learnings

### 1. svelte-media-query-store Usage

The `svelte-media-query-store` package exports `mediaQueryStore`, not `createMediaStore`:

```typescript
import { mediaQueryStore } from 'svelte-media-query-store';
import { browser } from '$app/environment';

// Must check for browser since the store uses window.matchMedia
const isDesktop = browser ? mediaQueryStore('(min-width: 768px)') : null;
```

**Important:** The store requires `window.matchMedia`, so it must be guarded with `browser` check to avoid SSR errors.

### 2. Paneforge Resizable Panels

The shadcn-svelte Resizable component uses `paneforge` under the hood:

```svelte
<script lang="ts">
  import { PaneGroup, Pane, Handle } from '$lib/components/ui/resizable';
</script>

<PaneGroup direction="horizontal">
  <Pane defaultSize={70} minSize={40}>
    <!-- Content -->
  </Pane>
  <Handle />
  <Pane defaultSize={30} minSize={20}>
    <!-- Content -->
  </Pane>
</PaneGroup>
```

**Key props:**
- `direction`: 'horizontal' or 'vertical'
- `defaultSize`: Initial size in percentage
- `minSize`: Minimum size in percentage (prevents collapse)

### 3. ESLint Rule: no-useless-children-snippet

ESLint complains if you name a snippet `children` because Svelte 5 has a special implicit `children` snippet:

```
error  Found an unnecessary children snippet  svelte/no-useless-children-snippet
```

**Solution:** Use a descriptive name like `viewer` instead of `children`:

```svelte
<!-- ❌ Bad: triggers ESLint error -->
{#snippet children()}
  ...
{/snippet}

<!-- ✅ Good: use descriptive name -->
{#snippet viewer()}
  ...
{/snippet}
```

### 4. Snippet Props in Svelte 5

When defining a component that accepts snippets as props:

```typescript
interface Props {
  viewer: import('svelte').Snippet;
  metadataPanel: import('svelte').Snippet;
}

let { viewer, metadataPanel }: Props = $props();
```

Then render them with `{@render viewer()}` and `{@render metadataPanel()}`.

### 5. Height Calculation with Fixed Top Bar

When you have a fixed top bar (`h-14` = 3.5rem), the content area needs to account for it:

```svelte
<!-- Top bar: fixed, h-14 (3.5rem) -->
<EditorTopBar />

<!-- Content: offset by top bar height -->
<div class="pt-14 h-full">
  <EditorLayout />  <!-- Uses h-[calc(100vh-3.5rem)] -->
</div>
```

The `EditorLayout` component uses `h-[calc(100vh-3.5rem)]` to fill the remaining viewport height.

---

## Component Architecture

### EditorLayout

**Responsibility:** Provide resizable panel layout with mobile fallback

**Props:**
- `viewer: Snippet` - PDF viewer content
- `metadataPanel: Snippet` - Metadata panel content

**Features:**
- Resizable horizontal panels (70/30 split by default)
- Desktop detection via media query
- Mobile placeholder message

**Styling:**
- Uses `h-[calc(100vh-3.5rem)]` to fill remaining viewport
- Pane sizes: left 70% (min 40%), right 30% (min 20%)

---

## Testing Notes

For manual testing:
1. Start dev server: `pnpm dev`
2. Upload a PDF at landing page
3. Navigate to editor page
4. Verify:
   - Panels are resizable by dragging the handle
   - PDF viewer is on the left (larger panel)
   - Metadata panel is on the right (smaller panel)
   - Resize browser to mobile width and see placeholder message

---

## Related Tasks

- **Task 2H:** Editor Top Bar Component
- **Task 2I:** Metadata Panel Component
- **Task 2K:** Update Editor Page (integrates all components)