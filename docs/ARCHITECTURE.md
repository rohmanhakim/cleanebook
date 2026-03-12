# CleanEbook — Architecture

## Hosting & Runtime

Everything runs on Cloudflare. There is no separate VM, no Node.js server, no Docker
container for the MVP. External services are HuggingFace Inference API and Polar (billing).

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Network                           │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────────────────────────────┐  │
│  │  CF Pages    │    │           CF Workers                     │  │
│  │  (static)    │    │  SvelteKit SSR + API routes (+server.js) │  │
│  │  marketing   │    │  /api/upload, /api/job/*, /api/webhook   │  │
│  │  pages       │    └──────────────────────────────────────────┘  │
│  └──────────────┘                    │                              │
│                              ┌───────┴────────┐                    │
│                              ▼                ▼                    │
│                         CF Queues        CF D1 (SQLite)            │
│                              │                                     │
│                              ▼                                     │
│                       CF Workflows                                 │
│                    (durable OCR pipeline)                          │
│                              │                                     │
│                    ┌─────────┴──────────┐                         │
│                    ▼                    ▼                          │
│                CF R2 (files)        CF KV (sessions)               │
└─────────────────────────────────────────────────────────────────────┘
              │                              │
              ▼ (external)                   ▼ (external)
   HuggingFace Inference API            Polar (billing MoR)
   (OCR + layout models)                (subscriptions, checkout,
                                         customer portal, webhooks)
```

---

## CF Bindings (wrangler.jsonc)

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "cleanebook",
  "main": ".svelte-kit/cloudflare/_worker.js",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": ".svelte-kit/cloudflare"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "cleanebook-db",
      "database_id": "REPLACE_WITH_REAL_ID"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "cleanebook-files"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "REPLACE_WITH_REAL_ID"
    }
  ],
  "queues": {
    "producers": [
      {
        "binding": "QUEUE",
        "queue": "cleanebook-jobs"
      }
    ],
    "consumers": [
      {
        "queue": "cleanebook-jobs",
        "max_batch_size": 1,
        "max_retries": 3
      }
    ]
  },
  "workflows": [
    {
      "binding": "OCR_WORKFLOW",
      "name": "ocr-pipeline",
      "class_name": "OcrPipeline"
    }
  ]
}
```

---

## Request Lifecycle — Happy Path

### 1. User uploads PDF (small, ≤80 pages — client-side render path)

```
Browser
  → POST /api/upload (multipart, streams to R2)
  → POST /api/job/create (jobId, pdfKey, pageCount, templateId?)
  → GET  /api/job/:id (poll every 3s via TanStack Query)

CF Worker (/api/upload)
  → stream PDF blob → R2.put(`uploads/${userId}/${uuid}.pdf`)
  → return { key, pageCount }

CF Worker (/api/job/create)
  → INSERT INTO jobs ...
  → QUEUE.send({ jobId, pdfKey, userId, templateId })
  → return { jobId }

CF Queue consumer
  → receive message
  → OCR_WORKFLOW.create({ params: { jobId } })

CF Workflow (OcrPipeline)
  → Step 1: load job from D1, load user rules/template
  → Step 2: fetch PDF from R2 → extract text layer (pdfjs-serverless)
  → Step 3: geometric matching → assign regions per page with confidence
  → Step 4: split pages into auto_queue + review_queue
  → Step 5: UPDATE jobs SET status='needs_review', review_pages=... WHERE id=?
  → [PAUSE — wait for user to confirm review pages via /api/job/:id/confirm]
  → Step 6: for each page in confirmed pages → POST to HF Inference API
  → Step 7: assemble EPUB (fflate zip)
  → Step 8: R2.put(`epubs/${userId}/${jobId}.epub`, epubBuffer)
  → Step 9: UPDATE jobs SET status='complete', epub_key=...

Browser (polling)
  → sees status='needs_review' → shows exception queue UI
  → user confirms/corrects → POST /api/job/:id/confirm
  → sees status='complete' → shows download button
```

### 2. Large PDF (>80 pages — server-side render path, paid tiers)

Same flow but CF Container (or Fly.io sidecar) handles PDF→image rendering
instead of the browser. The browser never receives raw page images for large files.
This path is NOT part of MVP. See `PIPELINE.md` for future extension.

---

## Tiered Architecture by Plan

| Feature | Free | Reader ($9) | Collector ($29) |
|---|---|---|---|
| PDF rendering | Client-side | Client + server fallback | Always server-side |
| Page limit | 100 | 500 | Unlimited |
| Conversions/month | 3 | 40 | Unlimited |
| Saved templates | ❌ | ✅ | ✅ |
| Batch processing | ❌ | ❌ | ✅ |
| BYOK required | Yes | Optional | Optional |

---

## Environment Variables

These are set as CF Secrets (not in wrangler.jsonc):

```
HF_API_KEY              # HuggingFace API key (platform fallback for non-BYOK users)
COOKIE_SECRET           # 32-byte random string for session HMAC
POLAR_ACCESS_TOKEN      # Polar organization access token
POLAR_WEBHOOK_SECRET    # Polar webhook signing secret
```

User BYOK keys are stored encrypted in D1 (column `users.hf_api_key_encrypted`),
encrypted with a key derived from `COOKIE_SECRET`. Never stored in plaintext.

---

## Billing — Polar Integration

Polar acts as the Merchant of Record. CleanEbook never handles card data.
Polar uses Stripe Connect Express under the hood, enabling payouts to Indonesia
and 30+ other countries that Stripe Payments doesn't directly support.

### Key concepts

- **Product** — created once in the Polar dashboard per plan (Reader, Collector)
- **Checkout** — Polar-hosted checkout page, redirected to from `/api/billing/checkout`
- **Customer Portal** — Polar-hosted portal for subscription management, cancel, invoices
- **Webhook** — Polar POSTs events to `/api/webhook/polar` on subscription changes

### Billing flow

```
User clicks "Upgrade to Reader"
  → GET /api/billing/checkout?plan=reader
       → polar.checkouts.create({ productId, successUrl, customerEmail })
       → redirect to Polar-hosted checkout URL

User completes payment on Polar
  → Polar redirects to /billing/success?checkout_id=...
  → Polar POSTs webhook to /api/webhook/polar

/api/webhook/polar receives event
  → validateEvent(body, headers, POLAR_WEBHOOK_SECRET)  ← built into @polar-sh/sdk
  → on 'subscription.active': UPDATE users SET plan='reader' WHERE email=...
  → on 'subscription.revoked': UPDATE users SET plan='free' WHERE email=...
  → on 'subscription.updated': handle plan changes (upgrade/downgrade)
```

### src/lib/server/polar.ts

```typescript
import { Polar } from '@polar-sh/sdk';

export function getPolarClient(accessToken: string): Polar {
  return new Polar({
    accessToken,
    server: 'production', // change to 'sandbox' for testing
  });
}

export async function createCheckoutUrl(
  accessToken: string,
  opts: {
    productId: string;
    customerEmail: string;
    successUrl: string;
    metadata?: Record<string, string>;
  }
): Promise<string> {
  const polar = getPolarClient(accessToken);
  const checkout = await polar.checkouts.create({
    productId: opts.productId,
    customerEmail: opts.customerEmail,
    successUrl: opts.successUrl,
    metadata: opts.metadata,
  });
  return checkout.url;
}

export async function createCustomerPortalUrl(
  accessToken: string,
  customerId: string,
  returnUrl: string
): Promise<string> {
  const polar = getPolarClient(accessToken);
  const session = await polar.customerSessions.create({
    customerId,
  });
  return `https://polar.sh/purchases?customer_session_token=${session.token}&return_url=${encodeURIComponent(returnUrl)}`;
}
```

### Webhook handler — /api/webhook/polar/+server.ts

```typescript
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
  const body = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let event;
  try {
    event = validateEvent(body, headers, platform!.env.POLAR_WEBHOOK_SECRET);
  } catch (err) {
    if (err instanceof WebhookVerificationError) return error(403);
    throw err;
  }

  const db = platform!.env.DB;

  switch (event.type) {
    case 'subscription.active':
    case 'subscription.updated': {
      const plan = polarProductToPlan(event.data.productId);
      const customerId = event.data.customerId;
      await db
        .prepare("UPDATE users SET plan = ?, polar_customer_id = ? WHERE polar_customer_id = ? OR email = ?")
        .bind(plan, customerId, customerId, event.data.customer?.email ?? '')
        .run();
      break;
    }
    case 'subscription.revoked':
    case 'subscription.canceled': {
      await db
        .prepare("UPDATE users SET plan = 'free' WHERE polar_customer_id = ?")
        .bind(event.data.customerId)
        .run();
      break;
    }
  }

  return json({ received: true });
};

function polarProductToPlan(productId: string): 'free' | 'reader' | 'collector' {
  // Map Polar product IDs (from dashboard) to internal plan names
  // These IDs are set as CF Secrets: POLAR_READER_PRODUCT_ID, POLAR_COLLECTOR_PRODUCT_ID
  const map: Record<string, 'reader' | 'collector'> = {
    [process.env.POLAR_READER_PRODUCT_ID ?? '']: 'reader',
    [process.env.POLAR_COLLECTOR_PRODUCT_ID ?? '']: 'collector',
  };
  return map[productId] ?? 'free';
}
```

### D1 schema addition (add to 0001_initial.sql)

```sql
-- Add to users table:
ALTER TABLE users ADD COLUMN polar_customer_id TEXT;
CREATE INDEX idx_users_polar_customer_id ON users(polar_customer_id);
```

### Additional CF Secrets needed

```
POLAR_READER_PRODUCT_ID      # Product ID from Polar dashboard for Reader plan
POLAR_COLLECTOR_PRODUCT_ID   # Product ID from Polar dashboard for Collector plan
```
