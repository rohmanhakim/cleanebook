# CleanEbook — Database Schema (Cloudflare D1 / SQLite)

## Migration Files

All migrations live in `/migrations/`. Run with:
```bash
wrangler d1 migrations apply cleanebook-db
```

---

## 0001_initial.sql

```sql
-- Users
CREATE TABLE users (
  id                    TEXT PRIMARY KEY,         -- nanoid(), e.g. "usr_abc123"
  email                 TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  password_hash         TEXT,                     -- NULL if OAuth-only user
  role                  TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin'
  plan                  TEXT NOT NULL DEFAULT 'free', -- 'free' | 'reader' | 'collector'
  hf_api_key_encrypted  TEXT,                     -- AES-GCM encrypted BYOK key, nullable
  conversions_this_month INTEGER NOT NULL DEFAULT 0,
  conversions_reset_at  TEXT NOT NULL,            -- ISO date, reset monthly
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- OAuth accounts (linked to users)
CREATE TABLE oauth_accounts (
  provider_id           TEXT NOT NULL,            -- 'github' | 'google'
  provider_user_id      TEXT NOT NULL,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (provider_id, provider_user_id)
);

-- Sessions
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,                   -- random 40-char hex
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,                      -- ISO datetime
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jobs
CREATE TABLE jobs (
  id              TEXT PRIMARY KEY,               -- nanoid(), e.g. "job_abc123"
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'queued', -- see Job Status below
  pdf_key         TEXT NOT NULL,                  -- R2 key: uploads/{userId}/{uuid}.pdf
  epub_key        TEXT,                           -- R2 key: epubs/{userId}/{jobId}.epub
  template_id     TEXT REFERENCES templates(id),  -- nullable, applied template
  pdf_page_count  INTEGER NOT NULL DEFAULT 0,
  pdf_filename    TEXT NOT NULL,                  -- original filename for display
  error_message   TEXT,                           -- populated on status='failed'
  review_pages    TEXT,                           -- JSON array of page indexes needing review
  pipeline_step   TEXT,                           -- current workflow step name
  ocr_model       TEXT NOT NULL DEFAULT 'lightonai/LightOnOCR-2-1B',
  layout_model    TEXT NOT NULL DEFAULT 'microsoft/layoutlmv3-base',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Job status values:
-- 'queued'        → in CF Queue, workflow not yet started
-- 'processing'    → workflow running (geometric matching / OCR)
-- 'needs_review'  → paused, waiting for user to confirm exception pages
-- 'resuming'      → user confirmed, workflow resuming
-- 'complete'      → EPUB ready in R2
-- 'failed'        → unrecoverable error, see error_message
-- 'cancelled'     → user cancelled

CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
```

---

## 0002_templates.sql

```sql
-- Templates: reusable region rule sets
CREATE TABLE templates (
  id          TEXT PRIMARY KEY,                   -- nanoid(), e.g. "tpl_abc123"
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                      -- e.g. "O'Reilly Tech Books"
  description TEXT,
  rules       TEXT NOT NULL,                      -- JSON: RegionRule[]
  sample_page_index INTEGER NOT NULL DEFAULT 0,   -- which page was used as sample
  is_public   INTEGER NOT NULL DEFAULT 0,         -- 0=private, 1=shared (future)
  use_count   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_templates_user_id ON templates(user_id);
```

---

## TypeScript Types (matching DB schema)

