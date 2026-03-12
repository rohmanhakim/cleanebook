# CleanEbook — Testing Infrastructure

## Overview

CleanEbook uses a three-tier testing approach:
- **Unit Tests** — Fast, isolated tests for utilities and shared code
- **Integration Tests** — Tests for server-side functions with real CF bindings
- **E2E Tests** — Full browser tests for critical user flows

## Test Stack

| Tool | Purpose | Config File |
|------|---------|-------------|
| Vitest 3.2.4 | Unit & integration tests | `vitest.config.ts` |
| @cloudflare/vitest-pool-workers | Workers pool for CF bindings | `vitest.config.ts` |
| Playwright | E2E browser tests | `playwright.config.ts` |

## Directory Structure

```
tests/
├── unit/                  # Vitest unit tests
│   └── example.test.ts    # Sample tests
├── integration/           # Vitest integration tests (Workers pool)
│   ├── bindings.test.ts   # CF bindings tests
│   └── types.d.ts         # TypeScript definitions for cloudflare:test
├── e2e/                   # Playwright E2E tests
│   └── landing.spec.ts    # Landing page tests
└── helpers/               # Test utilities (future)
    └── testData.ts        # Test fixtures
```

## Running Tests

### Unit & Integration Tests

```bash
# Run all tests once
pnpm test

# Run in watch mode during development
pnpm test:watch
```

### E2E Tests

```bash
# Run E2E tests (starts dev server automatically)
pnpm test:e2e

# Run with Playwright UI for debugging
pnpm test:e2e:ui
```

**Note:** E2E tests require the dev server to be running. Playwright is configured to start it automatically in CI, but for local runs you may need to start it manually first if `reuseExistingServer` is true.

## Vitest Configuration

### Workers Pool Setup

The project uses `@cloudflare/vitest-pool-workers` to provide real Cloudflare bindings in integration tests:

```typescript
// vitest.config.ts
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

This configuration:
- Uses the Workers pool for all tests
- Loads bindings from `wrangler.dev.jsonc`
- Provides access to D1, R2, KV, and secrets in integration tests

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/schemas.test.ts
import { describe, it, expect } from 'vitest';
import { loginSchema } from '$lib/shared/schemas';

describe('loginSchema', () => {
	it('should validate valid credentials', () => {
		const result = loginSchema.safeParse({
			email: 'test@example.com',
			password: 'password123'
		});
		expect(result.success).toBe(true);
	});

	it('should reject invalid email', () => {
		const result = loginSchema.safeParse({
			email: 'not-an-email',
			password: 'password123'
		});
		expect(result.success).toBe(false);
	});
});
```

### Integration Test Example (with CF Bindings)

```typescript
// tests/integration/db.test.ts
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('Database operations', () => {
	it('should have access to D1 database', () => {
		expect(env.DB).toBeDefined();
	});

	it('should query the database', async () => {
		const result = await env.DB.prepare('SELECT 1 as test').first();
		expect(result).toEqual({ test: 1 });
	});
});
```

### Type Definitions

The `cloudflare:test` module is a virtual module generated at runtime. TypeScript definitions are provided in `tests/integration/types.d.ts`:

```typescript
// tests/integration/types.d.ts
declare module 'cloudflare:test' {
	import type { D1Database, R2Bucket, KVNamespace, Queue } from '@cloudflare/workers-types';

	export const env: {
		DB: D1Database;
		R2: R2Bucket;
		KV: KVNamespace;
		QUEUE: Queue;
		// Secrets from .dev.vars
		HF_API_KEY: string;
		COOKIE_SECRET: string;
		// ... other secrets
	};
}
```

### E2E Test Example

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
	test('should show login form', async ({ page }) => {
		await page.goto('/login');
		await expect(page.locator('input[type="email"]')).toBeVisible();
		await expect(page.locator('input[type="password"]')).toBeVisible();
	});

	test('should redirect to dashboard after login', async ({ page }) => {
		await page.goto('/login');
		await page.fill('input[type="email"]', 'test@example.com');
		await page.fill('input[type="password"]', 'password123');
		await page.click('button[type="submit"]');
		await expect(page).toHaveURL('/dashboard');
	});
});
```

## CI/CD Integration

Tests run automatically in GitHub Actions (see `.github/workflows/ci.yml`):

1. **lint-and-typecheck** — Runs `pnpm check`
2. **unit-tests** — Runs `pnpm test`
3. **e2e-tests** — Runs `pnpm test:e2e`

All tests must pass before:
- Preview deployments (on PRs)
- Production deployments (on main branch)

## Best Practices

### Do's
- ✅ Write tests for all utility functions in `$lib/shared/`
- ✅ Test Zod schema validation
- ✅ Test critical user flows with E2E
- ✅ Use descriptive test names
- ✅ Keep tests focused and isolated
- ✅ Use `env` from `cloudflare:test` for integration tests with real bindings

### Don'ts
- ❌ Test implementation details
- ❌ Import server code in client tests
- ❌ Make E2E tests dependent on each other
- ❌ Skip tests in CI
- ❌ Mock CF bindings manually — use the Workers pool instead

## Debugging Failed Tests

### Unit & Integration Tests
```bash
# Run with verbose output
pnpm vitest run --reporter=verbose

# Run specific test file
pnpm vitest run tests/integration/bindings.test.ts
```

### E2E Tests
```bash
# Run with UI mode
pnpm test:e2e:ui

# Run specific test file
pnpx playwright tests/e2e/landing.spec.ts

# View trace after failure
pnpx playwright show-trace trace.zip
```

## Test Coverage

Coverage reports are generated automatically in CI. To generate locally:

```bash
pnpm vitest run --coverage
```

Coverage reports are saved to `coverage/` directory.

## Future: Vitest 4.x Support

When Vitest 4.x support is released in `@cloudflare/vitest-pool-workers`:

1. Monitor PR #11632 for stable release
2. Update dependencies:
   ```bash
   pnpm add -D vitest@^4.0.0 @cloudflare/vitest-pool-workers@latest
   ```
3. The `defineWorkersConfig` API should remain compatible