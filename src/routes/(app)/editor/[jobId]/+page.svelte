<script lang="ts">
  import type { PageData } from './$types';

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
</script>

<svelte:head>
  <title>Editor — {data.job.pdfFilename}</title>
</svelte:head>

<div class="min-h-screen bg-muted/30">
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold mb-2">Editor</h1>
      <p class="text-muted-foreground">PDF viewer and region editor will go here</p>
    </div>

    <!-- Job Metadata Card -->
    <div class="bg-card rounded-lg border p-6 mb-8">
      <h2 class="text-lg font-semibold mb-4">Job Information</h2>
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <dt class="text-sm text-muted-foreground">Job ID</dt>
          <dd class="font-mono text-sm">{data.job.id}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted-foreground">Status</dt>
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
          <dt class="text-sm text-muted-foreground">Filename</dt>
          <dd class="font-medium">{data.job.pdfFilename}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted-foreground">Page Count</dt>
          <dd>{data.job.pdfPageCount} pages</dd>
        </div>
        <div>
          <dt class="text-sm text-muted-foreground">Created</dt>
          <dd>{formatDate(data.job.createdAt)}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted-foreground">Last Updated</dt>
          <dd>{formatDate(data.job.updatedAt)}</dd>
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
        <div class="mt-4">
          <p class="text-sm text-muted-foreground">Pipeline Step: {data.job.pipelineStep}</p>
        </div>
      {/if}
    </div>

    <!-- Placeholder for future features -->
    <div class="bg-card rounded-lg border p-12 text-center">
      <p class="text-muted-foreground">PDF viewer and region editor will go here</p>
    </div>
  </div>
</div>
