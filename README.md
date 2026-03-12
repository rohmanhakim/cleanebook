# CleanEbook

Convert PDF files into clean, well-structured EPUB files optimized for eReaders.

## Prerequisites

- Node.js 18+ (managed via nvm)
- pnpm 10+

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
- `HF_API_KEY` — HuggingFace API key
- `COOKIE_SECRET` — 32-byte random string for session HMAC

### 3. Start Development Server

```bash
source ~/.nvm/nvm.sh && pnpm dev
```

The app will be available at http://localhost:5173/

### 4. Type Checking

```bash
pnpm check
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
- **Auth:** @oslojs/crypto + arctic (no lucia)
- **Validation:** Zod v3

## Documentation

See `docs/` for detailed documentation:
- `ARCHITECTURE.md` — System architecture
- `STACK.md` — Dependencies and versions
- `PROJECT_STRUCTURE.md` — Directory layout
- `CONVENTIONS.md` — Code style guide