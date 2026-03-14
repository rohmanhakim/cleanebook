#!/bin/bash
# Clear local D1 database (without deleting it)
# Usage: ./scripts/clear-local-db.sh
#
# This script clears all data from the local D1 database tables.
# The database schema is preserved - only rows are deleted.
#
# Prerequisites:
# - Local D1 database must exist (created via wrangler d1 migrations apply --local)

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🗑️  Clear Local D1 Database                                 ║"
echo "║  This will DELETE ALL DATA in the local database!           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if nvm is available
if ! command -v node &> /dev/null; then
    echo "Loading nvm..."
    source ~/.nvm/nvm.sh
fi

# Show current row counts
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Current row counts:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

get_count() {
    local table=$1
    local count=$(npx wrangler d1 execute cleanebook-db --local --command "SELECT COUNT(*) as count FROM $table" 2>/dev/null | grep -oP '"count":\s*\K\d+' || echo "0")
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

# Confirmation prompt
total=$((users_count + sessions_count + jobs_count + templates_count + oauth_count))
if [ "$total" -eq 0 ]; then
    echo "✅ Database is already empty. Nothing to clear."
    exit 0
fi

read -p "Clear all data? Type 'yes' to confirm: " confirm
if [ "$confirm" != "yes" ]; then
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
npx wrangler d1 execute cleanebook-db --local --command "DELETE FROM oauth_accounts"

echo "[2/5] Clearing sessions..."
npx wrangler d1 execute cleanebook-db --local --command "DELETE FROM sessions"

echo "[3/5] Clearing jobs..."
npx wrangler d1 execute cleanebook-db --local --command "DELETE FROM jobs"

echo "[4/5] Clearing templates..."
npx wrangler d1 execute cleanebook-db --local --command "DELETE FROM templates"

echo "[5/5] Clearing users..."
npx wrangler d1 execute cleanebook-db --local --command "DELETE FROM users"

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
echo "║                   Database Cleared!                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ All tables cleared. Schema preserved."
echo ""