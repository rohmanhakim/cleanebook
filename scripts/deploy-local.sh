#!/bin/bash
# Deploy to local environment
# Usage: ./scripts/deploy-local.sh
#
# This script:
# 1. Sets up wrangler.jsonc from wrangler.dev.jsonc
# 2. Runs D1 migrations against local database
# 3. Builds the SvelteKit application
# 4. Prints instructions for starting the dev server

set -e

echo "╔════════════════════════════════════════════╗"
echo "║     CleanEbook Local Deployment Playbook   ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check if nvm is available
if ! command -v node &> /dev/null; then
    echo "Loading nvm..."
    source ~/.nvm/nvm.sh
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[1/4] Setting up local wrangler config..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cp wrangler.dev.jsonc wrangler.jsonc
echo "✓ Copied wrangler.dev.jsonc → wrangler.jsonc"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[2/4] Running local D1 migrations..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx wrangler d1 migrations apply cleanebook-db --local
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[3/4] Building SvelteKit..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pnpm run build
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[4/4] Local deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Local environment is ready!"
echo ""
echo "Next steps:"
echo "  • Run 'pnpm run dev' to start the development server"
echo "  • Run 'pnpm run preview' to preview the production build"
echo ""
echo "Local resources are stored in: .wrangler/state/v3/"