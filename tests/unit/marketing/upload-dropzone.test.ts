import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import UploadDropzone from '$lib/components/marketing/upload-dropzone.svelte';

// Mock svelte-sonner
vi.mock('svelte-sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Import mocked modules (setup.ts already mocks $app/navigation)
import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';

// Type for our mock XHR
interface MockXHR {
  open: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  upload: {
    onprogress: ((e: { loaded: number; total: number; lengthComputable: boolean }) => void) | null;
  };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  status: number;
  responseText: string;
}

// Helper to create mock XHR
function createMockXHR(): MockXHR {
  return {
    open: vi.fn(),
    send: vi.fn(),
    setRequestHeader: vi.fn(),
    upload: { onprogress: null },
    onload: null,
    onerror: null,
    status: 200,
    responseText: '',
  };
}

describe('UploadDropzone', () => {
  let xhrInstances: MockXHR[];
  let originalXMLHttpRequest: typeof window.XMLHttpRequest;

  beforeEach(() => {
    vi.clearAllMocks();
    xhrInstances = [];

    // Mock XMLHttpRequest
    originalXMLHttpRequest = window.XMLHttpRequest;
    window.XMLHttpRequest = vi.fn(() => {
      const instance = createMockXHR();
      xhrInstances.push(instance);
      return instance as unknown as XMLHttpRequest;
    }) as unknown as typeof window.XMLHttpRequest;

    // Mock fetch for job creation
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.XMLHttpRequest = originalXMLHttpRequest;
  });

  describe('rendering', () => {
    it('should render with correct initial state', () => {
      render(UploadDropzone);

      expect(screen.getByText('Drop your PDF here')).toBeTruthy();
      expect(screen.getByText('or click to browse')).toBeTruthy();
      expect(screen.getByText('Max 50 pages • Free • No signup required')).toBeTruthy();
    });

    it('should have a hidden file input', () => {
      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]');
      expect(input).toBeTruthy();
      // Input is hidden via CSS class "hidden" (Tailwind)
      expect(input?.classList.contains('hidden')).toBe(true);
      expect(input?.getAttribute('accept')).toBe('.pdf');
    });

    it('should render as a div with role="button" for Chromium drag-drop compatibility', () => {
      const { container } = render(UploadDropzone);

      // Use div with role="button" instead of <button> for better drag-drop support in Chromium
      const dropzone = container.querySelector('div[role="button"]');
      expect(dropzone).toBeTruthy();
      expect(dropzone?.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('drag and drop', () => {
    it('should handle dragover event', async () => {
      const { container } = render(UploadDropzone);

      const dropzone = container.querySelector('div[role="button"]')!;
      await fireEvent.dragOver(dropzone);

      // Dropzone should have drag-over styling class
      expect(dropzone.classList.contains('border-brand-500')).toBe(true);
    });

    it('should handle dragleave event', async () => {
      const { container } = render(UploadDropzone);

      const dropzone = container.querySelector('div[role="button"]')!;
      await fireEvent.dragOver(dropzone);
      expect(dropzone.classList.contains('border-brand-500')).toBe(true);

      await fireEvent.dragLeave(dropzone);
      expect(dropzone.classList.contains('border-brand-500')).toBe(false);
    });

    it('should set dropEffect to "copy" during dragover for Chromium compatibility', async () => {
      const { container } = render(UploadDropzone);

      const dropzone = container.querySelector('div[role="button"]')!;

      // Create a mock DataTransfer object
      const dataTransfer = { dropEffect: '' };
      await fireEvent.dragOver(dropzone, { dataTransfer });

      // Chromium requires explicit dropEffect for proper drag-drop behavior
      expect(dataTransfer.dropEffect).toBe('copy');
    });
  });

  describe('click interaction', () => {
    it('should trigger file input click when dropzone is clicked', async () => {
      const { container } = render(UploadDropzone);

      const dropzone = container.querySelector('div[role="button"]')!;

      // Spy on input.click - use prototype method for proper typing
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

      await fireEvent.click(dropzone);

      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it('should trigger file input on Enter key for keyboard accessibility', async () => {
      const { container } = render(UploadDropzone);

      const dropzone = container.querySelector('div[role="button"]')!;
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

      await fireEvent.keyDown(dropzone, { key: 'Enter' });

      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it('should trigger file input on Space key for keyboard accessibility', async () => {
      const { container } = render(UploadDropzone);

      const dropzone = container.querySelector('div[role="button"]')!;
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

      await fireEvent.keyDown(dropzone, { key: ' ' });

      expect(clickSpy).toHaveBeenCalledOnce();
    });
  });

  describe('PDF validation', () => {
    it('should accept zero-size PDF file (browser drag-drop quirk)', async () => {
      // Setup mock XHR to return success
      const mockUploadResponse = {
        key: 'uploads/user123/test.pdf',
        filename: 'test.pdf',
        pageCount: 1,
        sizeBytes: 0,
      };
      const mockJobResponse = {
        jobId: 'job_abc123',
        status: 'queued' as const,
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJobResponse),
      });

      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]')!;

      // Create a zero-size file to simulate Chromium drag-drop behavior
      const file = new File([], 'test.pdf', { type: 'application/pdf' });

      const dataTransfer = {
        files: [file],
        items: [],
        types: [],
      };

      Object.defineProperty(input, 'files', {
        value: dataTransfer.files,
        writable: false,
      });

      await fireEvent.change(input);

      // Wait for XHR to be created and simulate response
      await vi.waitFor(() => {
        expect(xhrInstances.length).toBeGreaterThan(0);
      });

      const xhr = xhrInstances[0];
      xhr.status = 200;
      xhr.responseText = JSON.stringify(mockUploadResponse);
      xhr.onload?.();

      // Wait for job creation
      await vi.waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/job/create',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('should show error for non-PDF extension', async () => {
      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]')!;

      // Create a non-PDF file
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

      // Mock the DataTransfer object
      const dataTransfer = {
        files: [file],
        items: [],
        types: [],
      };

      Object.defineProperty(input, 'files', {
        value: dataTransfer.files,
        writable: false,
      });

      await fireEvent.change(input);

      expect(toast.error).toHaveBeenCalledWith('Invalid file', {
        description: 'Please upload a valid PDF file.',
      });
    });

    it('should show error for file with PDF extension but invalid magic bytes', async () => {
      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]')!;

      // Create a file with PDF extension but wrong content
      const file = new File(['not a pdf content'], 'fake.pdf', { type: 'application/pdf' });

      const dataTransfer = {
        files: [file],
        items: [],
        types: [],
      };

      Object.defineProperty(input, 'files', {
        value: dataTransfer.files,
        writable: false,
      });

      await fireEvent.change(input);

      // Wait for async validation to complete
      await vi.waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid file', {
          description: 'Please upload a valid PDF file.',
        });
      });
    });
  });

  describe('upload flow with progress', () => {
    it('should use XMLHttpRequest for upload', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job_abc123', status: 'queued' }),
      });

      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]')!;

      // Create a valid PDF file (with correct magic bytes)
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
      const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

      const dataTransfer = {
        files: [file],
        items: [],
        types: [],
      };

      Object.defineProperty(input, 'files', {
        value: dataTransfer.files,
        writable: false,
      });

      await fireEvent.change(input);

      // Wait for XHR to be created
      await vi.waitFor(() => {
        expect(xhrInstances.length).toBeGreaterThan(0);
      });

      const xhr = xhrInstances[0];
      expect(xhr.open).toHaveBeenCalledWith('POST', '/api/upload');
      expect(xhr.send).toHaveBeenCalled();
    });

    it('should show progress bar during upload', async () => {
      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]')!;

      // Create a valid PDF file
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

      const dataTransfer = {
        files: [file],
        items: [],
        types: [],
      };

      Object.defineProperty(input, 'files', {
        value: dataTransfer.files,
        writable: false,
      });

      await fireEvent.change(input);

      // Wait for uploading state
      await vi.waitFor(() => {
        expect(screen.getByText('Uploading...')).toBeTruthy();
      });

      // Progress bar should be visible
      const progressBar = container.querySelector('[data-slot="progress"]');
      expect(progressBar).toBeTruthy();
    });

    it('should update progress on xhr.upload.onprogress', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job_abc123', status: 'queued' }),
      });

      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]')!;

      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

      const dataTransfer = {
        files: [file],
        items: [],
        types: [],
      };

      Object.defineProperty(input, 'files', {
        value: dataTransfer.files,
        writable: false,
      });

      await fireEvent.change(input);

      // Wait for XHR to be created
      await vi.waitFor(() => {
        expect(xhrInstances.length).toBeGreaterThan(0);
      });

      const xhr = xhrInstances[0];

      // Simulate progress updates
      expect(xhr.upload.onprogress).not.toBeNull();

      // 50% progress
      xhr.upload.onprogress!({ loaded: 50, total: 100, lengthComputable: true });
      await vi.waitFor(() => {
        expect(screen.getByText('50%')).toBeTruthy();
      });

      // 100% progress
      xhr.upload.onprogress!({ loaded: 100, total: 100, lengthComputable: true });
      await vi.waitFor(() => {
        expect(screen.getByText('100%')).toBeTruthy();
      });
    });

    it('should show "Creating job..." after upload completes', async () => {
      const mockUploadResponse = {
        key: 'uploads/user123/test.pdf',
        filename: 'test.pdf',
        pageCount: 10,
        sizeBytes: 1024,
      };

      // Create a promise that we can resolve manually to control timing
      let resolveJobCreation: (value: {
        ok: boolean;
        json: () => Promise<{ jobId: string; status: string }>;
      }) => void;
      const jobCreationPromise = new Promise<{
        ok: boolean;
        json: () => Promise<{ jobId: string; status: string }>;
      }>((resolve) => {
        resolveJobCreation = resolve;
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(jobCreationPromise);

      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]')!;

      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

      const dataTransfer = {
        files: [file],
        items: [],
        types: [],
      };

      Object.defineProperty(input, 'files', {
        value: dataTransfer.files,
        writable: false,
      });

      await fireEvent.change(input);

      // Wait for XHR to be created
      await vi.waitFor(() => {
        expect(xhrInstances.length).toBeGreaterThan(0);
      });

      const xhr = xhrInstances[0];

      // Simulate upload completion
      xhr.status = 200;
      xhr.responseText = JSON.stringify(mockUploadResponse);
      xhr.onload?.();

      // Now we should see "Creating job..." before the fetch resolves
      await vi.waitFor(() => {
        expect(screen.getByText('Creating job...')).toBeTruthy();
      });

      // Resolve the job creation to clean up
      resolveJobCreation!({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job_abc123', status: 'queued' }),
      });
    });

    it('should redirect to editor after successful upload and job creation', async () => {
      const mockUploadResponse = {
        key: 'uploads/user123/test.pdf',
        filename: 'test.pdf',
        pageCount: 10,
        sizeBytes: 1024,
      };

      const mockJobResponse = {
        jobId: 'job_abc123',
        status: 'queued' as const,
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJobResponse),
      });

      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]')!;

      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

      const dataTransfer = {
        files: [file],
        items: [],
        types: [],
      };

      Object.defineProperty(input, 'files', {
        value: dataTransfer.files,
        writable: false,
      });

      await fireEvent.change(input);

      // Wait for XHR to be created
      await vi.waitFor(() => {
        expect(xhrInstances.length).toBeGreaterThan(0);
      });

      const xhr = xhrInstances[0];

      // Simulate upload completion
      xhr.status = 200;
      xhr.responseText = JSON.stringify(mockUploadResponse);
      xhr.onload?.();

      // Wait for job creation and redirect
      await vi.waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/job/create',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              pdfKey: mockUploadResponse.key,
              pdfFilename: mockUploadResponse.filename,
              pdfPageCount: mockUploadResponse.pageCount,
            }),
          })
        );
      });

      expect(goto).toHaveBeenCalledWith('/editor/job_abc123');
    });

    it('should show error when upload fails', async () => {
      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]')!;

      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

      const dataTransfer = {
        files: [file],
        items: [],
        types: [],
      };

      Object.defineProperty(input, 'files', {
        value: dataTransfer.files,
        writable: false,
      });

      await fireEvent.change(input);

      // Wait for XHR to be created
      await vi.waitFor(() => {
        expect(xhrInstances.length).toBeGreaterThan(0);
      });

      const xhr = xhrInstances[0];

      // Simulate upload failure
      xhr.status = 413;
      xhr.responseText = JSON.stringify({ message: 'File too large' });
      xhr.onload?.();

      await vi.waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Upload failed', {
          description: 'File too large',
        });
      });
    });

    it('should show error when job creation fails', async () => {
      const mockUploadResponse = {
        key: 'uploads/user123/test.pdf',
        filename: 'test.pdf',
        pageCount: 10,
        sizeBytes: 1024,
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Conversion limit exceeded' }),
      });

      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]')!;

      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

      const dataTransfer = {
        files: [file],
        items: [],
        types: [],
      };

      Object.defineProperty(input, 'files', {
        value: dataTransfer.files,
        writable: false,
      });

      await fireEvent.change(input);

      // Wait for XHR to be created
      await vi.waitFor(() => {
        expect(xhrInstances.length).toBeGreaterThan(0);
      });

      const xhr = xhrInstances[0];

      // Simulate upload completion
      xhr.status = 200;
      xhr.responseText = JSON.stringify(mockUploadResponse);
      xhr.onload?.();

      await vi.waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create job', {
          description: 'Conversion limit exceeded',
        });
      });
    });

    it('should handle network error during upload', async () => {
      const { container } = render(UploadDropzone);

      const input = container.querySelector('input[type="file"]')!;

      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });

      const dataTransfer = {
        files: [file],
        items: [],
        types: [],
      };

      Object.defineProperty(input, 'files', {
        value: dataTransfer.files,
        writable: false,
      });

      await fireEvent.change(input);

      // Wait for XHR to be created
      await vi.waitFor(() => {
        expect(xhrInstances.length).toBeGreaterThan(0);
      });

      const xhr = xhrInstances[0];

      // Simulate network error
      xhr.onerror?.();

      await vi.waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Upload failed', {
          description: 'Network error during upload',
        });
      });
    });
  });
});
