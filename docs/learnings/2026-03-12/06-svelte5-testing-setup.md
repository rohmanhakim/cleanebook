# Svelte 5 Testing Setup with Vitest

## Problem

When setting up unit tests for Svelte 5 components using `@testing-library/svelte` and Vitest, the tests failed with:

```
Svelte error: lifecycle_function_unavailable
`mount(...)` is not available on the server
```

This occurred because Vitest was loading Svelte's server-side runtime (`svelte/src/index-server.js`) instead of the client-side runtime, even when configured with `environment: 'jsdom'`.

## Root Cause

Svelte 5 has different entry points for server-side and client-side rendering. By default, Vitest's module resolution was selecting the server entry point, which doesn't have `mount()` available since server-side rendering uses `render()` instead.

## Solution

The fix was to configure Vitest's `resolve` options to prefer browser/client-side modules:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				runes: true
			}
		})
	],
	test: {
		include: ['tests/unit/**/*.test.ts'],
		globals: true,
		environment: 'jsdom',
		server: {
			deps: {
				inline: true
			}
		}
	},
	resolve: {
		alias: {
			$lib: resolve('./src/lib')
		},
		conditions: ['browser'],
		mainFields: ['browser', 'module', 'main']
	}
});
```

Key configuration:

1. **`resolve.conditions: ['browser']`** - Tells Vite/Vitest to use the browser-specific exports from packages that have conditional exports
2. **`resolve.mainFields: ['browser', 'module', 'main']`** - Prioritizes browser-specific entry points when resolving package.json main fields
3. **`environment: 'jsdom'`** - Provides a DOM environment for component testing
4. **`compilerOptions: { runes: true }`** - Enables Svelte 5 runes mode for the compiler

## Separate Configs for Different Test Types

Since the project uses `@cloudflare/vitest-pool-workers` for integration tests with real Cloudflare bindings, we needed separate configurations:

### Unit Tests (`vitest.config.ts`)
- Uses standard Vitest with jsdom environment
- For testing Svelte components and utility functions
- No access to Cloudflare bindings

### Integration Tests (`vitest.integration.config.ts`)
```typescript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		include: ['tests/integration/**/*.test.ts'],
		globals: true,
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.dev.jsonc' }
			}
		}
	}
});
```
- Uses Cloudflare Workers pool
- Provides real D1, R2, KV, Queue bindings
- Uses `cloudflare:test` module for accessing env

## Running Tests

```bash
# Run all tests (unit + integration)
pnpm test

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run e2e tests (Playwright)
pnpm test:e2e
```

## Test File Structure

```
tests/
├── unit/                  # Vitest + jsdom
│   ├── example.test.ts
│   └── marketing/
│       ├── feature-card.test.ts
│       └── pricing-card.test.ts
├── integration/           # Vitest + Workers pool
│   ├── bindings.test.ts
│   └── types.d.ts
└── e2e/                   # Playwright
    └── landing.spec.ts
```

## Writing Component Tests

Example test for a Svelte 5 component:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MyComponent from '$lib/components/my-component.svelte';

describe('MyComponent', () => {
	it('should render with props', () => {
		const { getByText } = render(MyComponent, {
			title: 'Test Title',
			description: 'Test description'
		});

		expect(getByText('Test Title')).toBeTruthy();
		expect(getByText('Test description')).toBeTruthy();
	});
});
```

## Common Pitfalls

1. **Don't use `defineWorkersConfig` for component tests** - It conflicts with jsdom environment
2. **Don't forget `conditions: ['browser']`** - Without this, Svelte loads server-side runtime
3. **Don't mix test types in the same config** - Unit tests and integration tests need different pools
4. **Use `$lib` alias** - Configure the alias so imports match the application code

## References

- [Svelte 5 Testing Documentation](https://svelte.dev/docs/svelte/testing)
- [Vitest Configuration](https://vitest.dev/config/)
- [Cloudflare Vitest Pool Workers](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [Testing Library Svelte](https://testing-library.com/docs/svelte-testing-library/intro/)