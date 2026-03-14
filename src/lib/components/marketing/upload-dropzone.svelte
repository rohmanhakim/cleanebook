<script lang="ts">
  import { Upload, Loader } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { goto } from '$app/navigation';

  // Types for API responses
  interface UploadResponse {
    key: string;
    filename: string;
    pageCount: number;
    sizeBytes: number;
  }

  interface CreateJobResponse {
    jobId: string;
    status: 'queued';
  }

  interface ApiError {
    message?: string;
  }

  // State
  let isUploading = $state(false);
  let isDragOver = $state(false);
  let inputRef: HTMLInputElement | undefined = $state();

  // Constants
  const PDF_MAGIC_BYTES = '%PDF-';

  /**
   * Validate PDF magic bytes client-side
   * Reads first 5 bytes to check for %PDF- prefix
   */
  async function validatePdfMagicBytes(file: File): Promise<boolean> {
    // Check extension first for quick rejection
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return false;
    }

    // Handle Chromium drag-drop quirk where file.size is 0 initially
    // Accept zero-size files and let server-side validation handle them
    if (file.size === 0) {
      return true;
    }

    // Read first 5 bytes to validate magic bytes
    const slice = file.slice(0, 5);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const header = String.fromCharCode(...bytes);
    return header === PDF_MAGIC_BYTES;
  }

  /**
   * Handle file selection
   */
  async function handleFile(file: File): Promise<void> {
    if (isUploading) return;

    // Validate PDF
    const isValidPdf = await validatePdfMagicBytes(file);
    if (!isValidPdf) {
      toast.error('Invalid file', {
        description: 'Please upload a valid PDF file.',
      });
      return;
    }

    isUploading = true;
    isDragOver = false;

    try {
      // Step 1: Upload PDF
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = (await uploadResponse.json().catch(() => ({}))) as ApiError;
        const message = errorData.message || getErrorMessage(uploadResponse.status);
        toast.error('Upload failed', { description: message });
        return;
      }

      const uploadData = (await uploadResponse.json()) as UploadResponse;

      // Step 2: Create job
      const jobResponse = await fetch('/api/job/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfKey: uploadData.key,
          pdfFilename: uploadData.filename,
          pdfPageCount: uploadData.pageCount,
        }),
      });

      if (!jobResponse.ok) {
        const errorData = (await jobResponse.json().catch(() => ({}))) as ApiError;
        const message = errorData.message || getErrorMessage(jobResponse.status);
        toast.error('Failed to create job', { description: message });
        return;
      }

      const jobData = (await jobResponse.json()) as CreateJobResponse;

      // Step 3: Redirect to editor
      await goto(`/editor/${jobData.jobId}`);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Something went wrong', {
        description: 'Please try again later.',
      });
    } finally {
      isUploading = false;
    }
  }

  /**
   * Get user-friendly error message for HTTP status codes
   */
  function getErrorMessage(status: number): string {
    switch (status) {
      case 401:
        return 'Session expired. Please refresh the page.';
      case 403:
        return 'You have reached your conversion limit.';
      case 413:
        return 'File is too large. Maximum size is 2MB.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Click handler - trigger file input
   */
  function handleClick(): void {
    if (isUploading) return;
    inputRef?.click();
  }

  /**
   * Keyboard handler for accessibility (Enter/Space to trigger file input)
   */
  function handleKeydown(e: KeyboardEvent): void {
    if (isUploading) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef?.click();
    }
  }

  /**
   * Drag over handler
   */
  function handleDragOver(e: DragEvent): void {
    if (isUploading) return;
    e.preventDefault();
    e.stopPropagation();
    // Explicitly set dropEffect for Chromium compatibility
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    isDragOver = true;
  }

  /**
   * Drag leave handler
   */
  function handleDragLeave(e: DragEvent): void {
    if (isUploading) return;
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;
  }

  /**
   * Drop handler
   */
  function handleDrop(e: DragEvent): void {
    if (isUploading) return;
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }

  /**
   * File input change handler
   */
  function handleInputChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input so same file can be selected again
    target.value = '';
  }
</script>

<div class="w-full max-w-xl mb-8">
  <!-- Hidden file input -->
  <input
    type="file"
    accept=".pdf"
    class="hidden"
    bind:this={inputRef}
    onchange={handleInputChange}
    disabled={isUploading}
  />

  <!-- Drop zone - using div instead of button for better Chromium drag-drop compatibility -->
  <div
    role="button"
    tabindex="0"
    class="border-2 border-dashed rounded-xl p-12 text-center transition-colors w-full cursor-pointer
      {isDragOver
      ? 'border-brand-500 bg-brand-50'
      : 'border-muted-foreground/25 bg-muted/30 hover:bg-muted/50 hover:border-brand-500/50'}
      {isUploading ? 'opacity-70 cursor-not-allowed' : ''}"
    onclick={handleClick}
    onkeydown={handleKeydown}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    aria-disabled={isUploading}
  >
    <div class="flex flex-col items-center gap-4">
      <div
        class="size-16 rounded-full bg-brand-100 flex items-center justify-center {isDragOver
          ? 'scale-110'
          : ''} transition-transform"
      >
        {#if isUploading}
          <Loader class="size-8 text-brand-600 animate-spin" />
        {:else}
          <Upload class="size-8 text-brand-600" />
        {/if}
      </div>
      <div>
        {#if isUploading}
          <p class="text-lg font-medium mb-1">Uploading...</p>
          <p class="text-sm text-muted-foreground">Please wait</p>
        {:else}
          <p class="text-lg font-medium mb-1">Drop your PDF here</p>
          <p class="text-sm text-muted-foreground">or click to browse</p>
        {/if}
      </div>
      <p class="text-xs text-muted-foreground">Max 50 pages • Free • No signup required</p>
    </div>
  </div>
</div>
