# CleanEbook — Development Learnings

## SvelteKit + Cloudflare Setup

### 1. ESM Module Resolution

**Problem:** Vite 7 + SvelteKit 2 requires ESM modules. Without `"type": "module"` in `package.json`, you get errors like:

```
Failed to resolve "@sveltejs/kit/vite". This package is ESM only but it was tried to load by `require`.
```

**Solution:** Add `"type": "module"` to `package.json`:

```json
{
  "name": "cleanebook",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  ...
}
```

### 2. SvelteKit Sync Required Before First Run

**Problem:** The `tsconfig.json` extends `./.svelte-kit/tsconfig.json` which doesn't exist until SvelteKit generates it.

**Solution:** Run `svelte-kit sync` before the first `vite dev`:

```bash
pnpm exec svelte-kit sync
```

This generates:
- `.svelte-kit/tsconfig.json` — Generated TypeScript config
- `.svelte-kit/types/` — Type definitions for routes

### 3. Cloudflare Workflows Not Available Locally

**Problem:** When using CF Workflows in `wrangler.jsonc`, you get a warning:

```
You have defined bindings to the following Workflows:
- {"binding":"OCR_WORKFLOW","name":"ocr-pipeline","class_name":"OcrPipeline"}
These are not available in local development...
```

**Understanding:** This is expected behavior. CF Workflows require the Cloudflare runtime and cannot be simulated locally with `vite dev`. For local testing, you would need to use `wrangler pages dev` with proper bindings, or mock the workflow bindings.

### 4. Dev Server Uses `.dev.vars` for Secrets

The `vite dev` command automatically loads `.dev.vars` for local development secrets. This file should contain:

```
HF_API_KEY=your_key_here
COOKIE_SECRET=your_secret_here
```

These map to CF Workers secrets in production (set via `wrangler secret put`).

### 5. Adapter Configuration

The `@sveltejs/adapter-cloudflare` requires specific route configuration:

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-cloudflare';

export default {
  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>']
      }
    })
  }
};
```

This tells the adapter to handle all routes via the Cloudflare Workers runtime.

### 6. Type Augmentation for CF Bindings

CF bindings must be typed in `src/app.d.ts`:

```typescript
declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        R2: R2Bucket;
        KV: KVNamespace;
        QUEUE: Queue;
        OCR_WORKFLOW: Workflow;
        // ... secrets
      };
    }
  }
}
```

Access via `platform.env.DB` in server code, not via direct import.

## Best Practices Discovered

1. **Always pin dependency versions** — Use exact versions from `STACK.md` to avoid compatibility issues.

2. **Server vs Client imports matter** — `$lib/server/*` can only be imported in server-side code. SvelteKit enforces this at build time.

3. **Use Zod v3 API only** — Zod v4 has breaking changes. Superforms has a separate adapter for v4.

4. **No lucia** — It's deprecated. Use `@oslojs/crypto` and `@oslojs/encoding` for session management.