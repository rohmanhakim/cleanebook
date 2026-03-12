# Landing Page & CI/CD Infrastructure Setup

**Date:** 2026-03-12
**Session Goal:** Create a basic landing page and prove point end-to-end CI/CD pipeline works.

## What Was Done

### 1. Landing Page
- Created a simple landing page at `/` with:
  - Hero section with product tagline
  - Features section (3 feature cards)
  - How It Works section (3 steps)
  - Pricing section (Free, Reader, Collector tiers)
  - Header with navigation
  - Footer with placeholder links

### 2. Styling Setup
- Configured Tailwind CSS v4 with `@tailwindcss/postcss` plugin
- Created `src/app.css` with:
  - `@import "tailwindcss"` for Tailwind v4
  - `@theme` block for custom brand colors
  - Custom component classes (`.btn-primary`, `.btn-secondary`, `.container-narrow`)

### 3. Testing Infrastructure
- **Vitest 3.2.4** for unit + integration tests (`vitest.config.ts`)
- **@cloudflare/vitest-pool-workers 0.12.21** for Workers pool
- Sample tests created:
  - `tests/unit/example.test.ts` — Basic unit test examples
  - `tests/integration/bindings.test.ts` — Cloudflare bindings tests (D1, R2, KV)
- **Playwright** for E2E tests (`playwright.config.ts`)
  - `tests/e2e/landing.spec.ts` — Landing page E2E tests

### 4. GitHub Actions CI/CD
- Created `.github/workflows/ci.yml` with:
  - `lint-and-typecheck` job — Runs `pnpm check`
  - `unit-tests` job — Runs `pnpm test`
  - `e2e-tests` job — Runs Playwright tests
  - `deploy-preview` job — Deploys to CF Pages on PRs
  - `deploy-production` job — Deploys to CF Pages on main

## Key Learnings

### Tailwind CSS v4 Configuration

Tailwind CSS v4 has a different configuration approach:

1. **No `tailwind.config.ts`** — Configuration is done in CSS via `@theme`
2. **PostCSS plugin changed** — Use `@tailwindcss/postcss` instead of `tailwindcss` directly
3. **CSS-first configuration** — Use `@import "tailwindcss"` in CSS files

```css
/* app.css */
@import "tailwindcss";

@theme {
  --color-brand-500: #0ea5e9;
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

### @cloudflare/vitest-pool-workers Setup

**Final Configuration (March 2026):**
After testing bleeding-edge versions, settled on stable versions:

```json
{
  "vitest": "^3.2.4",
  "@cloudflare/vitest-pool-workers": "^0.12.21"
}
```

**vitest.config.ts:**
```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
		globals: true,
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.dev.jsonc' }
			}
		}
	}
});
```

**Integration tests** can now import `env` from `cloudflare:test`:

```typescript
import { env } from 'cloudflare:test';

// env.DB — D1 database binding
// env.R2 — R2 bucket binding
// env.KV — KV namespace binding
```

**Note:** `cloudflare:test` is a virtual module generated at runtime by the workers pool. TypeScript may show an error, but tests run successfully.

### Playwright Configuration

For SvelteKit projects:
- Configure `webServer` to start the dev server automatically in CI
- Use `reuseExistingServer: !process.env.CI` for local development
- Install browsers with `pnpm exec playwright install --with-deps chromium`

### GitHub Actions for Cloudflare Pages

Required secrets:
- `CLOUDFLARE_API_TOKEN` — Token with Pages deploy permissions
- `CLOUDFLARE_ACCOUNT_ID` — Your Cloudflare account ID

Required repository variables (not secrets, since they're non-sensitive):
- `BASIC_AUTH_USER` — Username for Basic Auth gating
- `BASIC_AUTH_PASSWORD` — Password for Basic Auth gating

Use `cloudflare/pages-action@v1` for deployments.

### Basic Auth in CI/CD Pipeline

The app uses Basic Auth to gate the frontend during development. To make this work in CI:

1. **hooks.server.ts checks both sources:**
```typescript
const basicAuthUser = platform?.env?.BASIC_AUTH_USER ?? process.env.BASIC_AUTH_USER;
const basicAuthPassword = platform?.env?.BASIC_AUTH_PASSWORD ?? process.env.BASIC_AUTH_PASSWORD;
```

2. **CI workflow passes env vars to tests:**
```yaml
- name: Run E2E tests
  env:
    BASIC_AUTH_USER: ${{ vars.BASIC_AUTH_USER }}
    BASIC_AUTH_PASSWORD: ${{ vars.BASIC_AUTH_PASSWORD }}
  run: pnpm test:e2e
```

3. **Playwright tests use httpCredentials:**
```typescript
test.use({
  httpCredentials: {
    username: process.env.BASIC_AUTH_USER || 'admin',
    password: process.env.BASIC_AUTH_PASSWORD || 'qwerty123'
  }
});
```

**Why repository variables instead of secrets?**
- Basic Auth credentials for development gating are not sensitive secrets
- Repository variables can be viewed by anyone with repo access
- Secrets are for truly sensitive data (API tokens, etc.)

**Flow:**
```
GitHub Actions workflow
  ↓ (sets env vars from vars.BASIC_AUTH_*)
Playwright test runner
  ↓ (inherits env vars)
webServer.command: pnpm dev
  ↓ (inherits env vars)
Vite dev server → hooks.server.ts reads process.env
```

## Files Created/Modified

| File | Action |
|------|--------|
| `src/routes/+page.svelte` | Created landing page |
| `src/routes/+layout.svelte` | Created root layout |
| `src/app.css` | Global styles with Tailwind v4 |
| `postcss.config.js` | PostCSS config with `@tailwindcss/postcss` |
| `vitest.config.ts` | Vitest + Workers pool configuration |
| `playwright.config.ts` | Playwright configuration |
| `tests/unit/example.test.ts` | Sample unit tests |
| `tests/integration/bindings.test.ts` | CF bindings integration tests |
| `tests/integration/types.d.ts` | TypeScript definitions for cloudflare:test |
| `tests/e2e/landing.spec.ts` | Landing page E2E tests |
| `.github/workflows/ci.yml` | CI/CD pipeline |
| `src/hooks.server.ts` | Updated to check process.env for Basic Auth |
| `docs/TESTING.md` | Testing documentation |
| `README.md` | Updated with testing section |

## Testing the Pipeline Locally

```bash
# Run unit + integration tests
pnpm test

# Run type checking
pnpm check

# Build for production
pnpm build

# Run E2E tests (requires dev server)
pnpm test:e2e
```

## Next Steps

1. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets in GitHub
2. Add `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` repository variables in GitHub
3. Push to `main` to trigger the first production deployment
4. Create a PR to test the preview deployment flow
5. Add more comprehensive tests as features are built

### Future: Vitest 4.x Support

When Vitest 4.x support is released in `@cloudflare/vitest-pool-workers`:
1. Monitor the PR #11632 for a stable release tag
2. Update `vitest` to `^4.x` and `@cloudflare/vitest-pool-workers` to latest
3. Use `defineWorkersConfig` with the new API