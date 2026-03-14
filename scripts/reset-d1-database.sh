#!/bin/bash
# Emergency script: Reset D1 database from scratch
# Usage: ./scripts/reset-d1-database.sh
#
# ⚠️  WARNING: This will DELETE ALL DATA in the D1 database!
#    Only use during development when data loss is acceptable.
#
# This script:
# 1. Shows current database info
# 2. Deletes the existing D1 database
# 3. Creates a new D1 database
# 4. Displays the new database ID (must update wrangler.prod.jsonc manually)
# 5. Runs all migrations on the new database
#
# Prerequisites:
# - User must be logged into wrangler (wrangler login)
# - wrangler.prod.jsonc must have the correct database_id before running migrations

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ⚠️  EMERGENCY: D1 Database Reset Script                     ║"
echo "║  This will DELETE ALL DATA in the production D1 database!    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Confirmation prompt
read -p "Are you sure you want to delete ALL data? Type 'yes' to confirm: " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted. No changes made."
    exit 0
fi

echo ""

# Check if nvm is available
if ! command -v node &> /dev/null; then
    echo "Loading nvm..."
    source ~/.nvm/nvm.sh
fi

# Extract current database ID from wrangler.prod.jsonc
CURRENT_DB_ID=$(grep -oP '"database_id":\s*"\K[^"]+' wrangler.prod.jsonc)
echo "Current database ID: $CURRENT_DB_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[1/4] Deleting existing D1 database..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx wrangler d1 delete cleanebook-db
echo "✓ Database deleted"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[2/4] Creating new D1 database..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
OUTPUT=$(npx wrangler d1 create cleanebook-db 2>&1)
echo "$OUTPUT"

# Extract new database ID (handle both wrangler output formats)
# Format 1: database_id = "uuid"
# Format 2: "database_id": "uuid"
NEW_DB_ID=$(echo "$OUTPUT" | grep -oP '(?:database_id["\s:=]+)["\s]*\K[a-f0-9-]{36}' || echo "")

if [ -z "$NEW_DB_ID" ]; then
    echo ""
    echo "⚠️  Could not auto-extract database ID from output."
    echo "    Please look for the database_id in the output above."
else
    echo ""
    echo "✓ New database created with ID: $NEW_DB_ID"
fi

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[3/4] UPDATE CONFIG FILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -n "$NEW_DB_ID" ]; then
    echo ""
    echo "Update BOTH config files with the new database_id:"
    echo ""
    echo "  wrangler.prod.jsonc:"
    echo '    "database_id": "'"$NEW_DB_ID"'"'
    echo ""
    echo "  wrangler.jsonc:"
    echo '    "database_id": "'"$NEW_DB_ID"'"'
    echo ""
else
    echo "Copy the database_id from the output above and update BOTH config files:"
    echo "  - wrangler.prod.jsonc"
    echo "  - wrangler.jsonc"
fi

read -p "Press Enter after updating BOTH config files to continue..."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[4/4] Running migrations on new database..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verify config file has the new database ID
DB_ID_FROM_FILE=$(grep -oP '"database_id":\s*"\K[^"]+' wrangler.jsonc)

if [ -z "$DB_ID_FROM_FILE" ]; then
    echo "ERROR: Could not find database_id in wrangler.jsonc"
    exit 1
fi

echo "Database ID from config: $DB_ID_FROM_FILE"
echo ""

# Run migrations using database name (wrangler resolves it from the config)
echo "Running: migrations/0001_initial.sql"
npx wrangler d1 execute cleanebook-db --remote --file=migrations/0001_initial.sql

echo "Running: migrations/0002_templates.sql"
npx wrangler d1 execute cleanebook-db --remote --file=migrations/0002_templates.sql

echo "Running: migrations/0003_anonymous.sql"
npx wrangler d1 execute cleanebook-db --remote --file=migrations/0003_anonymous.sql

echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   Database Reset Complete!                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ New D1 database created and migrations applied."
echo ""
echo "Next steps:"
echo "  1. Deploy to apply changes: ./scripts/deploy-preview.sh"
echo "  2. Test the application"
echo ""