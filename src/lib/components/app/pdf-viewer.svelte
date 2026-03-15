<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import PdfPageCanvas from './pdf-page-canvas.svelte';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { SvelteSet } from 'svelte/reactivity';
  import type * as pdfjs from 'pdfjs-dist';

  // Type aliases for pdfjs types
  type PDFDocumentProxy = pdfjs.PDFDocumentProxy;
  type PDFPageProxy = pdfjs.PDFPageProxy;

  interface Props {
    /** Presigned URL to the PDF file in R2 */
    presignedUrl: string;
    /** Scale factor for rendering (default: 1.5) */
    scale?: number;
  }

  let { presignedUrl, scale = 1.5 }: Props = $props();

  // PDF library reference (loaded dynamically on client)
  let pdfjsLib: typeof pdfjs | null = $state(null);

  // PDF document state
  let pdfDoc: PDFDocumentProxy | null = $state(null);
  let pageCount = $state(0);
  let pages: PDFPageProxy[] = $state([]);

  // UI state
  let isLoading = $state(true);
  let error: string | null = $state(null);

  // Track which pages are visible (for lazy rendering)
  // Using SvelteSet for reactivity - mutations (add/delete) trigger reactivity
  let visiblePages = new SvelteSet<number>();

  // Load pdfjs library and PDF on mount (client-only)
  onMount(async () => {
    if (!browser) return;

    try {
      // Dynamic import - only runs in browser
      const pdfjsModule = await import('pdfjs-dist');
      pdfjsLib = pdfjsModule;

      // Set worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).href;

      // Now load the PDF
      await loadPdf(presignedUrl);
    } catch (e) {
      console.error('Failed to initialize PDF.js:', e);
      error = 'Failed to initialize PDF viewer';
      isLoading = false;
    }
  });

  async function loadPdf(url: string) {
    if (!pdfjsLib) return;

    try {
      isLoading = true;
      error = null;
      pdfDoc = null;
      pages = [];
      // Clear existing visible pages
      visiblePages.clear();

      const loadingTask = pdfjsLib.getDocument(url);
      pdfDoc = await loadingTask.promise;
      pageCount = pdfDoc.numPages;

      // Pre-load first 3 pages immediately for better UX
      const initialPages = Math.min(3, pageCount);
      const initialPagePromises: Promise<PDFPageProxy>[] = [];
      for (let i = 1; i <= initialPages; i++) {
        initialPagePromises.push(pdfDoc.getPage(i));
      }
      const loadedPages = await Promise.all(initialPagePromises);
      pages = loadedPages;
      for (let i = 0; i < initialPages; i++) {
        visiblePages.add(i);
      }

      // Load remaining pages in background
      if (pageCount > 3) {
        const remainingPromises: Promise<PDFPageProxy>[] = [];
        for (let i = 4; i <= pageCount; i++) {
          remainingPromises.push(pdfDoc.getPage(i));
        }
        const remainingPages = await Promise.all(remainingPromises);
        pages = [...pages, ...remainingPages];
      }
    } catch (e) {
      console.error('Failed to load PDF:', e);
      if (e instanceof Error) {
        // Provide more helpful error messages
        if (e.message.includes('Missing PDF')) {
          error = 'Invalid PDF file or corrupted data';
        } else if (e.message.includes('fetch')) {
          error = 'Failed to fetch PDF. Please check your network connection.';
        } else {
          error = e.message;
        }
      } else {
        error = 'Failed to load PDF';
      }
    } finally {
      isLoading = false;
    }
  }

  // IntersectionObserver for lazy page rendering
  let observer: IntersectionObserver | null = null;

  function setupObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageIndex = parseInt(entry.target.getAttribute('data-page-index') || '0', 10);
          if (entry.isIntersecting) {
            visiblePages.add(pageIndex);
          }
        });
      },
      {
        rootMargin: '200px', // Start rendering 200px before page enters viewport
      }
    );
  }

  // Svelte action for observing page elements
  function observePage(node: HTMLElement) {
    observer?.observe(node);
    return {
      destroy() {
        observer?.unobserve(node);
      },
    };
  }

  $effect(() => {
    if (browser) {
      setupObserver();
      return () => {
        if (observer) {
          observer.disconnect();
        }
      };
    }
  });
</script>

<!--
 PDF Viewer Component 
 Loads and renders a PDF document with vertical scrolling 
 * Features:
 - Loads PDF from presigned R2 URL 
 - Renders all pages vertically 
 - Shows loading skeletons while loading 
 - Shows error state on failure 
 - Lazy page rendering with IntersectionObserver 
-->
<div class="pdf-viewer">
  {#if isLoading}
    <!-- Loading skeletons -->
    <div class="space-y-4 p-4">
      {#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
        <Skeleton class="h-100 w-full" />
      {/each}
    </div>
  {:else if error}
    <!-- Error state -->
    <div class="flex flex-col items-center justify-center p-8 text-center">
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
      <p class="text-muted-foreground">{error}</p>
    </div>
  {:else if pages.length > 0}
    <!-- PDF pages -->
    {#each pages as page, i (i)}
      <div data-page-index={i} class="pdf-page-wrapper" use:observePage>
        <PdfPageCanvas {page} {scale} render={visiblePages.has(i)} />
      </div>
    {/each}
  {:else}
    <!-- No pages state -->
    <div class="flex items-center justify-center p-8">
      <p class="text-muted-foreground">No pages to display</p>
    </div>
  {/if}
</div>

<style>
  .pdf-viewer {
    width: 100%;
    min-height: 100%;
  }

  .pdf-page-wrapper {
    width: 100%;
  }
</style>
