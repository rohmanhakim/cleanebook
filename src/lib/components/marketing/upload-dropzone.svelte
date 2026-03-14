<script lang="ts">
  import { Upload, Loader } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { goto } from '$app/navigation';
  import Progress from '$lib/components/ui/progress/progress.svelte';

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

  // Upload phase type
  type UploadPhase = 'idle' | 'uploading' | 'creating-job';

  // State
  let uploadPhase = $state<UploadPhase>('idle');
  let uploadProgress = $state(0);
  let isDragOver = $state(false);
  let inputRef: HTMLInputElement | undefined = $state();

  // Derived state for backwards compatibility
  const isUploading = $derived(uploadPhase !== 'idle');

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
   * Upload file using XMLHttpRequest for progress tracking
   */
  function uploadWithProgress(file: File): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      // Track upload progress
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          uploadProgress = Math.round((e.loaded / e.total) * 100);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Invalid response from server'));
          }
        } else {
          // Try to parse error message
          let message = getErrorMessage(xhr.status);
          try {
            const errorData = JSON.parse(xhr.responseText) as ApiError;
            if (errorData.message) {
              message = errorData.message;
            }
          } catch {
            // Use default message
          }
          reject(new Error(message));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
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

    uploadPhase = 'uploading';
    uploadProgress = 0;
    isDragOver = false;

    try {
      // Step 1: Upload PDF with progress tracking
      const uploadData = await uploadWithProgress(file);

      // Step 2: Create job
      uploadPhase = 'creating-job';
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
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast.error('Upload failed', {
        description: message,
      });
    } finally {
      uploadPhase = 'idle';
      uploadProgress = 0;
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
    <div class="flex flex-col items-center gap-4 w-full px-4">
      <div
        class="size-16 rounded-full bg-brand-100 flex items-center justify-center {isDragOver
          ? 'scale-110'
          : ''} transition-transform"
      >
        {#if uploadPhase === 'creating-job'}
          <Loader class="size-8 text-brand-600 animate-spin" />
        {:else if uploadPhase === 'uploading'}
          <Upload class="size-8 text-brand-600" />
        {:else}
          <Upload class="size-8 text-brand-600" />
        {/if}
      </div>
      <div class="w-full max-w-sm">
        {#if uploadPhase === 'uploading'}
          <p class="text-lg font-medium mb-2 text-center">Uploading...</p>
          <div class="flex items-center gap-3">
            <Progress value={uploadProgress} class="flex-1 h-2" />
            <span class="text-sm font-medium text-muted-foreground min-w-12 text-right"
              >{uploadProgress}%</span
            >
          </div>
        {:else if uploadPhase === 'creating-job'}
          <p class="text-lg font-medium mb-1 text-center">Creating job...</p>
          <div class="flex items-center gap-3">
            <Progress value={100} class="flex-1 h-2" />
            <span class="text-sm font-medium text-muted-foreground min-w-12 text-right">100%</span>
          </div>
        {:else}
          <p class="text-lg font-medium mb-1 text-center">Drop your PDF here</p>
          <p class="text-sm text-muted-foreground text-center">or click to browse</p>
        {/if}
      </div>
      <p class="text-xs text-muted-foreground">Max 50 pages • Free • No signup required</p>
    </div>
  </div>
</div>
