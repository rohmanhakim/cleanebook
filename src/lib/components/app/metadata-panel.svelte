<script lang="ts">
  import type { Job } from '$lib/shared/types';

  interface Props {
    job: Job;
  }

  let { job }: Props = $props();

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

<div class="p-4 space-y-4">
  <h2 class="font-semibold">Document Info</h2>

  <dl class="space-y-3 text-sm">
    <div>
      <dt class="text-muted-foreground">Filename</dt>
      <dd class="font-medium truncate">{job.pdfFilename}</dd>
    </div>

    <div>
      <dt class="text-muted-foreground">Pages</dt>
      <dd>{job.pdfPageCount}</dd>
    </div>

    <div>
      <dt class="text-muted-foreground">Status</dt>
      <dd>
        <span
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {statusColors[
            job.status
          ] || 'bg-gray-100 text-gray-800'}"
        >
          {job.status}
        </span>
      </dd>
    </div>

    <div>
      <dt class="text-muted-foreground">Uploaded</dt>
      <dd>{formatDate(job.createdAt)}</dd>
    </div>
  </dl>

  {#if job.errorMessage}
    <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
      <p class="text-sm text-red-800">
        <strong>Error:</strong>
        {job.errorMessage}
      </p>
    </div>
  {/if}

  {#if job.pipelineStep}
    <div class="mt-2">
      <p class="text-sm text-muted-foreground">Pipeline Step: {job.pipelineStep}</p>
    </div>
  {/if}
</div>
