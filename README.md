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

### 3. Start Development Server

```bash
source ~/.nvm/nvm.sh && pnpm dev
```

The app will be available at http://localhost:5173/

### 4. Type Checking

```bash
pnpm check
```

## Deployment

### Initial Setup

The following Cloudflare resources were created:
- **D1 Database**: `cleanebook-db`
- **R2 Bucket**: `cleanebook-files`
- **KV Namespace**: `KV`
- **Queue**: `cleanebook-jobs`
- **Pages Project**: `cleanebook`

### Deploy to Production

```bash
source ~/.nvm/nvm.sh
pnpm run build
wrangler pages deploy .svelte-kit/cloudflare --commit-dirty=true
```

The app is live at: https://cleanebook.pages.dev

### Run Database Migrations

```bash
source ~/.nvm/nvm.sh
wrangler d1 migrations apply cleanebook-db
```

### Set Production Secrets

```bash
wrangler secret put HF_API_KEY
wrangler secret put COOKIE_SECRET
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put POLAR_WEBHOOK_SECRET
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
└── migrations/     # D1 database migrations
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

## Documentation

See `docs/` for detailed documentation:
- `ARCHITECTURE.md` — System architecture
- `STACK.md` — Dependencies and versions
- `PROJECT_STRUCTURE.md` — Directory layout
- `CONVENTIONS.md` — Code style guide
- `DATABASE.md` — D1 schema and queries
- `PIPELINE.md` — OCR pipeline details