<script lang="ts">
  import type { PageData } from './$types';
  import PdfViewer from '$lib/components/app/pdf-viewer.svelte';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import type { PresignedUrlResponse } from '$lib/shared/types';

  let { data }: { data: PageData } = $props();

  // Format date for display
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  // Status badge colors
  const statusColors: Record<string, string> = {
    queued: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    needs_review: 'bg-orange-100 text-orange-800',
    resuming: 'bg-blue-100 text-blue-800',
    complete: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

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

<div class="min-h-screen bg-muted/30">
  <!-- Top Bar -->
  <header class="fixed top-0 left-0 right-0 h-14 bg-background border-b z-50">
    <div class="h-full px-4 flex items-center justify-between">
      <!-- Logo -->
      <a href="/" class="font-semibold text-lg hover:opacity-80 transition-opacity"> CleanEbook </a>

      <!-- Filename (centered) -->
      <div class="absolute left-1/2 -translate-x-1/2 max-w-[40%]">
        <span class="text-sm text-muted-foreground truncate block text-center">
          {data.job.pdfFilename}
        </span>
      </div>

      <!-- Sign In placeholder -->
      <button class="text-sm text-muted-foreground hover:text-foreground transition-colors">
        Sign In
      </button>
    </div>
  </header>

  <!-- Main content with top bar offset -->
  <div class="pt-14 flex h-screen">
    <!-- PDF Viewer (left panel) -->
    <div class="flex-1 overflow-auto p-4">
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

    <!-- Metadata Panel (right panel) -->
    <div class="w-80 border-l bg-background overflow-auto">
      <div class="p-4 space-y-4">
        <h2 class="font-semibold">Document Info</h2>

        <dl class="space-y-3 text-sm">
          <div>
            <dt class="text-muted-foreground">Filename</dt>
            <dd class="font-medium truncate">{data.job.pdfFilename}</dd>
          </div>

          <div>
            <dt class="text-muted-foreground">Pages</dt>
            <dd>{data.job.pdfPageCount}</dd>
          </div>

          <div>
            <dt class="text-muted-foreground">Status</dt>
            <dd>
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {statusColors[
                  data.job.status
                ] || 'bg-gray-100 text-gray-800'}"
              >
                {data.job.status}
              </span>
            </dd>
          </div>

          <div>
            <dt class="text-muted-foreground">Uploaded</dt>
            <dd>{formatDate(data.job.createdAt)}</dd>
          </div>
        </dl>

        {#if data.job.errorMessage}
          <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p class="text-sm text-red-800">
              <strong>Error:</strong>
              {data.job.errorMessage}
            </p>
          </div>
        {/if}

        {#if data.job.pipelineStep}
          <div class="mt-2">
            <p class="text-sm text-muted-foreground">Pipeline Step: {data.job.pipelineStep}</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
