-- Migration 0003: Anonymous User Support
-- Adds indexes needed for anonymous trial users
-- Note: is_anonymous and conversions_total columns are already in 0001_initial.sql

-- Index for filtering anonymous users
CREATE INDEX IF NOT EXISTS idx_users_is_anonymous ON users(is_anonymous);

-- Partial index for cleanup cron - efficiently find expired anonymous users
-- Used by workers/cleanup.ts to purge anonymous users older than 48 hours
CREATE INDEX IF NOT EXISTS idx_users_anon_created ON users(created_at) WHERE is_anonymous = 1;