# CleanEbook — Admin Dashboard

## Access

URL prefix: `/admin`  
Guard: `locals.user.role === 'admin'` — checked in `(admin)/+layout.server.ts`  
Layout: Separate from app layout. Simpler shell — no Konva, no PDF.js.

Promote a user to admin via D1 directly (no UI for MVP):
```bash
wrangler d1 execute cleanebook-db --command "UPDATE users SET role='admin' WHERE email='you@example.com'"
```

---

## Routes & Data

### /admin — Overview

Key metrics displayed:
```typescript
{
  totalUsers: number;
  newUsersToday: number;
  newUsersThisMonth: number;
  activeJobs: number;           // status IN ('queued','processing','needs_review')
  jobsCompletedToday: number;
  jobsFailedToday: number;
  queueDepth: number;           // from CF Queue API (if available) or D1 count
  planBreakdown: {
    free: number;
    reader: number;
    collector: number;
  };
}
```

D1 queries:
```sql
SELECT COUNT(*) as total FROM users;
SELECT COUNT(*) as today FROM users WHERE created_at >= date('now');
SELECT COUNT(*) as active FROM jobs WHERE status IN ('queued','processing','needs_review');
SELECT status, COUNT(*) as count FROM jobs WHERE date(created_at) = date('now') GROUP BY status;
SELECT plan, COUNT(*) as count FROM users GROUP BY plan;
```

---

### /admin/users — User Management

Table columns:
- ID (truncated)
- Email
- Name
- Plan badge (free/reader/collector)
- Role badge (user/admin)
- Conversions this month / limit
- Joined date
- Actions: [Change plan ▾] [Suspend]

Server load:
```typescript
// Paginated, 50 per page
const users = await db
  .prepare(`
    SELECT id, email, name, role, plan, conversions_this_month, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 50 OFFSET ?
  `)
  .bind(offset)
  .all();
```

Actions:
- `PATCH /api/admin/users/:id` — change plan or role
- `DELETE /api/admin/users/:id` — soft delete (set a `deleted_at` column)

---

### /admin/jobs — Job Monitor

Table columns:
- Job ID
- User email
- PDF filename
- Status badge (with color)
- Page count
- OCR model used
- Created at
- Duration (complete - created)
- Actions: [Retry] (for failed), [View logs]

Filters: status, date range, user email search

Actions:
- `POST /api/admin/jobs/:id/retry` — re-enqueue a failed job

---

### /admin/models — HF Model Config

This page manages which HuggingFace models are available to users.

Stored in KV (`env.KV`) under key `"available_models"`:
```typescript
interface ModelConfig {
  ocr: Array<{
    id: string;           // e.g. "lightonai/LightOnOCR-2-1B"
    label: string;        // display name
    description: string;
    enabled: boolean;
    isDefault: boolean;
  }>;
  layout: Array<{
    id: string;
    label: string;
    description: string;
    enabled: boolean;
    isDefault: boolean;
  }>;
}
```

Default config (seed to KV on first deploy):
```json
{
  "ocr": [
    {
      "id": "lightonai/LightOnOCR-2-1B",
      "label": "LightOnOCR (Fast)",
      "description": "Best for most books. Fast and accurate.",
      "enabled": true,
      "isDefault": true
    },
    {
      "id": "facebook/nougat-large",
      "label": "Nougat (Academic)",
      "description": "Optimized for academic PDFs with math and LaTeX.",
      "enabled": true,
      "isDefault": false
    },
    {
      "id": "microsoft/trocr-large-printed",
      "label": "TrOCR (Printed)",
      "description": "High accuracy for clean printed text.",
      "enabled": true,
      "isDefault": false
    }
  ],
  "layout": [
    {
      "id": "microsoft/layoutlmv3-base",
      "label": "LayoutLMv3",
      "description": "General layout analysis.",
      "enabled": true,
      "isDefault": true
    },
    {
      "id": "ds4sd/docling",
      "label": "Docling",
      "description": "Complex multi-column documents.",
      "enabled": false,
      "isDefault": false
    }
  ]
}
```

---

### /admin/settings — Global Settings

Stored in KV under `"global_settings"`:
```typescript
interface GlobalSettings {
  maintenanceMode: boolean;       // shows maintenance banner
  newSignupsEnabled: boolean;     // disable registration
  freeConversionsPerMonth: number; // override plan limit
  readerConversionsPerMonth: number;
  maxPagesFreeTier: number;
  maxPagesReaderTier: number;
  defaultHfApiKey: string;        // masked display only, stored in CF Secrets
}
```

---

## Admin-Only API Routes

All require `locals.user.role === 'admin'`.

```
GET  /api/admin/stats
GET  /api/admin/users?page=&search=
PATCH /api/admin/users/:id       { plan?, role? }
GET  /api/admin/jobs?status=&page=&userId=
POST /api/admin/jobs/:id/retry
GET  /api/admin/models           reads KV
PUT  /api/admin/models           writes KV
GET  /api/admin/settings         reads KV
PUT  /api/admin/settings         writes KV
```