```typescript
// src/lib/shared/types.ts

export type UserRole = 'user' | 'admin';
export type UserPlan = 'free' | 'reader' | 'collector';
export type JobStatus =
  | 'queued'
  | 'processing'
  | 'needs_review'
  | 'resuming'
  | 'complete'
  | 'failed'
  | 'cancelled';

export type RegionLabel =
  | 'chrome'      // header/footer/page numbers → IGNORE
  | 'content'     // main body text → OCR
  | 'heading'     // chapter/section title → OCR as heading
  | 'figure'      // image/illustration → CROP as image
  | 'caption'     // figure caption → OCR as caption
  | 'code'        // code block → OCR as <pre>
  | 'footnote';   // footnote → OCR as footnote

export type RegionAction = 'ignore' | 'ocr' | 'ocr-heading' | 'crop-image' | 'ocr-code' | 'ocr-caption' | 'ocr-footnote';

export interface RegionRule {
  id: string;
  label: RegionLabel;
  action: RegionAction;
  match: {
    // Geometric signals (from PDF.js getTextContent)
    yRange?: [number, number];          // normalized 0–1 (y / pageHeight)
    xRange?: [number, number];          // normalized 0–1 (x / pageWidth)
    fontSizeRatio?: [number, number];   // ratio to page median font size
    fontNames?: string[];               // e.g. ['Times-Bold', 'Helvetica-Bold']
    // Visual signals (fallback for scanned PDFs)
    visualSimilarityThreshold?: number; // 0.0–1.0
    sampleRegionBounds?: {              // pixel coords on sample page
      x: number; y: number; w: number; h: number;
    };
  };
  confidence: number;                   // 1.0 = user-confirmed, 0.0–0.9 = inferred
}

export interface Template {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  rules: RegionRule[];
  samplePageIndex: number;
  isPublic: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  userId: string;
  status: JobStatus;
  pdfKey: string;
  epubKey: string | null;
  templateId: string | null;
  pdfPageCount: number;
  pdfFilename: string;
  errorMessage: string | null;
  reviewPages: number[] | null;         // page indexes needing user review
  pipelineStep: string | null;
  ocrModel: string;
  layoutModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  plan: UserPlan;
  hfApiKeyEncrypted: string | null;
  conversionsThisMonth: number;
  conversionsResetAt: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}
```

---

## D1 Query Helpers (src/lib/server/db.ts pattern)

```typescript
import type { D1Database } from '@cloudflare/workers-types';
import type { Job, User, Session, Template } from '$lib/shared/types';

// Always pass DB as first arg — never import platform directly in helpers
export async function getJobById(db: D1Database, id: string): Promise<Job | null> {
  const result = await db
    .prepare('SELECT * FROM jobs WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  if (!result) return null;
  return rowToJob(result);
}

export async function getJobsByUserId(db: D1Database, userId: string): Promise<Job[]> {
  const result = await db
    .prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .bind(userId)
    .all<Record<string, unknown>>();
  return result.results.map(rowToJob);
}

export async function createJob(
  db: D1Database,
  job: Omit<Job, 'createdAt' | 'updatedAt'>
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO jobs (id, user_id, status, pdf_key, template_id, pdf_page_count,
                        pdf_filename, ocr_model, layout_model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      job.id, job.userId, job.status, job.pdfKey,
      job.templateId, job.pdfPageCount, job.pdfFilename,
      job.ocrModel, job.layoutModel
    )
    .run();
}

export async function updateJobStatus(
  db: D1Database,
  id: string,
  status: Job['status'],
  extra?: Partial<Pick<Job, 'epubKey' | 'errorMessage' | 'reviewPages' | 'pipelineStep'>>
): Promise<void> {
  // Build dynamic SET clause based on extra fields provided
  // Always update updated_at
  const fields: string[] = ['status = ?', "updated_at = datetime('now')"];
  const values: unknown[] = [status];
  if (extra?.epubKey !== undefined) { fields.push('epub_key = ?'); values.push(extra.epubKey); }
  if (extra?.errorMessage !== undefined) { fields.push('error_message = ?'); values.push(extra.errorMessage); }
  if (extra?.reviewPages !== undefined) { fields.push('review_pages = ?'); values.push(JSON.stringify(extra.reviewPages)); }
  if (extra?.pipelineStep !== undefined) { fields.push('pipeline_step = ?'); values.push(extra.pipelineStep); }
  values.push(id);

  await db
    .prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

// Row mappers (snake_case DB → camelCase TS)
function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as Job['status'],
    pdfKey: row.pdf_key as string,
    epubKey: row.epub_key as string | null,
    templateId: row.template_id as string | null,
    pdfPageCount: row.pdf_page_count as number,
    pdfFilename: row.pdf_filename as string,
    errorMessage: row.error_message as string | null,
    reviewPages: row.review_pages ? JSON.parse(row.review_pages as string) : null,
    pipelineStep: row.pipeline_step as string | null,
    ocrModel: row.ocr_model as string,
    layoutModel: row.layout_model as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
```
