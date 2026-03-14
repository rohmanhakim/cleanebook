-- Users
CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,         -- nanoid(), e.g. "usr_abc123" or "anon_abc123"
  email                 TEXT UNIQUE,              -- NULL for anonymous users
  name                  TEXT NOT NULL DEFAULT 'Anonymous',
  password_hash         TEXT,                     -- NULL if OAuth-only or anonymous
  role                  TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin'
  plan                  TEXT NOT NULL DEFAULT 'free', -- 'anonymous' | 'free' | 'reader' | 'collector'
  is_anonymous          INTEGER NOT NULL DEFAULT 0,   -- 1 = anonymous trial user
  conversions_total     INTEGER NOT NULL DEFAULT 0,   -- used for anonymous lifetime limit
  hf_api_key_encrypted  TEXT,                     -- AES-GCM encrypted BYOK key, nullable
  polar_customer_id     TEXT,                     -- Polar customer ID for billing
  conversions_this_month INTEGER NOT NULL DEFAULT 0,
  conversions_reset_at  TEXT NOT NULL,            -- ISO date, reset monthly
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- OAuth accounts (linked to users)
CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider_id           TEXT NOT NULL,            -- 'github' | 'google'
  provider_user_id      TEXT NOT NULL,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (provider_id, provider_user_id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,                   -- random 40-char hex
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,                      -- ISO datetime
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
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

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_polar_customer_id ON users(polar_customer_id);
