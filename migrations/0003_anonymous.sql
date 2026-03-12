-- Migration 0003: Anonymous User Support
-- Adds columns and indexes needed for anonymous trial users

-- Add is_anonymous column (0 = registered user, 1 = anonymous trial user)
ALTER TABLE users ADD COLUMN is_anonymous INTEGER NOT NULL DEFAULT 0;

-- Add conversions_total column (lifetime conversions, used for anonymous limit check)
ALTER TABLE users ADD COLUMN conversions_total INTEGER NOT NULL DEFAULT 0;

-- Index for filtering anonymous users
CREATE INDEX IF NOT EXISTS idx_users_is_anonymous ON users(is_anonymous);

-- Partial index for cleanup cron - efficiently find expired anonymous users
-- Used by workers/cleanup.ts to purge anonymous users older than 48 hours
CREATE INDEX IF NOT EXISTS idx_users_anon_created ON users(created_at) WHERE is_anonymous = 1;