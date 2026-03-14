<!--
Document Version: 1.2.0
Last Updated: 2026-03-14
Source Commits:
  - 7f3f65499be5c899574383146bc00e5ca33cccd7 (Phase 002 - PDF Viewer)
Changes:
  - Added AWS SDK packages for R2 presigned URLs
  - Added paneforge for resizable panels (shadcn-svelte dependency)
  - Added svelte-media-query-store for responsive detection
-->
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
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "db:migrate:local": "npx wrangler d1 migrations apply cleanebook-db --local",
    "db:migrate:prod": "npx wrangler d1 migrations apply cleanebook-db --remote",
    "deploy": "pnpm run build && npx wrangler pages deploy .svelte-kit/cloudflare --commit-dirty=true --config wrangler.prod.jsonc"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.12.21",
    "@cloudflare/workers-types": "^4.20260312.1",
    "@playwright/test": "^1.58.2",
    "@sveltejs/adapter-cloudflare": "^7.2.8",
    "@sveltejs/kit": "^2.54.0",
    "@sveltejs/vite-plugin-svelte": "^6.2.4",
    "@tailwindcss/postcss": "^4.2.1",
    "@testing-library/svelte": "^5.3.1",
    "@types/node": "^25.4.0",
    "autoprefixer": "^10.4.27",
    "jsdom": "^28.1.0",
    "postcss": "^8.5.8",
    "svelte": "^5.53.10",
    "svelte-check": "^4.4.5",
    "tailwindcss": "^4.2.1",
    "typescript": "^5.9.3",
    "vite": "^7.3.1",
    "vitest": "3.2.4",
    "wrangler": "^4.72.0"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.1009.0",
    "@aws-sdk/s3-request-presigner": "^3.1009.0",
    "@oslojs/crypto": "^1.0.1",
    "@oslojs/encoding": "^1.1.0",
    "@polar-sh/checkout": "^0.2.0",
    "@polar-sh/sdk": "^0.46.3",
    "@tanstack/svelte-query": "^6.1.0",
    "arctic": "^3.7.0",
    "bits-ui": "^2.16.3",
    "epub-gen-memory": "^1.1.2",
    "fflate": "^0.8.2",
    "konva": "^10.2.0",
    "nanoid": "^5.0.7",
    "paneforge": "^1.0.2",
    "pdfjs-dist": "^5.5.207",
    "pdfjs-serverless": "^1.1.0",
    "svelte-konva": "^1.0.1",
    "svelte-media-query-store": "^1.0.0",
    "svelte-sonner": "^1.1.0",
    "sveltekit-superforms": "^2.30.0",
    "zod": "^3.25.67"
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

### AWS SDK — S3 client for R2 presigned URLs
The `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` packages are used
to generate presigned URLs for R2 objects. R2 provides an S3-compatible API.
These packages are server-side only (used in `+server.ts` routes).

### paneforge — Resizable panels for Svelte
`paneforge` is the Svelte port of `react-resizable-panels` and is the correct
package for shadcn-svelte's Resizable component. Do NOT attempt to install
`svelte-resizable-panels` (doesn't exist).

### svelte-media-query-store — Responsive detection
Provides reactive media query stores for desktop/mobile detection. Used for
desktop-first responsive layouts.

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
        // Basic Auth (development gating - remove in production when ready)
        BASIC_AUTH_USER: string;
        BASIC_AUTH_PASSWORD: string;
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
        plan: 'anonymous' | 'free' | 'reader' | 'collector';
        isAnonymous: boolean;
        hfApiKeyEncrypted: string | null;
        polarCustomerId: string | null;
        conversionsThisMonth: number;
        conversionsTotal: number;
        conversionsResetAt: string;
        createdAt: string;
      } | null;
    }
  }
}

export {};
```
