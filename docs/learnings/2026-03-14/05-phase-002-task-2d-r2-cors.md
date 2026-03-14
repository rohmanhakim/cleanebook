# Phase 002 Task 2D: R2 CORS Configuration

**Date:** 2026-03-14
**Task:** Configure CORS for R2 bucket to allow browser access to PDF files

---

## What Was Done

Configured CORS policy on the `cleanebook-files` R2 bucket to allow browsers to fetch PDF files via presigned URLs.

### CORS Policy Applied

```json
[
  {
    "AllowedOrigins": [
      "https://cleanebook.app",
      "http://localhost:5173"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Key Learnings

### 1. CORS is Not Configurable via wrangler.jsonc

Unlike other R2 settings, CORS policy cannot be defined in `wrangler.dev.jsonc` or `wrangler.prod.jsonc`. It must be configured via:

- **Cloudflare Dashboard**: R2 → Bucket → Settings → CORS Policy
- **S3 API**: Using `PutBucketCors` operation

### 2. Configuration Steps (Cloudflare Dashboard)

1. Navigate to Cloudflare Dashboard → R2
2. Select the bucket (e.g., `cleanebook-files`)
3. Go to **Settings** tab
4. Find **CORS Policy** section
5. Click **Add CORS policy**
6. Paste the JSON policy
7. Save

### 3. Allowed Origins

| Origin | Purpose |
|--------|---------|
| `https://cleanebook.app` | Production domain |
| `http://localhost:5173` | Local development (Vite dev server) |

### 4. Why CORS is Needed

When browsers fetch PDF files directly from R2 via presigned URLs, the request is cross-origin. Without CORS headers, the browser will block the response.

The presigned URL points to R2's S3-compatible endpoint:
```
https://<account-id>.r2.cloudflarestorage.com/<bucket>/<key>?X-Amz-...
```

This is a different origin than the app, so CORS is required.

### 5. Local Development Note

For local development with `wrangler dev`, the local R2 bucket may not enforce CORS the same way as production. However, the CORS policy should still be configured for consistency.

---

## Related Files

- `wrangler.dev.jsonc` - R2 bucket binding (not CORS)
- `wrangler.prod.jsonc` - R2 bucket binding (not CORS)
- `src/lib/server/r2.ts` - R2 client for presigned URLs (Task 2E)

---

## Next Steps

Task 2E will create:
- `src/lib/server/r2.ts` - R2 client and presigned URL generation
- `src/routes/api/pdf/[jobId]/signed-url/+server.ts` - API endpoint