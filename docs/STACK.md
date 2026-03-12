# CleanEbook — Dependency Stack

All versions are verified against npmjs.com as of March 2025.
Do NOT upgrade versions without re-verifying. Do NOT use versions not listed here.

---

## package.json (complete)

```json
{
  "name": "cleanebook",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
    "deploy": "npm run build && wrangler pages deploy"
  },
  "devDependencies": {
    "@sveltejs/adapter-cloudflare": "^7.2.8",
    "@sveltejs/kit": "^2.53.4",
    "@sveltejs/vite-plugin-svelte": "^6.0.0",
    "@cloudflare/workers-types": "^4.20260307.1",
    "svelte": "^5.53.8",
    "svelte-check": "^4.0.0",
    "typescript": "^5.5.0",
    "vite": "^7.0.0",
    "wrangler": "^4.71.0"
  },
  "dependencies": {
    "@oslojs/crypto": "^1.0.1",
    "@oslojs/encoding": "^1.1.0",
    "@tanstack/svelte-query": "^6.1.0",
    "arctic": "^3.1.1",
    "bits-ui": "^2.16.3",
    "epub-gen-memory": "^1.1.2",
    "fflate": "^0.8.2",
    "konva": "^10.2.0",
    "pdfjs-dist": "^5.5.207",
    "pdfjs-serverless": "^0.6.0",
    "svelte-konva": "^1.0.1",
    "svelte-sonner": "^1.0.7",
    "sveltekit-superforms": "^2.29.1",
    "zod": "^3.25.67",
    "@polar-sh/sdk": "^0.46.3",
    "@polar-sh/checkout": "^0.2.0"
  }
}
```

---

## Critical Version Notes

### Zod — use v3 API only
Zod 4 has breaking changes. Superforms has a separate `zod4` adapter.
Do NOT use Zod 4 syntax. All schemas use v3 API:
```typescript
import { z } from 'zod';                    // ✅ correct
import { z } from 'zod/v4';                 // ❌ never use this
```

### lucia — DO NOT INSTALL
`lucia` is deprecated at v3.2.2. Do not install it. Auth is implemented
manually using `@oslojs/crypto` and `@oslojs/encoding`. See `AUTH.md`.

### oslo — DO NOT INSTALL
`oslo` (the single package) is deprecated. Use scoped packages:
- `@oslojs/crypto` — password hashing, HMAC, random bytes
- `@oslojs/encoding` — base64url, hex encoding

### pdfjs-dist — CLIENT SIDE ONLY
Never import `pdfjs-dist` in a `+server.js` file or any Worker-side code.
For server-side PDF processing (future), use `pdfjs-serverless` instead.

### @sveltejs/adapter-cloudflare-workers — DO NOT INSTALL
This package is deprecated. The correct adapter is `@sveltejs/adapter-cloudflare`.

### @polar-sh/nextjs and @polar-sh/astro — DO NOT INSTALL
There is no official SvelteKit adapter for Polar. Use `@polar-sh/sdk` directly
for all API calls and `@polar-sh/checkout` for the embeddable checkout component.
Do NOT install the Next.js or Astro Polar packages.

---

## svelte.config.js

```javascript
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>']
      }
    })
  }
};

export default config;
```

---

## tsconfig.json

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "target": "ES2022",
    "types": ["@cloudflare/workers-types"]
  }
}
```

---

## CF Bindings Type Augmentation

All CF bindings must be typed. Create this file:

```typescript
// src/app.d.ts
import type { D1Database, R2Bucket, KVNamespace, Queue } from '@cloudflare/workers-types';

declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        R2: R2Bucket;
        KV: KVNamespace;
        QUEUE: Queue;
        OCR_WORKFLOW: Workflow;
        ASSETS: Fetcher;
        // Secrets (CF Workers secrets, not in wrangler.jsonc)
        HF_API_KEY: string;
        COOKIE_SECRET: string;
        POLAR_ACCESS_TOKEN: string;
        POLAR_WEBHOOK_SECRET: string;
      };
      context: ExecutionContext;
      caches: CacheStorage & { default: Cache };
    }
    interface Locals {
      user: {
        id: string;
        email: string;
        name: string;
        role: 'user' | 'admin';
        plan: 'free' | 'reader' | 'collector';
        hfApiKey: string | null;
      } | null;
    }
  }
}

export {};
```
