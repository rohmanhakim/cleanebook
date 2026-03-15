<script lang="ts">
  import type { PageData } from './$types';
  import EditorTopBar from '$lib/components/app/editor-top-bar.svelte';
  import EditorLayout from '$lib/components/app/editor-layout.svelte';
  import MetadataPanel from '$lib/components/app/metadata-panel.svelte';
  import PdfViewer from '$lib/components/app/pdf-viewer.svelte';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import type { PresignedUrlResponse } from '$lib/shared/types';

  let { data }: { data: PageData } = $props();

  // Presigned URL state
  let presignedUrl: string | null = $state(null);
  let isLoadingUrl = $state(true);
  let urlError: string | null = $state(null);

  // Fetch presigned URL on mount
  $effect(() => {
    fetchPresignedUrl(data.job.id);
  });

  async function fetchPresignedUrl(jobId: string) {
    try {
      isLoadingUrl = true;
      urlError = null;

      const response = await fetch(`/api/pdf/${jobId}/signed-url`);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('You must be signed in to view this PDF');
        } else if (response.status === 404) {
          throw new Error('PDF not found or you do not have access');
        }
        throw new Error('Failed to get PDF URL');
      }

      const result: PresignedUrlResponse = await response.json();
      presignedUrl = result.url;
    } catch (e) {
      urlError = e instanceof Error ? e.message : 'Failed to load PDF';
    } finally {
      isLoadingUrl = false;
    }
  }
</script>

<svelte:head>
  <title>Editor — {data.job.pdfFilename}</title>
</svelte:head>

<div class="h-screen bg-muted/30">
  <!-- Top Bar -->
  <EditorTopBar filename={data.job.pdfFilename} />

  <!-- Main content with resizable layout (offset for fixed top bar) -->
  <div class="pt-14 h-full">
    <EditorLayout>
      {#snippet viewer()}
        <div class="h-full overflow-auto bg-muted/30 p-4">
          {#if isLoadingUrl}
            <div class="space-y-4">
              {#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
                <Skeleton class="h-100 w-full" />
              {/each}
            </div>
          {:else if urlError}
            <div class="flex flex-col items-center justify-center h-full text-center">
              <div class="text-red-500 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-red-500 mb-2">Failed to load PDF</h3>
              <p class="text-muted-foreground">{urlError}</p>
            </div>
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
  </div>
</div>
