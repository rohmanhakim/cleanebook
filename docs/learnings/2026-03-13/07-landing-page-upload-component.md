# Learning Doc: Landing Page Upload Component (Task 1H)

## Overview

Implemented the upload dropzone component that serves as the entry point for the entire user flow. This component handles PDF file selection, validation, upload to R2, job creation, and navigation to the editor.

## Key Learnings

### 1. Svelte 5 State Management with Runes

Used Svelte 5's new runes for reactive state:

```svelte
<script lang="ts">
  let isUploading = $state(false);
  let isDragOver = $state(false);
  let inputRef: HTMLInputElement | undefined = $state();
</script>
```

The `$state()` rune replaces the older `let` reactive declarations. This provides more explicit reactivity and better TypeScript integration.

### 2. Client-Side PDF Validation

Before uploading, validate PDF files using magic bytes:

```typescript
const PDF_MAGIC_BYTES = '%PDF-';

async function validatePdfMagicBytes(file: File): Promise<boolean> {
  // Quick extension check first
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return false;
  }

  // Read first 5 bytes to validate magic bytes
  const slice = file.slice(0, 5);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const header = String.fromCharCode(...bytes);
  return header === PDF_MAGIC_BYTES;
}
```

This catches both:
- Files with wrong extension (quick rejection)
- Files with `.pdf` extension but wrong content (malformed or fake PDFs)

### 3. Hidden File Input Pattern

The dropzone uses a hidden `<input type="file">` triggered programmatically:

```svelte
<input
  type="file"
  accept=".pdf"
  class="hidden"
  bind:this={inputRef}
  onchange={handleInputChange}
  disabled={isUploading}
/>

<button
  type="button"
  onclick={handleClick}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  disabled={isUploading}
>
  <!-- Dropzone UI -->
</button>
```

Key points:
- Input is hidden via Tailwind's `hidden` class
- Button triggers input click via `inputRef.click()`
- Both button and input have `disabled={isUploading}` to prevent double-uploads

### 4. Drag and Drop Event Handling

Drag-drop requires preventing default behavior and stopping propagation:

```typescript
function handleDragOver(e: DragEvent): void {
  if (isUploading) return;
  e.preventDefault();
  e.stopPropagation();
  isDragOver = true;
}

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
```

Without `preventDefault()`, the browser would open the PDF file instead of allowing the drop.

### 5. Sequential API Calls with Error Handling

The upload flow requires two sequential API calls:

```typescript
async function handleFile(file: File): Promise<void> {
  // ...validation...

  try {
    // Step 1: Upload PDF
    const uploadResponse = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      // Handle upload error
      return;
    }

    const uploadData = await uploadResponse.json();

    // Step 2: Create job
    const jobResponse = await fetch('/api/job/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfKey: uploadData.key,
        pdfFilename: uploadData.filename,
        pdfPageCount: uploadData.pageCount,
      }),
    });

    if (!jobResponse.ok) {
      // Handle job creation error
      return;
    }

    const jobData = await jobResponse.json();

    // Step 3: Redirect to editor
    await goto(`/editor/${jobData.jobId}`);
  } catch (err) {
    // Handle network errors
  } finally {
    isUploading = false;
  }
}
```

Each step has its own error handling, allowing specific error messages for each failure case.

### 6. Toast Notifications with svelte-sonner

Used `svelte-sonner` for toast notifications:

```svelte
<script>
  import { toast } from 'svelte-sonner';
</script>

<!-- In layout for global availability -->
<Toaster position="bottom-center" richColors />
```

Usage in component:
```typescript
toast.error('Invalid file', {
  description: 'Please upload a valid PDF file.',
});
```

### 7. Testing Svelte Components with Vitest

#### Mocking Svelte Stores and Modules

Created mocks for `$app/navigation`:

```typescript
// tests/unit/__mocks__/$app/navigation.ts
export const goto = vi.fn();
export const invalidate = vi.fn();
export const invalidateAll = vi.fn();
export const prefetch = vi.fn();
export const prefetchRoutes = vi.fn();
export const beforeNavigate = vi.fn();
export const afterNavigate = vi.fn();
```

Configured in `vitest.config.ts`:
```typescript
resolve: {
  alias: {
    $lib: resolve('./src/lib'),
    $app: resolve('./tests/unit/__mocks__/$app'),
  },
}
```

#### Testing File Inputs

File inputs require special handling in tests:

```typescript
it('should trigger file input click when button is clicked', async () => {
  const { container } = render(UploadDropzone);
  const button = container.querySelector('button')!;

  // Spy on prototype method
  const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

  await fireEvent.click(button);

  expect(clickSpy).toHaveBeenCalledOnce();
});
```

#### Testing File Validation

```typescript
it('should show error for non-PDF extension', async () => {
  const { container } = render(UploadDropzone);
  const input = container.querySelector('input[type="file"]')!;

  const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

  // Mock files property
  Object.defineProperty(input, 'files', {
    value: [file],
    writable: false,
  });

  await fireEvent.change(input);

  expect(toast.error).toHaveBeenCalledWith('Invalid file', {
    description: 'Please upload a valid PDF file.',
  });
});
```

#### Testing Async Operations

```typescript
it('should call upload API and create job on valid PDF', async () => {
  global.fetch = vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockUploadResponse),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockJobResponse),
    });

  // ...trigger file selection...

  await vi.waitFor(() => {
    expect(fetch).toHaveBeenCalledWith('/api/upload', expect.objectContaining({
      method: 'POST',
    }));
  });

  expect(goto).toHaveBeenCalledWith('/editor/job_abc123');
});
```

## Pitfalls to Avoid

### 1. Forgetting to Prevent Default on Drag Events

Without `e.preventDefault()` in drag handlers, the browser will open the dropped file as a download.

### 2. Not Resetting File Input Value

After a file is selected, reset the input value to allow selecting the same file again:

```typescript
function handleInputChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  // ...handle file...
  target.value = ''; // Reset for re-selection
}
```

### 3. Using `$app/stores` Instead of Direct Imports

In SvelteKit 2+, prefer direct imports from `$app/navigation` over the deprecated `$app/stores`:

```typescript
// Good
import { goto } from '$app/navigation';

// Deprecated
import { page } from '$app/stores';
```

### 4. Not Disabling During Upload

Always disable the dropzone during upload to prevent double-submissions:

```svelte
<button disabled={isUploading}>
<input disabled={isUploading}>
```

## Files Changed

| File | Change |
|------|--------|
| `src/lib/components/marketing/upload-dropzone.svelte` | Complete rewrite with upload flow |
| `src/routes/+layout.svelte` | Added `<Toaster>` component |
| `vitest.config.ts` | Added `$app` alias and setup file |
| `tests/unit/setup.ts` | Test setup file |
| `tests/unit/__mocks__/$app/navigation.ts` | Navigation mocks |
| `tests/unit/marketing/upload-dropzone.test.ts` | 11 unit tests |
| `tests/e2e/landing.spec.ts` | 3 E2E upload flow tests |

## References

- [Svelte 5 Runes](https://svelte-5-preview.vercel.app/docs/runes)
- [MDN: File API](https://developer.mozilla.org/en-US/docs/Web/API/File)
- [svelte-sonner](https://github.com/wobsoriano/svelte-sonner)
- [Testing Library Svelte](https://testing-library.com/docs/svelte-testing-library/intro/)