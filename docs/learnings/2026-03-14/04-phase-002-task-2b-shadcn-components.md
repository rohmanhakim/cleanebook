# Phase 002 Task 2B: Add shadcn Components

**Date:** 2026-03-14
**Task:** Add shadcn-svelte Resizable and Skeleton components

---

## What Was Done

Added two shadcn-svelte components required for the PDF viewer layout:

| Component | Purpose |
|-----------|---------|
| **Resizable** | Split-panel layout for PDF viewer + metadata panel |
| **Skeleton** | Loading placeholders while PDF loads |

### Files Created

```
src/lib/components/ui/resizable/
├── index.ts
├── resizable-pane-group.svelte
└── resizable-handle.svelte

src/lib/components/ui/skeleton/
├── index.ts
└── skeleton.svelte
```

---

## Key Learnings

### 1. shadcn-svelte CLI is Interactive

The shadcn-svelte CLI prompts for confirmation before installing:

```
◆  Ready to install components and dependencies?
│  ● Yes / ○ No
```

This requires user interaction - the command cannot be fully automated without user input.

### 2. Generated Code May Have Lint Errors

The generated `resizable-pane-group.svelte` contained an unused `ref` variable:

```svelte
<script lang="ts">
  let {
    ref = $bindable(null),  // ❌ unused - causes lint error
    this: paneGroup = $bindable(),
    ...
  } = $props();
</script>
```

**Fix:** Remove the unused `ref` variable:

```svelte
<script lang="ts">
  let {
    this: paneGroup = $bindable(),  // ✅ only keep what's used
    ...
  } = $props();
</script>
```

This is a known issue with shadcn-svelte generated code - it sometimes includes template variables that aren't actually used.

### 3. Component Structure

The resizable component uses `paneforge` under the hood and exposes:

- `PaneGroup` - Container for resizable panels
- `Pane` - Individual panel
- `Handle` - Draggable divider between panels

Usage pattern:

```svelte
<script>
  import { PaneGroup, Pane, Handle } from '$lib/components/ui/resizable';
</script>

<PaneGroup direction="horizontal">
  <Pane defaultSize={70}>Left content</Pane>
  <Handle />
  <Pane defaultSize={30}>Right content</Pane>
</PaneGroup>
```

---

## Commands Used

```bash
# Add resizable component (uses paneforge)
source ~/.nvm/nvm.sh && npx shadcn-svelte@latest add resizable

# Add skeleton component
source ~/.nvm/nvm.sh && npx shadcn-svelte@latest add skeleton
```

---

## Next Steps

Task 2C will add:
- `PDF_PRESIGNED_URL_EXPIRY_SECONDS` constant
- `PdfViewerState` interface
- `PresignedUrlResponse` interface