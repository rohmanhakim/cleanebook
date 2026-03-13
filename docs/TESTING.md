<!--
Document Version: 1.2.0
Last Updated: 2026-03-13
Source Commits:
  - 362da1d5753cfcff338f6e8bd15e5c54394cb584 (Task 1D - Database Helpers)
Changes:
  - Added db.test.ts for database helper integration tests
-->
# CleanEbook — Testing Infrastructure

## Overview

CleanEbook uses a three-tier testing approach:
- **Unit Tests** — Fast, isolated tests for utilities, shared code, and Svelte components
- **Integration Tests** — Tests for server-side functions with real CF bindings
- **E2E Tests** — Full browser tests for critical user flows

## Test Stack

| Tool | Purpose | Config File |
|------|---------|-------------|
| Vitest | Unit & component tests (jsdom) | `vitest.config.ts` |
| @cloudflare/vitest-pool-workers | Integration tests with CF bindings | `vitest.integration.config.ts` |
| @testing-library/svelte | Component testing utilities | — |
| Playwright | E2E browser tests | `playwright.config.ts` |

## Directory Structure

```
tests/
├── unit/                       # Vitest unit tests
│   ├── example.test.ts         # Sample tests
│   ├── auth.test.ts            # Auth function tests (token gen, hashing, cookies)
│   └── marketing/              # Marketing component tests
│       ├── feature-card.test.ts
│       └── pricing-card.test.ts
├── integration/                # Vitest integration tests (Workers pool)
│   ├── apply-migrations.ts     # D1 migration setup helper
│   ├── auth.test.ts            # Auth integration tests (session CRUD)
│   ├── bindings.test.ts        # CF bindings tests
│   ├── db.test.ts              # Database helper tests (Job, User CRUD)
│   └── types.d.ts              # TypeScript definitions for cloudflare:test
├── e2e/                        # Playwright E2E tests
│   └── landing.spec.ts         # Landing page tests
└── helpers/                    # Test utilities (future)
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

### Separate Configs for Different Test Types

The project uses two separate Vitest configurations:

#### Unit Tests (`vitest.config.ts`)

Standard Vitest with jsdom environment for component and utility testing:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: { runes: true }
		})
	],
	test: {
		include: ['tests/unit/**/*.test.ts'],
		globals: true,
		environment: 'jsdom',
		server: {
			deps: { inline: true }
		}
	},
	resolve: {
		alias: { $lib: resolve('./src/lib') },
		conditions: ['browser'],
		mainFields: ['browser', 'module', 'main']
	}
});
```

Key configuration:
- `environment: 'jsdom'` — Provides DOM for component testing
- `conditions: ['browser']` — Uses Svelte's client-side runtime (required for `mount()`)
- `compilerOptions: { runes: true }` — Enables Svelte 5 runes mode

#### Integration Tests (`vitest.integration.config.ts`)

Cloudflare Workers pool for testing with real bindings. Includes D1 migration setup:

```typescript
// vitest.integration.config.ts
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import { resolve } from 'path';

export default defineWorkersConfig(async () => {
  // Read D1 migrations for test database setup
  const migrationsPath = resolve('./migrations');
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      include: ['tests/integration/**/*.test.ts'],
      globals: true,
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.dev.jsonc' },
          miniflare: {
            bindings: { TEST_MIGRATIONS: migrations }
          }
        }
      },
      setupFiles: ['./tests/integration/apply-migrations.ts']
    }
  };
});
```

This configuration:
- Uses the Workers pool for integration tests
- Loads bindings from `wrangler.dev.jsonc`
- Provides access to D1, R2, KV, and secrets in integration tests
- Reads D1 migrations and exposes them via `TEST_MIGRATIONS` binding
- Runs `apply-migrations.ts` setup before tests

#### D1 Migration Setup for Integration Tests

Integration tests need a properly initialized database schema. The migrations are applied via a setup file:

```typescript
// tests/integration/apply-migrations.ts
import { env } from 'cloudflare:test';

export async function applyMigrations(): Promise<void> {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
}
```

Each integration test that needs the database should call `applyMigrations()`:

```typescript
// tests/integration/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { applyMigrations } from './apply-migrations';

describe('Auth integration tests', () => {
  beforeEach(async () => {
    await applyMigrations();
  });

  it('should create and validate a session', async () => {
    // Test with a fresh database
  });
});
```

