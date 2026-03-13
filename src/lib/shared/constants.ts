// Plan limits and application constants

// File upload limits
export const MAX_PDF_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export const PLAN_LIMITS = {
  anonymous: {
    conversionsTotal: 1,
    maxPagesPerPdf: 50,
    canSaveTemplates: false,
    canBatch: false,
    serverSideRender: false,
    canDownloadEpub: false,
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
export const CONFIDENCE_THRESHOLD = 0.82; // below this, page goes to review queue
export const MAX_REVIEW_PAGES_AUTO_SKIP = 5; // if ≤ this many review pages, auto-notify

// OCR model defaults
export const DEFAULT_OCR_MODEL = 'lightonai/LightOnOCR-2-1B';
export const DEFAULT_LAYOUT_MODEL = 'microsoft/layoutlmv3-base';
