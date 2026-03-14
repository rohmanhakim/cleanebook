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

describe('UploadDropzone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      // Mock fetch for upload flow
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            key: 'uploads/user123/test.pdf',
            filename: 'test.pdf',
            pageCount: 1,
            sizeBytes: 0,
          }),
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

      // Zero-size files should be accepted (server validates actual content)
      await vi.waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/upload',
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

  describe('upload flow', () => {
    it('should call upload API and create job on valid PDF', async () => {
      // Mock successful upload response
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

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUploadResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockJobResponse),
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

      // Wait for async operations
      await vi.waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/upload',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      expect(fetch).toHaveBeenCalledWith(
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

      expect(goto).toHaveBeenCalledWith('/editor/job_abc123');
    });

    it('should show error when upload fails', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: () => Promise.resolve({ message: 'File too large' }),
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

      await vi.waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Upload failed', {
          description: 'File too large',
        });
      });
    });

    it('should show error when job creation fails', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              key: 'uploads/user123/test.pdf',
              filename: 'test.pdf',
              pageCount: 10,
              sizeBytes: 1024,
            }),
        })
        .mockResolvedValueOnce({
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

      await vi.waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create job', {
          description: 'Conversion limit exceeded',
        });
      });
    });
  });
});