#### Type Definitions for Test Bindings

The `cloudflare:test` module types are extended in `tests/integration/types.d.ts`:

```typescript
// tests/integration/types.d.ts
declare module 'cloudflare:test' {
  import type { D1Database, R2Bucket, KVNamespace, Queue } from '@cloudflare/workers-types';

  export const env: {
    DB: D1Database;
    R2: R2Bucket;
    KV: KVNamespace;
    QUEUE: Queue;
    // Migration bindings from vitest.integration.config.ts
    TEST_MIGRATIONS: readonly { sql: string; name: string }[];
    // Secrets from .dev.vars
    HF_API_KEY: string;
    COOKIE_SECRET: string;
    // ... other secrets
  };

  // Provided by @cloudflare/vitest-pool-workers
  export function applyD1Migrations(
    db: D1Database,
    migrations: readonly { sql: string; name: string }[]
  ): Promise<void>;
}
```

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

### Svelte 5 Component Testing

Use `@testing-library/svelte` for testing components:

```typescript
// tests/unit/components/button.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Button from '$lib/components/ui/button/button.svelte';

describe('Button', () => {
	it('should render with text', () => {
		render(Button, { children: 'Click me' });
		expect(screen.getByRole('button')).toHaveTextContent('Click me');
	});

	it('should handle click events', async () => {
		const user = userEvent.setup();
		let clicked = false;

		render(Button, {
			children: 'Click me',
			onclick: () => { clicked = true; }
		});

		await user.click(screen.getByRole('button'));
		expect(clicked).toBe(true);
	});
});
```

### Using Runes in Test Files

To use Svelte 5 runes (`$state`, `$derived`, `$effect`) directly in tests, name the file with `.svelte.test.ts`:

```typescript
// tests/unit/stores/counter.svelte.test.ts
import { flushSync } from 'svelte';
import { describe, it, expect } from 'vitest';
import { createCounter } from '$lib/client/stores/counter.svelte.js';

describe('Counter store', () => {
	it('should track state changes', () => {
		// runes work here because file is .svelte.test.ts
		let count = $state(0);
		const counter = createCounter(() => count);

		expect(counter.value).toBe(0);

		count = 5;
		expect(counter.value).toBe(5);
	});
});
```

### Testing Effects with `$effect.root`

When testing code that uses `$effect`, wrap the test in `$effect.root`:

```typescript
// tests/unit/utils/logger.svelte.test.ts
import { flushSync } from 'svelte';
import { describe, it, expect } from 'vitest';
import { createLogger } from '$lib/shared/logger.svelte.js';

describe('Logger', () => {
	it('should log state changes', () => {
		const cleanup = $effect.root(() => {
			let value = $state(0);
			const log = createLogger(() => value);

			flushSync(); // execute pending effects synchronously
			expect(log.entries).toEqual([0]);

			value = 1;
			flushSync();
			expect(log.entries).toEqual([0, 1]);
		});

		cleanup(); // always clean up effect roots
	});
});
```

**Important:** Always call `cleanup()` at the end of the test to prevent memory leaks.

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
- Production deployments (on master branch)

## Best Practices

### Do's
- ✅ Write tests for all utility functions in `$lib/shared/`
- ✅ Test Zod schema validation
- ✅ Test critical user flows with E2E
- ✅ Use descriptive test names
- ✅ Keep tests focused and isolated
- ✅ Use `env` from `cloudflare:test` for integration tests with real bindings
- ✅ Use `.svelte.test.ts` extension when you need runes in tests
- ✅ Use `flushSync()` for synchronous assertions after state changes
- ✅ Clean up `$effect.root()` with the returned cleanup function
- ✅ Prefer `@testing-library/svelte` over direct `mount()` for component tests
- ✅ Use `userEvent.setup()` for simulating user interactions

### Don'ts
- ❌ Test implementation details
- ❌ Import server code in client tests
- ❌ Make E2E tests dependent on each other
- ❌ Skip tests in CI
- ❌ Mock CF bindings manually — use the Workers pool instead
- ❌ Forget to call `cleanup()` after `$effect.root()`
- ❌ Use `defineWorkersConfig` for unit/component tests — it conflicts with jsdom
- ❌ Forget `conditions: ['browser']` in vitest config — causes `mount()` to be unavailable

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