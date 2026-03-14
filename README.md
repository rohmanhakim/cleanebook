# CleanEbook

Convert PDF files into clean, well-structured EPUB files optimized for eReaders.

## Prerequisites

- Node.js 18+ (managed via nvm)
- pnpm 10+
- Cloudflare account with R2, D1, KV, and Queues enabled

## Local Development Setup

### 1. Install Dependencies

```bash
source ~/.nvm/nvm.sh
pnpm install
```

### 2. Configure Environment Variables

Copy `.dev.vars` and fill in the values:

```bash
cp .dev.vars .dev.vars.local
```

Required variables:
- `HF_API_KEY` — HuggingFace API key (get from https://huggingface.co/settings/tokens)
- `COOKIE_SECRET` — 32-byte random string for session HMAC
- `POLAR_ACCESS_TOKEN` — Polar billing access token (optional for MVP)
- `POLAR_WEBHOOK_SECRET` — Polar webhook signing secret (optional for MVP)
- `BASIC_AUTH_USER` — Username for development gating (remove in production)
- `BASIC_AUTH_PASSWORD` — Password for development gating (remove in production)

### 3. Start Development Server

```bash
source ~/.nvm/nvm.sh && pnpm dev
```

The app will be available at http://localhost:5173/

### 4. Type Checking

```bash
pnpm check
```

## Testing

### Unit Tests

```bash
# Run unit tests once
pnpm test:unit

# Run unit tests in watch mode
pnpm test:unit --watch
```

### Integration Tests

```bash
# Run integration tests (requires Cloudflare Workers pool)
pnpm test:integration
```

### E2E Tests

```bash
# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui
```

### Run All Tests

```bash
pnpm test
```

See `docs/TESTING.md` for detailed testing documentation.

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment:

- **On every PR**: Lint, typecheck, unit tests, E2E tests, preview deployment
- **On master branch**: Full test suite + production deployment

See `.github/workflows/ci.yml` for the pipeline configuration.

### Required GitHub Secrets

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Pages deploy permissions
- `CLOUDFLARE_ACCOUNT_ID` — Your Cloudflare account ID

## Deployment

Playbook scripts are provided for both local and production deployments. Each script runs migrations, builds the project, and deploys (or prepares for local dev).

### Initial Setup (One-time)

The following Cloudflare resources were created:
- **D1 Database**: `cleanebook-db`
- **R2 Bucket**: `cleanebook-files`
- **KV Namespace**: `KV`
- **Queue**: `cleanebook-jobs`
- **Pages Project**: `cleanebook`

Set production secrets (one-time setup):

```bash
source ~/.nvm/nvm.sh

# API keys and other secrets
wrangler pages secret put HF_API_KEY
wrangler pages secret put COOKIE_SECRET
wrangler pages secret put POLAR_ACCESS_TOKEN
wrangler pages secret put POLAR_WEBHOOK_SECRET

# Basic Auth (development gating - remove when ready for public access)
wrangler pages secret put BASIC_AUTH_USER
wrangler pages secret put BASIC_AUTH_PASSWORD

# IMPORTANT: Also set secrets for preview environment (used by direct uploads)
wrangler pages secret put HF_API_KEY --env preview
wrangler pages secret put COOKIE_SECRET --env preview
wrangler pages secret put BASIC_AUTH_USER --env preview
wrangler pages secret put BASIC_AUTH_PASSWORD --env preview
```

**Note**: Cloudflare Pages has separate `production` and `preview` environments. Direct uploads via `wrangler pages deploy` create preview deployments, so secrets must be set for both environments.

### Deployment Scripts

Three deployment scripts are provided:

| Script | Purpose | URL |
|--------|---------|-----|
| `deploy-local.sh` | Local development | `localhost:5173` |
| `deploy-preview.sh` | Preview deployment | `xyz.cleanebook.pages.dev` |
| `deploy-prod.sh` | Production deployment | `cleanebook.pages.dev` |

#### Local Development

```bash
chmod +x scripts/deploy-local.sh
./scripts/deploy-local.sh
```

This will:
1. Copy `wrangler.dev.jsonc` → `wrangler.jsonc`
2. Run D1 migrations against the local database
3. Build the SvelteKit application
4. Print instructions for starting the dev server

Then start development:
```bash
pnpm run dev
```

#### Preview Deployment

Preview deployments are useful for testing before releasing to production:

```bash
chmod +x scripts/deploy-preview.sh
./scripts/deploy-preview.sh
```

This deploys to a unique preview URL (e.g., `abc123.cleanebook.pages.dev`).

**Note:** Preview deployments use `preview` environment secrets.

#### Production Deployment

```bash
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh
```

This will:
1. Copy `wrangler.prod.jsonc` → `wrangler.jsonc`
2. Run D1 migrations against the production database
3. Build the SvelteKit application
4. Deploy to Cloudflare Pages production

The app is live at: https://cleanebook.pages.dev

**Note:** Production deployments use `production` environment secrets.

### Configuration Files

The project uses two configuration files:

| File | Purpose |
|------|---------|
| `wrangler.dev.jsonc` | Local development (uses local D1, R2, KV) |
| `wrangler.prod.jsonc` | Production (uses real Cloudflare resource IDs) |

The playbook scripts copy the appropriate config to `wrangler.jsonc` (which is gitignored).

### Emergency Database Reset

⚠️ **Warning**: This deletes ALL data! Only use during early development.

If you need to recreate the D1 database from scratch (e.g., schema changes that require a fresh database):

```bash
chmod +x scripts/reset-d1-database.sh
./scripts/reset-d1-database.sh
```

This script will:
1. Delete the existing D1 database
2. Create a new D1 database
3. Prompt you to update both `wrangler.prod.jsonc` AND `wrangler.jsonc` with the new database ID
4. Run all migrations on the new database

**Note**: After running this script, you must redeploy: `./scripts/deploy-preview.sh`

### Manual Commands

If you need to run steps individually:

```bash
# Set up config first
cp wrangler.dev.jsonc wrangler.jsonc   # For local
# OR
cp wrangler.prod.jsonc wrangler.jsonc  # For production

# Database migrations
npx wrangler d1 migrations apply cleanebook-db --local   # Local D1
npx wrangler d1 migrations apply cleanebook-db --remote  # Production D1

# Build and deploy
pnpm run build
npx wrangler pages deploy .svelte-kit/cloudflare --commit-dirty=true
```

## Project Structure

```
src/
├── lib/
│   ├── server/     # Server-only code (never in browser bundle)
│   ├── shared/     # Safe to import anywhere
│   ├── client/     # Browser-only code
│   └── components/ # Svelte components
├── routes/         # SvelteKit routes
│   ├── (marketing)/ # Public landing pages
│   ├── (auth)/      # Authentication routes
│   ├── (app)/       # Protected app routes
│   ├── (admin)/     # Admin dashboard
│   └── api/         # API endpoints
├── workers/        # Cloudflare Workflows
├── migrations/     # D1 database migrations
└── app.css         # Global styles (Tailwind CSS v4)
tests/
├── unit/           # Vitest unit tests
├── integration/    # Integration tests
└── e2e/            # Playwright E2E tests
```

## Tech Stack

- **Framework:** SvelteKit 2.x with Svelte 5
- **Runtime:** Cloudflare Workers/Pages
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2
- **Cache/Sessions:** Cloudflare KV
- **Job Queue:** Cloudflare Queues
- **Auth:** @oslojs/crypto + arctic (no lucia)
- **Validation:** Zod v3
- **Billing:** Polar
- **Testing:** Vitest + Playwright
- **Styling:** Tailwind CSS v4

## Documentation

See `docs/` for detailed documentation:
- `ARCHITECTURE.md` — System architecture
- `STACK.md` — Dependencies and versions
- `PROJECT_STRUCTURE.md` — Directory layout
- `CONVENTIONS.md` — Code style guide
- `DATABASE.md` — D1 schema and queries
- `PIPELINE.md` — OCR pipeline details
- `TESTING.md` — Testing infrastructure