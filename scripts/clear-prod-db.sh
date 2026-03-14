#!/bin/bash
# Clear production D1 database (without deleting it)
# Usage: ./scripts/clear-prod-db.sh
#
# ⚠️  WARNING: This will DELETE ALL DATA in production!
#    Only use during development when data loss is acceptable.
#    THIS SCRIPT WILL BE DELETED BEFORE PRODUCTION LAUNCH.
#
# This script clears all data from the production D1 database tables.
# The database schema is preserved - only rows are deleted.
#
# Prerequisites:
# - User must be logged into wrangler (wrangler login)
# - Production D1 database must exist

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ⚠️  PRODUCTION D1 Database Clear Script                     ║"
echo "║  This will DELETE ALL DATA in the PRODUCTION database!       ║"
echo "║  THIS SCRIPT WILL BE DELETED BEFORE PRODUCTION LAUNCH.      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if nvm is available
if ! command -v node &> /dev/null; then
    echo "Loading nvm..."
    source ~/.nvm/nvm.sh
fi

# Switch to production environment
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Switching to production environment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cp wrangler.prod.jsonc wrangler.jsonc
echo "✓ Copied wrangler.prod.jsonc → wrangler.jsonc"
echo ""

# Show current row counts
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Current row counts:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

get_count() {
    local table=$1
    local output
    output=$(npx wrangler d1 execute cleanebook-db --remote --command "SELECT COUNT(*) as count FROM $table" 2>/dev/null)
    # Parse the count from the output - handle multiple formats
    local count
    count=$(echo "$output" | grep -oE '"count"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+' | head -1)
    if [ -z "$count" ]; then
        count="0"
    fi
    echo "$count"
}

users_count=$(get_count "users")
sessions_count=$(get_count "sessions")
jobs_count=$(get_count "jobs")
templates_count=$(get_count "templates")
oauth_count=$(get_count "oauth_accounts")

echo "  users:          $users_count"
echo "  sessions:       $sessions_count"
echo "  jobs:           $jobs_count"
echo "  templates:      $templates_count"
echo "  oauth_accounts: $oauth_count"
echo ""

# Calculate total
total=$((users_count + sessions_count + jobs_count + templates_count + oauth_count))

if [ "$total" -eq 0 ]; then
    echo "✅ Database is already empty. Nothing to clear."
    exit 0
fi

# Double confirmation for production
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  DOUBLE CONFIRMATION REQUIRED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You are about to DELETE ALL DATA in PRODUCTION:"
echo "  - $total database rows"
echo ""
read -p "Type 'DELETE PRODUCTION DATA' to confirm: " confirm
if [ "$confirm" != "DELETE PRODUCTION DATA" ]; then
    echo "Aborted. No changes made."
    exit 0
fi

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Clearing tables (respecting foreign key constraints)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clear tables in order: child tables first, then parent tables
# This respects foreign key constraints

echo "[1/5] Clearing oauth_accounts..."
npx wrangler d1 execute cleanebook-db --remote --command "DELETE FROM oauth_accounts"

echo "[2/5] Clearing sessions..."
npx wrangler d1 execute cleanebook-db --remote --command "DELETE FROM sessions"

echo "[3/5] Clearing jobs..."
npx wrangler d1 execute cleanebook-db --remote --command "DELETE FROM jobs"

echo "[4/5] Clearing templates..."
npx wrangler d1 execute cleanebook-db --remote --command "DELETE FROM templates"

echo "[5/5] Clearing users..."
npx wrangler d1 execute cleanebook-db --remote --command "DELETE FROM users"

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Verifying..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

users_count=$(get_count "users")
sessions_count=$(get_count "sessions")
jobs_count=$(get_count "jobs")
templates_count=$(get_count "templates")
oauth_count=$(get_count "oauth_accounts")

echo "  users:          $users_count"
echo "  sessions:       $sessions_count"
echo "  jobs:           $jobs_count"
echo "  templates:      $templates_count"
echo "  oauth_accounts: $oauth_count"
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   Production Database Cleared!               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ All tables cleared. Schema preserved."
echo ""
echo "⚠️  REMEMBER: Delete this script before production launch!"
echo ""