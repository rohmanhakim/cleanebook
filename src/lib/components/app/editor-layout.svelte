<script lang="ts">
  import { PaneGroup, Pane, Handle } from '$lib/components/ui/resizable';
  import { createMediaQuery } from '$lib/client/stores/media-query';

  interface Props {
    viewer: import('svelte').Snippet;
    metadataPanel: import('svelte').Snippet;
  }

  let { viewer, metadataPanel }: Props = $props();

  // Desktop detection (768px = md breakpoint)
  const isDesktop = createMediaQuery('(min-width: 768px)');
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
