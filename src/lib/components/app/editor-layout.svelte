<script lang="ts">
  import { PaneGroup, Pane, Handle } from '$lib/components/ui/resizable';
  import { mediaQueryStore } from 'svelte-media-query-store';
  import { browser } from '$app/environment';

  interface Props {
    viewer: import('svelte').Snippet;
    metadataPanel: import('svelte').Snippet;
  }

  let { viewer, metadataPanel }: Props = $props();

  // Desktop detection (768px = md breakpoint)
  // Returns true on desktop, false on mobile, null during SSR
  const isDesktop = browser ? mediaQueryStore('(min-width: 768px)') : null;
</script>

{#if $isDesktop}
  <div class="h-[calc(100vh-3.5rem)]">
    <PaneGroup direction="horizontal">
      <Pane defaultSize={70} minSize={40}>
        {@render viewer()}
      </Pane>
      <Handle />
      <Pane defaultSize={30} minSize={20}>
        {@render metadataPanel()}
      </Pane>
    </PaneGroup>
  </div>
{:else}
  <div class="flex items-center justify-center h-[calc(100vh-3.5rem)]">
    <p class="text-muted-foreground text-center p-4">
      Mobile view coming soon. Please use a desktop browser.
    </p>
  </div>
{/if}
