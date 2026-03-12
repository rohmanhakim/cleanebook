# CleanEbook — API Endpoints

All endpoints live under `src/routes/api/`. They are `+server.ts` files
returning `json()` or `Response`. All endpoints require authentication
unless marked PUBLIC.

All request bodies are JSON unless noted. All responses are JSON.

---

## Authentication

All protected endpoints read the session from the `session` cookie via
`event.locals.user` (set in `hooks.server.ts`). If `locals.user` is null,
return `error(401, 'Unauthorized')`.

---

## POST /api/upload

Upload a PDF to R2. Multipart form data, not JSON.

**Auth:** Required  
**Content-Type:** `multipart/form-data`

**Form fields:**
- `file` — PDF file blob

**Response:**
```typescript
{
  key: string;          // R2 key: "uploads/{userId}/{uuid}.pdf"
  filename: string;     // original filename
  pageCount: number;    // extracted from PDF metadata
  sizeBytes: number;
}
```

**Errors:**
- `400` — not a PDF, file too large for plan
- `401` — not authenticated
- `429` — conversion limit reached for plan

**Implementation notes:**
- Stream directly to R2, do not buffer entire file in Worker memory
- Use `event.request.formData()` to get the file
- Extract `pageCount` from PDF metadata (first 1KB is enough for most PDFs)
- Enforce page limit based on `locals.user.plan` — see `PLAN_LIMITS` in `constants.ts`

---

## POST /api/job/create

Create a conversion job and enqueue it.

**Auth:** Required

**Request:**
```typescript
{
  pdfKey: string;         // R2 key from /api/upload
  pdfFilename: string;
  pdfPageCount: number;
  templateId?: string;    // optional: apply a saved template
  ocrModel?: string;      // optional: override default model
  layoutModel?: string;   // optional: override default model
}
```

**Response:**
```typescript
{
  jobId: string;          // e.g. "job_abc123"
  status: 'queued';
}
```

**Errors:**
- `400` — invalid pdfKey (not owned by user)
- `402` — plan upgrade required (e.g. templateId on free plan)
- `429` — monthly conversion limit reached

---

## GET /api/job/[id]

Poll job status. Called every 3 seconds by TanStack Query on the editor page.

**Auth:** Required (user must own the job)

**Response:**
```typescript
{
  id: string;
  status: JobStatus;
  pdfFilename: string;
  pdfPageCount: number;
  pipelineStep: string | null;
  reviewPages: number[] | null;   // populated when status='needs_review'
  epubReady: boolean;             // true when status='complete'
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## DELETE /api/job/[id]

Cancel a job.

**Auth:** Required (user must own the job)

**Response:** `{ success: true }`

---

## POST /api/job/[id]/confirm

User confirms review pages and resumes the workflow.

**Auth:** Required

**Request:**
```typescript
{
  // Corrected region rules for each review page
  // Key is page index (number), value is the region classifications
  corrections: Record<number, {
    regions: Array<{
      label: RegionLabel;
      action: RegionAction;
      bounds: { x: number; y: number; w: number; h: number };
    }>;
  }>;
}
```

**Response:** `{ status: 'resuming' }`

**Implementation notes:**
- Update job status to 'resuming' in D1
- Signal the CF Workflow via `OCR_WORKFLOW.get(jobId).sendEvent('user-confirmed', corrections)`

---

## GET /api/job/[id]/epub

Get a download URL for the completed EPUB.

**Auth:** Required (user must own the job, status must be 'complete')

**Response:**
```typescript
{
  downloadUrl: string;    // R2 presigned URL, valid for 1 hour
  filename: string;       // e.g. "my-book.epub"
  sizeBytes: number;
}
```

---

## GET /api/template

List user's saved templates.

**Auth:** Required

**Response:**
```typescript
{
  templates: Array<{
    id: string;
    name: string;
    description: string | null;
    useCount: number;
    createdAt: string;
  }>;
}
```

---

## POST /api/template

Create a new template.

**Auth:** Required (Reader or Collector plan only)

**Request:**
```typescript
{
  name: string;
  description?: string;
  rules: RegionRule[];
  samplePageIndex: number;
}
```

**Response:** `{ templateId: string }`

---

## GET /api/template/[id]

**Auth:** Required (must own template)

**Response:** Full `Template` object including `rules`.

---

## PUT /api/template/[id]

Update template rules or name.

**Auth:** Required

**Request:** Partial `{ name?, description?, rules?, samplePageIndex? }`

**Response:** `{ success: true }`

---

## DELETE /api/template/[id]

**Auth:** Required

**Response:** `{ success: true }`

---

## POST /api/webhook/polar

Polar billing webhook. Receives subscription lifecycle events.
Protected by Polar's webhook signature verification via `@polar-sh/sdk/webhooks`.

**Auth:** `validateEvent()` from `@polar-sh/sdk/webhooks` — NOT session auth  
**Content-Type:** `application/json` (raw body needed for signature verification)

**Events handled:**
- `subscription.active` — upgrade user plan in D1
- `subscription.updated` — handle plan change (upgrade/downgrade)
- `subscription.revoked` — downgrade user to free
- `subscription.canceled` — downgrade user to free

**Response:** `{ received: true }`

**Critical:** Read the raw request body as text before parsing — signature
verification requires the exact raw bytes. Use `request.text()`, not `request.json()`.

---

## GET /api/billing/checkout

Redirect user to Polar-hosted checkout for plan upgrade.

**Auth:** Required

**Query params:**
- `plan` — `reader` | `collector`

**Response:** `302 redirect` to Polar checkout URL

**Implementation:**
```typescript
const checkoutUrl = await createCheckoutUrl(env.POLAR_ACCESS_TOKEN, {
  productId: plan === 'reader' ? env.POLAR_READER_PRODUCT_ID : env.POLAR_COLLECTOR_PRODUCT_ID,
  customerEmail: locals.user.email,
  successUrl: `${BASE_URL}/billing/success`,
  metadata: { userId: locals.user.id },
});
redirect(302, checkoutUrl);
```

---

## GET /api/billing/portal

Redirect user to Polar customer portal (manage subscription, cancel, invoices).

**Auth:** Required (user must have `polar_customer_id`)

**Response:** `302 redirect` to Polar customer portal URL

---

## POST /api/webhook/workflow

Internal webhook called by CF Workflow on completion/failure.
Protected by a shared secret header, not session auth.

**Auth:** `X-Webhook-Secret` header must match `env.WEBHOOK_SECRET`

**Request:**
```typescript
{
  jobId: string;
  event: 'complete' | 'failed' | 'needs_review';
  payload?: {
    epubKey?: string;
    errorMessage?: string;
    reviewPages?: number[];
  };
}
```

**Response:** `{ received: true }`

---

## Admin Endpoints (role: admin only)

### GET /api/admin/stats
Overall system stats: total users, jobs today, queue depth, revenue.

### GET /api/admin/users
Paginated user list with plan/usage info.

### PATCH /api/admin/users/[id]
Update user role or plan. 

### GET /api/admin/jobs
All jobs with filtering by status, date range, user.

### POST /api/admin/jobs/[id]/retry
Re-enqueue a failed job.

---

## Error Response Format

All errors follow this shape:
```typescript
{
  error: string;      // human-readable message
  code?: string;      // machine-readable code, e.g. 'CONVERSION_LIMIT_REACHED'
}
```
