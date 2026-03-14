#!/bin/bash
# Switch wrangler.jsonc to target environment
# Usage: ./scripts/switch-env.sh <local|prod|preview>
#
# This script copies the appropriate wrangler config to wrangler.jsonc:
#   local   → wrangler.dev.jsonc
#   prod    → wrangler.prod.jsonc
#   preview → wrangler.prod.jsonc (same as prod, different deployment target)

set -e

ENV=${1:-}

if [ -z "$ENV" ]; then
    echo "Usage: ./scripts/switch-env.sh <local|prod|preview>"
    echo ""
    echo "Environments:"
    echo "  local   - Local development (wrangler.dev.jsonc)"
    echo "  prod    - Production (wrangler.prod.jsonc)"
    echo "  preview - Preview (wrangler.prod.jsonc)"
    exit 1
fi

case "$ENV" in
    local)
        SOURCE="wrangler.dev.jsonc"
        ;;
    prod|preview)
        SOURCE="wrangler.prod.jsonc"
        ;;
    *)
        echo "Error: Unknown environment '$ENV'"
        echo "Valid options: local, prod, preview"
        exit 1
        ;;
esac

if [ ! -f "$SOURCE" ]; then
    echo "Error: Source file '$SOURCE' not found"
    exit 1
fi

cp "$SOURCE" wrangler.jsonc
echo "✓ Switched to $ENV environment ($SOURCE → wrangler.jsonc)"