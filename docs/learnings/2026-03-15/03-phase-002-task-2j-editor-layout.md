# Phase 002 Task 2J: Editor Layout Component

**Date:** 2026-03-15
**Task:** Create resizable editor layout component

---

## What Was Done

1. Created `src/lib/components/app/editor-layout.svelte` - Resizable layout component
2. Created `src/lib/client/stores/media-query.ts` - Custom media query store
3. Updated `src/routes/(app)/editor/[jobId]/+page.svelte` - Integrated the new layout

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/components/app/editor-layout.svelte` | Created |
| `src/lib/client/stores/media-query.ts` | Created |
| `src/routes/(app)/editor/[jobId]/+page.svelte` | Updated |

---

## Key Learnings

### 1. $state Must Be Used at Component Top Level

**Problem:** Using `$state` inside a utility function doesn't work:

```typescript
// ❌ This doesn't work - $state inside a function
export function createMediaQuery(query: string) {
  let matches = $state(false);  // Not reactive outside component!
  ...
}
```

**Why:** Svelte 5's `$state` rune must be at the top level of a component to properly tie into the component's reactivity context. When used inside a function, it doesn't connect to any component's reactivity graph.

### 2. Use `writable` Store for Cross-Component Reactivity

**Solution:** Use Svelte's classic `writable` store which works anywhere:

```typescript
import { writable, type Readable } from 'svelte/store';
import { browser } from '$app/environment';

export function createMediaQuery(query: string): Readable<boolean> {
  const { subscribe, set } = writable(false);

  if (browser) {
    const mql = window.matchMedia(query);
    set(mql.matches);

    mql.addEventListener('change', (e) => {
      set(e.matches);
    });
  }

  return { subscribe };
}
```

**Usage in component:**

```svelte
<script>
  import { createMediaQuery } from '$lib/client/stores/media-query';

  const isDesktop = createMediaQuery('(min-width: 768px)');
</script>

{#if $isDesktop}
  <!-- Desktop content -->
{:else}
  <!-- Mobile content -->
{/if}
```

**Key points:**
- `writable` is Svelte's core reactivity primitive
- Use `$` prefix to auto-subscribe to the store
- Works in any context, not just components
- Always check `browser` before accessing `window.matchMedia`

### 3. svelte-media-query-store Package Issues

The `svelte-media-query-store` package has module resolution issues:

```
Cannot find module '.../svelte-media-query-store/mediaQueryStore'
```

The package's `index.js` imports `./mediaQueryStore` without the `.js` extension, which fails with ESM module resolution.

**Lesson:** Avoid packages with ESM compatibility issues. Creating a simple utility is often more reliable.

### 4. Paneforge Resizable Panels

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

### 5. ESLint Rule: no-useless-children-snippet

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

### 6. Height Calculation with Fixed Top Bar

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
- Desktop detection via custom media query store
- Mobile placeholder message

**Styling:**
- Uses `h-[calc(100vh-3.5rem)]` to fill remaining viewport
- Pane sizes: left 70% (min 40%), right 30% (min 20%)

### createMediaQuery

**Responsibility:** Provide reactive media query matching

**Parameters:**
- `query: string` - CSS media query string (e.g., '(min-width: 768px)')

**Returns:**
- `Readable<boolean>` - A Svelte store containing `true` if the query matches

**Features:**
- Returns `false` during SSR (no `window` available)
- Updates reactively when viewport changes
- Uses `window.matchMedia` for efficient change detection

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