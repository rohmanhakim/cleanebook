# Phase 002 Task 2E + 2F: Presigned URL API and R2 Bindings

**Date:** 2026-03-14
**Task:** Create presigned URL API endpoint and R2 S3-compatible bindings

---

## What Was Done

Combined Task 2E and 2F since they're tightly coupled:

1. Added R2 S3-compatible API credentials to `app.d.ts` type definitions
2. Created R2 client helper for presigned URL generation
3. Created API endpoint for generating presigned URLs

### Files Created/Modified

| File | Action |
|------|--------|
| `src/app.d.ts` | Added R2 credential bindings |
| `src/lib/server/r2.ts` | Created R2 client and presigned URL helper |
| `src/routes/api/pdf/[jobId]/signed-url/+server.ts` | Created API endpoint |

---

## Key Learnings

### 1. R2 Requires Separate S3 API Credentials

R2 has two ways to access objects:
1. **Native R2 binding** - `env.R2` (already configured)
2. **S3-compatible API** - Requires separate credentials

For presigned URLs, we need the S3-compatible API credentials:
- `R2_ACCOUNT_ID` - Cloudflare account ID
- `R2_ACCESS_KEY_ID` - Access key from R2 API token
- `R2_SECRET_ACCESS_KEY` - Secret key from R2 API token
- `R2_BUCKET_NAME` - Bucket name

These are created via Cloudflare Dashboard → R2 → Manage R2 API Tokens.

### 2. S3Client Endpoint Format

R2's S3-compatible endpoint uses the account ID:

```typescript
endpoint: `https://${accountId}.r2.cloudflarestorage.com`
```

Region is always `'auto'` for R2.

### 3. Presigned URL Flow

```
Client → GET /api/pdf/[jobId]/signed-url
       → Server validates auth & job ownership
       → Server generates presigned URL using S3 SDK
       → Server returns URL to client
       → Client fetches PDF directly from R2 using presigned URL
```

This avoids server proxying the PDF content, reducing server load and latency.

### 4. Type Import Issue

`import type { App } from '@sveltejs/kit'` doesn't work for accessing `App.Platform`. Instead, define the env type inline:

```typescript
export function createR2Client(env: {
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}): S3Client {
  // ...
}
```

### 5. Secrets Configuration

The R2 credentials must be set as secrets via:
- **Cloudflare Dashboard**: Workers & Pages → Settings → Variables and Secrets
- **Wrangler CLI**: `wrangler secret put R2_ACCOUNT_ID`

They are NOT in `wrangler.jsonc` because they're sensitive values.

---

## API Endpoint Details

### GET `/api/pdf/[jobId]/signed-url`

**Response:**
```json
{
  "url": "https://<account>.r2.cloudflarestorage.com/<bucket>/<key>?X-Amz-...",
  "expiresAt": "2026-03-15T15:00:00.000Z",
  "expiresIn": 86400
}
```

**Error Responses:**
- `401` - Unauthorized (no user session)
- `404` - Job not found or not owned by user
- `500` - Database/R2 not configured

---

## Secrets vs Variables Classification

R2 credentials should be classified as follows:

| Variable | Type | Reason |
|----------|------|--------|
| `R2_ACCOUNT_ID` | **Variable** | Public info — visible in dashboard URL, not sensitive |
| `R2_ACCESS_KEY_ID` | **Secret** | Part of credential pair — should be protected |
| `R2_SECRET_ACCESS_KEY` | **Secret** | Highly sensitive — like a password, grants full R2 access |
| `R2_BUCKET_NAME` | **Variable** | Public info — just the bucket name, not sensitive |

### Configuration

**In `wrangler.jsonc` (vars):**
```jsonc
"vars": {
  "R2_ACCOUNT_ID": "your-account-id",
  "R2_BUCKET_NAME": "your-bucket-name"
}
```

**Via Dashboard (secrets):**
- Go to Workers & Pages → cleanebook → Settings → Variables and Secrets
- Add `R2_ACCESS_KEY_ID` as "Secret"
- Add `R2_SECRET_ACCESS_KEY` as "Secret"

**For local development (`.dev.vars`):**
All 4 can be in `.dev.vars` (which should be in `.gitignore`):
```
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
```

---

## Next Steps

Task 2G will create:
- `src/lib/components/app/pdf-page-canvas.svelte` - Single page canvas renderer
- `src/lib/components/app/pdf-viewer.svelte` - Full PDF viewer component
