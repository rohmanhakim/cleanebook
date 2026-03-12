# CleanEbook — OCR Pipeline & Heuristic Matching

## Overview

The pipeline has two major innovations over dumb converters:

1. **User defines rules once** on a sample page → algorithm applies to all pages
2. **Geometric-first matching** (free, fast) with AI fallback only for uncertain pages

---

## Heuristic Matching Algorithm

### Step 1: Geometric Text Analysis (Workers, free)

PDF.js `getTextContent()` returns text items with native coordinates.
This works on any PDF with a text layer (i.e., not a pure scan).

```typescript
// src/lib/server/heuristic/geometric.ts

interface TextItem {
  str: string;
  transform: number[];   // [scaleX, skewX, skewY, scaleY, translateX, translateY]
  width: number;
  height: number;
  fontName: string;
}

interface NormalizedTextItem {
  text: string;
  x: number;         // normalized 0–1
  y: number;         // normalized 0–1 (from top)
  fontSize: number;  // absolute
  fontSizeRatio: number; // relative to page median
  fontName: string;
  width: number;     // normalized 0–1
}

export function normalizeTextItems(
  items: TextItem[],
  pageWidth: number,
  pageHeight: number
): NormalizedTextItem[] {
  const fontSizes = items.map(i => Math.abs(i.transform[3]));
  const medianFontSize = median(fontSizes);

  return items.map(item => {
    const fontSize = Math.abs(item.transform[3]);
    return {
      text: item.str,
      x: item.transform[4] / pageWidth,
      y: 1 - (item.transform[5] / pageHeight),  // flip Y (PDF coords are bottom-up)
      fontSize,
      fontSizeRatio: fontSize / medianFontSize,
      fontName: item.fontName,
      width: item.width / pageWidth,
    };
  });
}

export function matchRuleGeometric(
  item: NormalizedTextItem,
  rule: RegionRule
): number {
  // Returns confidence 0.0–1.0 that this item matches the rule
  let score = 0;
  let checks = 0;

  if (rule.match.yRange) {
    checks++;
    const [min, max] = rule.match.yRange;
    if (item.y >= min && item.y <= max) score++;
  }

  if (rule.match.xRange) {
    checks++;
    const [min, max] = rule.match.xRange;
    if (item.x >= min && item.x <= max) score++;
  }

  if (rule.match.fontSizeRatio) {
    checks++;
    const [min, max] = rule.match.fontSizeRatio;
    if (item.fontSizeRatio >= min && item.fontSizeRatio <= max) score++;
  }

  if (rule.match.fontNames && rule.match.fontNames.length > 0) {
    checks++;
    if (rule.match.fontNames.some(fn => item.fontName.includes(fn))) score++;
  }

  return checks === 0 ? 0 : score / checks;
}
```

### Step 2: Page-Level Confidence Scoring

```typescript
// For each page, score it against all rules.
// If ANY rule gets confidence ≥ CONFIDENCE_THRESHOLD, auto-process.
// Otherwise, add to review queue.

const CONFIDENCE_THRESHOLD = 0.82;  // in src/lib/shared/constants.ts

export function classifyPage(
  pageItems: NormalizedTextItem[],
  rules: RegionRule[]
): { label: RegionLabel; items: NormalizedTextItem[]; confidence: number }[] {
  // Group items by best-matching rule
  // Returns regions with their classifications and confidence scores
}
```

### Step 3: AI Fallback (HuggingFace, only for low-confidence pages)

Low-confidence pages (or pages from image-only scanned PDFs) are sent to
the HF Inference API for layout analysis.

