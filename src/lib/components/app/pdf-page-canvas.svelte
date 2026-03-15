<script lang="ts">
  import type { PDFPageProxy } from 'pdfjs-dist';

  interface Props {
    /** The PDF page to render */
    page: PDFPageProxy;
    /** Scale factor for rendering (default: 1.5) */
    scale?: number;
    /** Whether to render immediately (default: true) */
    render?: boolean;
  }

  let { page, scale = 1.5, render = true }: Props = $props();

  let canvas: HTMLCanvasElement | null = $state(null);
  let isRendered = $state(false);
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);

  // Get viewport dimensions
  $effect(() => {
    const viewport = page.getViewport({ scale });
    viewportWidth = viewport.width;
    viewportHeight = viewport.height;
  });

  // Render page to canvas when canvas is ready and render is true
  $effect(() => {
    if (!canvas || !render || isRendered) return;

    const currentCanvas = canvas; // Capture for closure
    const currentScale = scale;
    const currentPage = page;

    const renderPage = async () => {
      const viewport = currentPage.getViewport({ scale: currentScale });

      // Set canvas dimensions
      currentCanvas.width = viewport.width;
      currentCanvas.height = viewport.height;

      const context = currentCanvas.getContext('2d');
      if (!context) return;

      // Render the page
      await currentPage.render({
        canvasContext: context,
        viewport,
        canvas: currentCanvas,
      }).promise;

      isRendered = true;
    };

    renderPage();
  });
</script>

<!--
  PDF Page Canvas Component 
   Renders a single PDF page to a canvas element 
   Uses PDF.js to render pages. 
  The component handles: 
   - Canvas sizing based on page viewport 
   - Re-rendering when scale changes 
   - Lazy rendering via IntersectionObserver (controlled by parent) 
-->
<div class="pdf-page-canvas">
  <canvas
    bind:this={canvas}
    width={viewportWidth}
    height={viewportHeight}
    class="block max-w-full h-auto shadow-md"
  >
  </canvas>
</div>

<style>
  .pdf-page-canvas {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }
</style>
