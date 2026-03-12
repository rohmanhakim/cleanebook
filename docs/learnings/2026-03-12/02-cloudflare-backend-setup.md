# Cloudflare Backend Infrastructure Setup

**Date**: Thu Mar 12 10:11:48 AM WIB 2026

## Summary

Successfully set up the core Cloudflare backend infrastructure for CleanEbook, proving end-to-end Cloudflare Pages deployment works.

## Resources Created

| Resource | Name | ID |
|----------|------|-----|
| D1 Database | `cleanebook-db` | `41289d9c-8dd7-471d-bdd8-291d323f5057` |
| R2 Bucket | `cleanebook-files` | - |
| KV Namespace | `KV` | `8308b000230a492a835acb185ee1e154` |
| Queue | `cleanebook-jobs` | - |
| Pages Project | `cleanebook` | - |

## Key Learnings

### 1. Wrangler Command Syntax Changed

The old `wrangler kv:namespace create` syntax is deprecated. Use space instead of colon:
```bash
# Old (deprecated)
wrangler kv:namespace create KV

# New (correct)
wrangler kv namespace create KV
```

### 2. R2 Requires Dashboard Enablement

R2 buckets cannot be created via CLI until R2 is enabled in the Cloudflare dashboard:
- Go to https://dash.cloudflare.com → R2 Object Storage → Enable R2
- Requires billing setup (even for free tier)

### 3. Pages vs Workers Configuration

Cloudflare Pages has different `wrangler.jsonc` requirements than Workers:

**Pages (correct for SvelteKit):**
```jsonc
{
  "name": "cleanebook",
  "pages_build_output_dir": ".svelte-kit/cloudflare",
  "compatibility_date": "2024-09-23",
  // NO "main" field
  // NO "workflows" - not supported
  // NO "queues.consumers" - not supported in Pages config
}
```

**Key differences:**
- Use `pages_build_output_dir` instead of `main`
- `ASSETS` binding is reserved in Pages - don't define it
- Workflows and queue consumers need separate Worker configuration

### 4. Zod v4 Breaking Changes

The project had Zod v4 installed, but `sveltekit-superforms` requires Zod v3 API:
```bash
# Downgrade to v3
pnpm add zod@^3.25.67
```

### 5. Project Must Be Created Before Deploy

Pages projects must be created explicitly:
```bash
wrangler pages project create cleanebook --production-branch main
```

Then deploy:
```bash
wrangler pages deploy .svelte-kit/cloudflare --commit-dirty=true
```

## Files Created

```
migrations/
├── 0001_initial.sql    # users, sessions, jobs, oauth_accounts
└── 0002_templates.sql  # templates table

src/lib/
├── shared/
│   ├── types.ts        # TypeScript interfaces
│   └── constants.ts    # plan limits, thresholds
└── server/
    └── db.ts           # D1 query helper stubs

workers/
└── ocr-pipeline.ts     # Workflow stub (not used in Pages config yet)
```

## Deployment URLs

- Production: https://cleanebook.pages.dev
- Deployment alias: https://master.cleanebook.pages.dev

## Next Steps

1. Run database migrations: `wrangler d1 migrations apply cleanebook-db`
2. Set production secrets via `wrangler secret put`
3. Set up Workflows as a separate Worker (not supported in Pages config)
4. Implement actual API routes and OCR pipeline

## Commands Reference

```bash
# Create resources
wrangler d1 create cleanebook-db
wrangler r2 bucket create cleanebook-files
wrangler kv namespace create KV
wrangler queues create cleanebook-jobs
wrangler pages project create cleanebook --production-branch main

# Deploy
source ~/.nvm/nvm.sh
pnpm run build
wrangler pages deploy .svelte-kit/cloudflare --commit-dirty=true

# Run migrations
wrangler d1 migrations apply cleanebook-db

# Set secrets
wrangler secret put HF_API_KEY
wrangler secret put COOKIE_SECRET