```typescript
// src/lib/server/hf.ts

const LAYOUT_MODEL = 'microsoft/layoutlmv3-base';  // configurable per job
const OCR_MODEL = 'lightonai/LightOnOCR-2-1B';     // configurable per job

export async function runLayoutAnalysis(
  imageBlob: Blob,
  apiKey: string
): Promise<LayoutAnalysisResult> {
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${LAYOUT_MODEL}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBlob,
    }
  );
  // ... parse response
}

export async function runOcr(
  imageBlob: Blob,
  apiKey: string
): Promise<string> {
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${OCR_MODEL}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBlob,
    }
  );
  const result = await response.json();
  return result[0]?.generated_text ?? '';
}
```

---

## CF Workflow — OcrPipeline

File: `workers/ocr-pipeline.ts`

This is the long-running durable workflow. Each `step.do()` call is retried
independently if it fails. The workflow can be paused and resumed.

```typescript
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

interface JobParams {
  jobId: string;
}

export class OcrPipeline extends WorkflowEntrypoint<Env, JobParams> {
  async run(event: WorkflowEvent<JobParams>, step: WorkflowStep) {
    const { jobId } = event.payload;

    // ── Step 1: Load job and template ──────────────────────────────
    const { job, template, apiKey } = await step.do('load-job', async () => {
      const job = await getJobById(this.env.DB, jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);
      const template = job.templateId
        ? await getTemplateById(this.env.DB, job.templateId)
        : null;
      const user = await getUserById(this.env.DB, job.userId);
      const apiKey = user?.hfApiKeyEncrypted
        ? await decryptApiKey(user.hfApiKeyEncrypted, this.env.COOKIE_SECRET)
        : this.env.HF_API_KEY;
      return { job, template, apiKey };
    });

    await updateJobStatus(this.env.DB, jobId, 'processing', { pipelineStep: 'geometric-analysis' });

    // ── Step 2: Fetch PDF, extract text layer ──────────────────────
    const { textByPage, pageCount } = await step.do('extract-text-layer', async () => {
      const pdfBuffer = await this.env.R2.get(job.pdfKey).then(r => r?.arrayBuffer());
      if (!pdfBuffer) throw new Error('PDF not found in R2');
      return extractTextLayer(pdfBuffer);  // uses pdfjs-serverless
    });

    // ── Step 3: Geometric matching ────────────────────────────────
    const { autoQueue, reviewQueue } = await step.do('geometric-matching', async () => {
      if (!template) {
        // No template: all pages go to review queue
        return { autoQueue: [], reviewQueue: Array.from({ length: pageCount }, (_, i) => i) };
      }
      return classifyAllPages(textByPage, template.rules);
    });

    // ── Step 4: Pause if review needed ───────────────────────────
    if (reviewQueue.length > 0) {
      await updateJobStatus(this.env.DB, jobId, 'needs_review', {
        reviewPages: reviewQueue,
        pipelineStep: 'waiting-for-review',
      });

      // Wait for user confirmation (webhook from /api/job/:id/confirm)
      const confirmed = await step.waitForEvent('user-confirmed', {
        timeout: '7 days',
      });
      // confirmed.payload contains corrected region rules for review pages
    }

    await updateJobStatus(this.env.DB, jobId, 'processing', { pipelineStep: 'ocr' });

    // ── Step 5: OCR each page (chunked to avoid timeouts) ─────────
    const ocrResults: Record<number, string> = {};

    // Process in batches of 10 pages per step to stay within Worker limits
    const allPages = [...autoQueue, ...reviewQueue];
    const batches = chunk(allPages, 10);

    for (const batch of batches) {
      const batchResults = await step.do(`ocr-batch-${batch[0]}`, async () => {
        const results: Record<number, string> = {};
        for (const pageIndex of batch) {
          const pageImageBlob = await renderPageToBlob(job.pdfKey, pageIndex, this.env.R2);
          results[pageIndex] = await runOcr(pageImageBlob, apiKey);
        }
        return results;
      });
      Object.assign(ocrResults, batchResults);
    }

    // ── Step 6: Crop and store figures ───────────────────────────
    const figureKeys = await step.do('crop-figures', async () => {
      // Extract figure regions from pages, upload to R2
      // Return map of pageIndex → R2 keys[]
    });

    // ── Step 7: Assemble EPUB ─────────────────────────────────────
    const epubBuffer = await step.do('assemble-epub', async () => {
      return assembleEpub({
        job,
        ocrResults,
        figureKeys,
        template,
      });
    });

    // ── Step 8: Upload EPUB to R2 ────────────────────────────────
    const epubKey = `epubs/${job.userId}/${jobId}.epub`;
    await step.do('upload-epub', async () => {
      await this.env.R2.put(epubKey, epubBuffer, {
        httpMetadata: { contentType: 'application/epub+zip' },
      });
    });

    // ── Step 9: Mark complete ────────────────────────────────────
    await step.do('finalize', async () => {
      await updateJobStatus(this.env.DB, jobId, 'complete', {
        epubKey,
        pipelineStep: 'done',
      });
      await incrementUserConversions(this.env.DB, job.userId);
    });
  }
}
```

