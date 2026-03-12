# Local Infrastructure Setup

**Date**: Wed Mar 12 10:27:00 AM WIB 2026

## Summary

Set up local development infrastructure that mimics production Cloudflare environment, enabling isolated local development without touching production resources.

## Files Created/Modified

| File | Change |
|------|--------|
| `wrangler.dev.jsonc` | Local dev config (placeholder IDs, local resources) |
| `wrangler.prod.jsonc` | Production config (real Cloudflare resource IDs) |
| `wrangler.jsonc` | Generated file (gitignored) - copied from dev or prod config |
| `package.json` | Added `db:migrate:local`, `db:migrate:prod`, updated `deploy` script |
| `.gitignore` | Added `wrangler.jsonc` to excluded generated file |

## Configuration Strategy

### Dynamic Config Generation Approach

Cloudflare Pages does not support `--config` flag for custom wrangler config paths. The solution is to dynamically copy the appropriate config file to `wrangler.jsonc` before running commands.

**`wrangler.dev.jsonc`** (for local dev):
- Uses placeholder IDs like `db-local`, `kv-local`
- R2 bucket: `cleanebook-files-local`
- Queue: `cleanebook-jobs-local`
- All resources stored in `.wrangler/state/v3/`

**`wrangler.prod.jsonc`** (for production):
- Uses real Cloudflare resource IDs
- D1: `41289d9c-8dd7-471d-bdd8-291d323f5057`
- KV: `8308b000230a492a835acb185ee1e154`
- R2: `cleanebook-files`
- Queue: `cleanebook-jobs`

**`wrangler.jsonc`** (generated, gitignored):
- Created by playbook scripts
- Not committed to git

## Local Resource Locations

```
.wrangler/
└── state/
    └── v3/
        ├── d1/
        │   └── miniflare-D1DatabaseObject/
        │       └── sqlite.db          # Local SQLite database
        ├── r2/
        │   └── cleanebook-files-local/  # Local R2 bucket
        └── kv/
            └── kv-local/               # Local KV namespace
```

## NPM Scripts

```bash
# Local development
pnpm run dev                    # Start Vite dev server with CF bindings

# Database migrations
pnpm run db:migrate:local       # Apply migrations to local D1
pnpm run db:migrate:prod        # Apply migrations to production D1

# Deployment
pnpm run deploy                 # Build + deploy to production using wrangler.prod.jsonc
```

## Key Learnings

### 1. Vite Dev Mode Reads wrangler.jsonc Automatically

When running `vite dev` with `@sveltejs/adapter-cloudflare`, SvelteKit automatically:
- Reads `wrangler.jsonc` for bindings
- Loads `.dev.vars` for secrets
- Creates local emulated D1, R2, KV in `.wrangler/state/`

### 2. No Need for wrangler pages dev in Development

The `vite dev` command is sufficient for local development. `wrangler pages dev` is only needed for testing the built output or when you need the exact Pages runtime behavior.

### 3. Local Migrations Must Be Run Explicitly

Local D1 databases are not automatically migrated. Run:
```bash
pnpm run db:migrate:local
```

### 4. Cloudflare Pages Does Not Support --config Flag

Unlike Workers, Cloudflare Pages does not support custom config file paths. The workaround is to dynamically copy the appropriate config to `wrangler.jsonc`:

```bash
# For production deploy
cp wrangler.prod.jsonc wrangler.jsonc
wrangler pages deploy .svelte-kit/cloudflare --commit-dirty=true
```

### 5. D1 Migrations Use database_name, Not database_id

The `wrangler d1 migrations apply` command uses the `database_name` from the config, but it also needs the correct `database_id` to identify the remote database. This is why we need the prod config in place before running remote migrations.

## Testing Local Setup

1. Start dev server: `pnpm run dev`
2. Visit `http://localhost:5173` (or next available port)
3. Check console for "Using secrets defined in .dev.vars"

## Deployment Playbooks

Three playbook scripts are provided for different deployment targets:

| Script | Purpose | URL | Environment |
|--------|---------|-----|-------------|
| `deploy-local.sh` | Local development | `localhost:5173` | N/A (uses `.dev.vars`) |
| `deploy-preview.sh` | Preview deployment | `xyz.cleanebook.pages.dev` | `preview` |
| `deploy-prod.sh` | Production deployment | `cleanebook.pages.dev` | `production` |

### `scripts/deploy-local.sh`

Runs local deployment:
1. Copies `wrangler.dev.jsonc` → `wrangler.jsonc`
2. Runs D1 migrations against local database
3. Builds SvelteKit
4. Prints next steps for starting dev server

Usage:
```bash
chmod +x scripts/deploy-local.sh
./scripts/deploy-local.sh
```

### `scripts/deploy-preview.sh`

Runs preview deployment:
1. Copies `wrangler.prod.jsonc` → `wrangler.jsonc`
2. Runs D1 migrations against production database
3. Builds SvelteKit
4. Deploys to Cloudflare Pages (preview environment)

Usage:
```bash
chmod +x scripts/deploy-preview.sh
./scripts/deploy-preview.sh
```

**Note:** Preview deployments use `preview` environment secrets and create unique URLs.

### `scripts/deploy-prod.sh`

Runs production deployment:
1. Copies `wrangler.prod.jsonc` → `wrangler.jsonc`
2. Runs D1 migrations against production database
3. Builds SvelteKit
4. Deploys to Cloudflare Pages with `--branch=master`

Usage:
```bash
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh
```

**Note:** Production deployments use `production` environment secrets.

### Why Playbook Scripts?

- **Consistency**: Same steps every time, no missed steps
- **Onboarding**: New developers can deploy with one command
- **CI/CD**: Scripts can be called from GitHub Actions or other CI systems
- **Documentation**: The script itself documents the deployment process

## Next Steps

1. Add API routes to test D1 queries
2. Test file upload to local R2
3. Test session storage in local KV
