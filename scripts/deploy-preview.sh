#!/bin/bash
# Deploy to preview environment
# Usage: ./scripts/deploy-preview.sh
#
# This script:
# 1. Sets up wrangler.jsonc from wrangler.prod.jsonc
# 2. Runs D1 migrations against production database
# 3. Builds the SvelteKit application
# 4. Deploys to Cloudflare Pages (preview environment)
#
# Note: Preview deployments use the "preview" environment secrets.
# Make sure to set secrets for preview: 
#   wrangler pages secret put BASIC_AUTH_USER --env preview
#   wrangler pages secret put BASIC_AUTH_PASSWORD --env preview

set -e

echo "╔════════════════════════════════════════════╗"
echo "║  CleanEbook Preview Deployment Playbook    ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check if nvm is available
if ! command -v node &> /dev/null; then
    echo "Loading nvm..."
    source ~/.nvm/nvm.sh
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[1/4] Setting up production wrangler config..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cp wrangler.prod.jsonc wrangler.jsonc
echo "✓ Copied wrangler.prod.jsonc → wrangler.jsonc"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[2/4] Running production D1 migrations..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx wrangler d1 migrations apply cleanebook-db --remote
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[3/4] Building SvelteKit..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pnpm run build
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[4/4] Deploying to Cloudflare Pages (preview)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx wrangler pages deploy .svelte-kit/cloudflare --commit-dirty=true
echo ""

echo "╔════════════════════════════════════════════╗"
echo "║            Deployment Complete!            ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "✅ Deployed to preview environment!"
echo ""
echo "The deployment URL will be shown above."
echo "This is a preview deployment (not production)."
echo ""
echo "Note: Uses 'preview' environment secrets."
echo ""