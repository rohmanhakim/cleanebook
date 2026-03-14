# Learning Doc: D1 Database Reset and Schema Mismatch

## Overview

During Phase 001 testing, uploading a PDF failed with `NOT NULL constraint failed: users.email`. The local migration files had `email TEXT UNIQUE` (nullable), but the deployed D1 database had `email TEXT NOT NULL UNIQUE` from an older version of the schema.

## The Problem

### Error Message

```json
{
  "message": [
    "Failed to create anonymous user:",
    "Error: D1_ERROR: NOT NULL constraint failed: users.email: SQLITE_CONSTRAINT"
  ],
  "level": "error"
}
```

### Root Cause

The deployed D1 database was created with an older schema where `email` had a `NOT NULL` constraint. The local `migrations/0001_initial.sql` was later updated to make `email` nullable for anonymous users, but:

1. No migration was created to alter the existing production database
2. Cloudflare D1 doesn't support `ALTER COLUMN` directly (SQLite limitation)

## The Solution

Since we're in early development, the simplest solution was to recreate the D1 database from scratch.

### Script Created: `scripts/reset-d1-database.sh`

```bash
#!/bin/bash
# Emergency script: Reset D1 database from scratch
# ⚠️ WARNING: This will DELETE ALL DATA!
```

The script:
1. Deletes the existing D1 database
2. Creates a new D1 database
3. Prompts user to update BOTH config files
4. Runs all migrations on the new database

### Key Lessons

#### 1. Wrangler Config File Behavior

Wrangler reads from `wrangler.jsonc` at runtime, not `wrangler.prod.jsonc`. The deployment scripts copy `wrangler.prod.jsonc` → `wrangler.jsonc`, but:

- `wrangler.jsonc` is gitignored and can become stale
- Both files must be updated after creating a new database

#### 2. Wrangler D1 Execute Uses Database Name, Not UUID

```bash
# ❌ This doesn't work - wrangler treats UUID as a database name
npx wrangler d1 execute 4a908fd4-622f-4aa5-a24d-56c7fdbd1cbc --remote --file=migration.sql

# ✅ This works - wrangler resolves the name from the config file
npx wrangler d1 execute cleanebook-db --remote --file=migration.sql
```

The database ID comes from `wrangler.jsonc`:

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "cleanebook-db",
      "database_id": "4a908fd4-622f-4aa5-a24d-56c7fdbd1cbc"
    }
  ]
}
```

#### 3. D1 Migrations Track State

After running migrations manually with `d1 execute`, the migration system still tries to apply them because no migration state was recorded. To avoid this:

- Use `d1 migrations apply` for normal deployments
- Use `d1 execute` only for emergency database resets

#### 4. SQLite ALTER TABLE Limitations

SQLite doesn't support `ALTER COLUMN`. To change a column definition:

```sql
-- SQLite workaround for ALTER COLUMN
CREATE TABLE users_new (
  -- new schema with nullable email
  email TEXT UNIQUE,  -- now nullable
  ...
);

INSERT INTO users_new SELECT * FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes
CREATE INDEX ...;
```

This is complex and error-prone for production databases.

## Files Created

| File | Purpose |
|------|---------|
| `scripts/reset-d1-database.sh` | Emergency script to recreate D1 database |
| `docs/learnings/2026-03-14/01-d1-database-reset.md` | This learning doc |

## Files Modified

| File | Change |
|------|--------|
| `wrangler.prod.jsonc` | Updated with new database ID |
| `wrangler.jsonc` | Updated with new database ID |
| `README.md` | Added "Emergency Database Reset" section |

## Prevention for Future

1. **Always create migrations for schema changes** - Even if you update the initial migration file, create a follow-up migration for existing databases.

2. **Test migrations on a staging database first** - Before running migrations on production, test on a copy.

3. **Use migration versioning** - Track which migrations have been applied with `wrangler d1 migrations apply`.

4. **Document schema assumptions** - If anonymous users need nullable email, document this clearly in the schema comments.

## Related Issues

- Anonymous users require `email TEXT UNIQUE` (nullable)
- Session management works identically for anonymous and registered users
- The `createAnonymousUser()` function doesn't insert an email value

## References

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [SQLite ALTER TABLE Limitations](https://www.sqlite.org/lang_altertable.html)
- [Wrangler D1 Commands](https://developers.cloudflare.com/workers/wrangler/commands/#d1)