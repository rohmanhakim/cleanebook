# Phase 002 Task 2A: Install Dependencies

**Date:** 2026-03-14
**Task:** Install dependencies for PDF Viewer with Resizable Layout

---

## What Was Done

Installed 4 new dependencies required for Phase 2 (PDF Viewer):

| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-s3` | ^3.1009.0 | S3 client for R2's S3-compatible API |
| `@aws-sdk/s3-request-presigner` | ^3.1009.0 | Generate presigned URLs for R2 objects |
| `paneforge` | ^1.0.2 | Resizable panels for Svelte |
| `svelte-media-query-store` | ^1.0.0 | Reactive desktop/mobile detection |

---

## Key Learnings

### 1. `svelte-resizable-panels` Doesn't Exist

The task spec referenced `svelte-resizable-panels` as the dependency for shadcn-svelte's Resizable component. However, this package **does not exist** on npm:

```
ERR_PNPM_FETCH_404  GET https://registry.npmjs.org/svelte-resizable-panels: Not Found - 404
```

**Solution:** The correct package is **`paneforge`** - the official Svelte port of `react-resizable-panels` by the Svecosystem team.

**Why this matters:** Always verify package names exist before specifying them in task docs. The Svelte ecosystem sometimes has differently-named ports of popular React libraries.

### 2. AWS SDK Packages for R2

Cloudflare R2 provides an S3-compatible API, requiring AWS SDK packages for presigned URL generation:

- `@aws-sdk/client-s3` - The S3 client itself
- `@aws-sdk/s3-request-presigner` - The `getSignedUrl` function

These are **server-side only** packages - they should only be used in `+server.ts` routes or server-side code, never in client components.

### 3. AWS SDK Bundle Size

The AWS SDK packages added **107 new packages** to `node_modules`. This is expected because the AWS SDK is modular but has many internal dependencies. The tree-shaking should help in production builds, but it's worth noting for future reference.

### 4. Peer Dependency Warnings

After installation, there were peer dependency warnings:

```
└─┬ @cloudflare/vitest-pool-workers 0.12.21
  ├── ✕ unmet peer @vitest/runner@"2.0.x - 3.2.x": found 4.1.0-beta.4
  └── ✕ unmet peer @vitest/snapshot@"2.0.x - 3.2.x": found 4.1.0-beta.4
```

This is related to the existing vitest version mismatch (the project uses vitest 3.2.4 but @cloudflare/vitest-pool-workers expects 2.0.x - 3.2.x range). This is a known issue from Phase 1 and doesn't affect the new dependencies.

---

## Installation Command

```bash
source ~/.nvm/nvm.sh && pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner paneforge svelte-media-query-store
```

Note: The `source ~/.nvm/nvm.sh` prefix is required per `.clinerules` for any `pnpm` commands.

---

## Documentation Updates

Updated `docs/STACK.md` with:

1. Added new packages to the `dependencies` section
2. Added critical version notes for:
   - AWS SDK packages (server-side only)
   - paneforge (correct package name, not `svelte-resizable-panels`)
   - svelte-media-query-store (responsive detection)

---

## Next Steps

Task 2B will add the shadcn components:
- `npx shadcn-svelte@latest add resizable` (uses paneforge)
- `npx shadcn-svelte@latest add skeleton`