---

## EPUB Assembly

EPUB3 is a zip file with specific structure. Built with `fflate` (not epub-gen-memory
in the Workflow, as epub-gen-memory has Node dependencies). epub-gen-memory can be
used as a reference for the structure.

```
book.epub (zip)
├── mimetype                    # must be first, uncompressed: "application/epub+zip"
├── META-INF/
│   └── container.xml           # points to OPF file
└── OEBPS/
    ├── content.opf             # package document: metadata, manifest, spine
    ├── toc.ncx                 # NCX table of contents (EPUB2 compat)
    ├── nav.xhtml               # EPUB3 nav document (TOC)
    ├── chapters/
    │   ├── ch001.xhtml         # one file per detected chapter
    │   ├── ch002.xhtml
    │   └── ...
    ├── images/
    │   ├── fig_001_00.png      # {pageIndex}_{figureIndex}
    │   └── ...
    └── styles/
        └── main.css            # minimal eReader-safe CSS
```

---

## Supported HuggingFace Models

Configurable per job. Stored in `jobs.ocr_model` and `jobs.layout_model`.

### OCR Models
| Model ID | Best for |
|---|---|
| `lightonai/LightOnOCR-2-1B` | General text, fast |
| `facebook/nougat-large` | Academic PDFs, math, LaTeX |
| `microsoft/trocr-large-printed` | Clean printed text |

### Layout Models
| Model ID | Best for |
|---|---|
| `microsoft/layoutlmv3-base` | General layout analysis |
| `ds4sd/docling` | Complex multi-column documents |

---

## Plan Limits (src/lib/shared/constants.ts)

```typescript
export const PLAN_LIMITS = {
  anonymous: {
    conversionsTotal: 1,            // lifetime, not monthly
    maxPagesPerPdf: 50,
    canSaveTemplates: false,
    canBatch: false,
    serverSideRender: false,
    canDownloadEpub: false,         // must sign up to download
  },
  free: {
    conversionsPerMonth: 3,
    maxPagesPerPdf: 100,
    canSaveTemplates: false,
    canBatch: false,
    serverSideRender: false,
    canDownloadEpub: true,
  },
  reader: {
    conversionsPerMonth: 40,
    maxPagesPerPdf: 500,
    canSaveTemplates: true,
    canBatch: false,
    serverSideRender: true,
    canDownloadEpub: true,
  },
  collector: {
    conversionsPerMonth: Infinity,
    maxPagesPerPdf: Infinity,
    canSaveTemplates: true,
    canBatch: true,
    serverSideRender: true,
    canDownloadEpub: true,
  },
} as const;

export const CLIENT_RENDER_THRESHOLD = 80; // pages; above this, use server-side render
export const CONFIDENCE_THRESHOLD = 0.82;  // below this, page goes to review queue
export const MAX_REVIEW_PAGES_AUTO_SKIP = 5; // if ≤ this many review pages, auto-notify
export const ANONYMOUS_SESSION_TTL_HOURS = 48; // anonymous users purged after this
```
