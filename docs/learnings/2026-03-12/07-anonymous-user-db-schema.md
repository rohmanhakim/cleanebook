# Learning: Anonymous User Database Schema (Task 1A)

**Date:** 2026-03-12
**Phase:** 001 - Anonymous User Upload Flow
**Task:** 1A - Database Schema for Anonymous Users

---

## What Was Implemented

Added database schema support for anonymous trial users who can upload PDFs without signup.

### Changes Made

1. **Updated `migrations/0001_initial.sql`** - Modified base schema for fresh installs:
   - Changed `email TEXT NOT NULL UNIQUE` → `email TEXT UNIQUE` (nullable for anonymous users)
   - Changed `name TEXT NOT NULL` → `name TEXT NOT NULL DEFAULT 'Anonymous'`
   - Added `is_anonymous INTEGER NOT NULL DEFAULT 0`
   - Added `conversions_total INTEGER NOT NULL DEFAULT 0`
   - Updated `plan` comment to include `'anonymous'` option
   - Added `idx_users_is_anonymous` index
   - Added `idx_users_anon_created` partial index (for cleanup cron)

2. **Created `migrations/0003_anonymous.sql`** - Migration for existing databases:
   - `ALTER TABLE users ADD COLUMN is_anonymous INTEGER NOT NULL DEFAULT 0`
   - `ALTER TABLE users ADD COLUMN conversions_total INTEGER NOT NULL DEFAULT 0`
   - Creates both indexes with `IF NOT EXISTS`

---

## Key Learnings

### 1. SQLite ALTER TABLE Limitations

SQLite does not support `ALTER COLUMN` to modify existing columns. This means:
- Cannot easily change `NOT NULL` constraint on `email` column
- For existing databases, the `email NOT NULL` constraint remains
- This is acceptable for early development - the application layer handles it

**Workaround for production:** Would need to:
1. Create new table with desired schema
2. Copy data from old table
3. Drop old table
4. Rename new table

Since we're in early dev with no production data, this wasn't necessary.

### 2. Migration Order Matters

**Problem encountered:** Running migration 0003 on local DB after 0001 already included the new columns caused "duplicate column name" error.

**Solution:**
- For fresh installs: 0001_initial.sql has all columns already
- For existing DBs: 0003_anonymous.sql adds columns via ALTER TABLE
- Reset local DB with `rm -rf .wrangler/state/v3/d1` and re-run migrations

### 3. D1 Local vs Remote

Both local and production D1 use SQLite under the hood:

| Environment | Location | Command |
|-------------|----------|---------|
| Local | `.wrangler/state/v3/d1/` | `wrangler d1 migrations apply <db> --local` |
| Production | Cloudflare edge | `wrangler d1 migrations apply <db> --remote` |

**Important:** Always test migrations locally first before applying to production.

### 4. Partial Index for Cleanup Efficiency

The `idx_users_anon_created` partial index is optimized for the cleanup cron:

```sql
CREATE INDEX idx_users_anon_created ON users(created_at) WHERE is_anonymous = 1;
```

This allows efficient queries like:
```sql
SELECT id FROM users 
WHERE is_anonymous = 1 
  AND created_at < datetime('now', '-48 hours');
```

The `WHERE is_anonymous = 1` clause means the index only contains anonymous users, making it smaller and faster.

---

## Schema Verification

After applying migrations, verified with:
```bash
wrangler d1 execute cleanebook-db --local --command "PRAGMA table_info(users);"
```

Result confirmed 14 columns including:
- `is_anonymous` INTEGER NOT NULL DEFAULT 0
- `conversions_total` INTEGER NOT NULL DEFAULT 0
- `email` TEXT (nullable)

---

## Commands Used

```bash
# Apply migrations to local D1
source ~/.nvm/nvm.sh && npx wrangler d1 migrations apply cleanebook-db --local

# Apply migrations to production D1
source ~/.nvm/nvm.sh && npx wrangler d1 migrations apply cleanebook-db --remote

# Verify schema
source ~/.nvm/nvm.sh && npx wrangler d1 execute cleanebook-db --local --command "PRAGMA table_info(users);"

# Reset local D1 (if needed)
rm -rf .wrangler/state/v3/d1
```

---

## Next Steps

Task 1B will update TypeScript types and constants to match this schema:
- Add `'anonymous'` to `UserPlan` type
- Add `isAnonymous: boolean` to `User` interface
- Add `conversionsTotal: number` to `User` interface
- Add `PLAN_LIMITS.anonymous` with plan constraints