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