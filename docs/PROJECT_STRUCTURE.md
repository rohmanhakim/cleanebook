# CleanEbook — Project Structure

## Root Layout

```
cleanebook/
├── src/
│   ├── app.d.ts                    # CF bindings + App.Locals types
│   ├── app.html                    # HTML shell
│   ├── hooks.server.ts             # Session validation on every request
│   │
│   ├── lib/
│   │   ├── server/                 # Server-only code (never in browser bundle)
│   │   │   ├── auth.ts             # Session create/validate/destroy
│   │   │   ├── db.ts               # D1 query helpers
│   │   │   ├── r2.ts               # R2 upload/download helpers
│   │   │   ├── queue.ts            # Queue message helpers
│   │   │   ├── hf.ts               # HuggingFace Inference API client
│   │   │   ├── polar.ts            # Polar billing client + helpers
│   │   │   └── epub/
│   │   │       ├── assembler.ts    # EPUB3 assembly from OCR results
│   │   │       └── zipper.ts       # fflate-based EPUB zip builder
│   │   │
│   │   ├── shared/                 # Safe to import anywhere (no CF bindings)
│   │   │   ├── schemas.ts          # All Zod schemas (job, region, template, user)
│   │   │   ├── types.ts            # Shared TypeScript types/interfaces
│   │   │   ├── constants.ts        # Plan limits, model names, confidence thresholds
│   │   │   └── utils.ts            # Pure utility functions
│   │   │
│   │   ├── client/                 # Browser-only code
│   │   │   ├── pdf/
│   │   │   │   ├── renderer.ts     # PDF.js page → canvas rendering
│   │   │   │   └── extractor.ts    # Crop image blobs from canvas regions
│   │   │   ├── editor/
│   │   │   │   ├── stage.ts        # Konva.js stage management
│   │   │   │   ├── regions.ts      # Region draw/edit/label logic
│   │   │   │   └── matcher.ts      # Client-side preview of heuristic matching
│   │   │   └── stores/
│   │   │       ├── job.ts          # Active job state store
│   │   │       ├── editor.ts       # Editor UI state store
│   │   │       └── upload.ts       # Upload progress store
│   │   │
│   │   └── components/
│   │       ├── ui/                 # shadcn-svelte components (auto-generated, do not edit)
│   │       ├── marketing/          # Landing page sections
│   │       │   ├── Hero.svelte
│   │       │   ├── HowItWorks.svelte
│   │       │   ├── Features.svelte
│   │       │   └── Pricing.svelte
│   │       ├── app/                # App-specific components
│   │       │   ├── PDFViewer.svelte        # Renders PDF pages via PDF.js
│   │       │   ├── RegionEditor.svelte     # Konva canvas region drawing
│   │       │   ├── RegionLabel.svelte      # Label picker (chrome/content/etc)
│   │       │   ├── TemplateRules.svelte    # View/edit saved template rules
│   │       │   ├── JobStatusBar.svelte     # Pipeline progress display
│   │       │   ├── ExceptionQueue.svelte   # Pages needing review
│   │       │   ├── EpubPreview.svelte      # Live structured text preview
│   │       │   └── ConfidenceChip.svelte   # Shows match confidence per page
│   │       └── admin/
│   │           ├── UsersTable.svelte
│   │           ├── JobsTable.svelte
│   │           └── RevenueChart.svelte
│   │
│   └── routes/
│       ├── (marketing)/
│       │   ├── +layout.svelte          # Marketing nav + footer
│       │   ├── +layout.ts              # export const prerender = true
│       │   ├── +page.svelte            # / — landing page
│       │   ├── pricing/+page.svelte    # /pricing
│       │   ├── about/+page.svelte      # /about
│       │   └── contact/+page.svelte    # /contact
│       │
│       ├── (auth)/
│       │   ├── +layout.svelte          # Minimal auth layout (no app shell)
│       │   ├── login/
│       │   │   ├── +page.svelte        # /login — email+password form
│       │   │   └── +page.server.ts     # Form action → validate → set session
│       │   ├── register/
│       │   │   ├── +page.svelte        # /register
│       │   │   └── +page.server.ts     # Create user → set session
│       │   └── logout/
│       │       └── +server.ts          # POST /logout → clear session
│       │
│       ├── (app)/
│       │   ├── +layout.svelte          # App shell: sidebar + topbar
│       │   ├── +layout.server.ts       # Auth guard → redirect if not logged in
│       │   ├── dashboard/
│       │   │   ├── +page.svelte        # /dashboard — job list, usage stats
│       │   │   └── +page.server.ts     # Load jobs from D1
│       │   ├── upload/
│       │   │   └── +page.svelte        # /upload — drag-drop PDF upload entry point
│       │   ├── editor/
│       │   │   └── [jobId]/
│       │   │       ├── +page.svelte    # /editor/:jobId — region editor + pipeline
│       │   │       └── +page.server.ts # Load job + template from D1
│       │   ├── templates/
│       │   │   ├── +page.svelte        # /templates — saved templates list
│       │   │   └── [templateId]/
│       │   │       ├── +page.svelte    # /templates/:id — edit template rules
│       │   │       └── +page.server.ts
│       │   └── settings/
│       │       ├── +page.svelte        # /settings — BYOK key, profile, plan
│       │       └── +page.server.ts
│       │   └── billing/
│       │       └── success/
│       │           └── +page.svelte    # /billing/success — post-checkout confirmation
│       │
│       ├── (admin)/
│       │   ├── +layout.svelte          # Admin shell (different from app shell)
│       │   ├── +layout.server.ts       # Auth guard → role must be 'admin'
│       │   ├── admin/
│       │   │   ├── +page.svelte        # /admin — overview stats
│       │   │   ├── users/+page.svelte  # /admin/users
│       │   │   ├── jobs/+page.svelte   # /admin/jobs
│       │   │   ├── models/+page.svelte # /admin/models — HF model config
│       │   │   └── settings/+page.svelte
│       │
│       └── api/
│           ├── upload/
│           │   └── +server.ts          # POST — stream PDF to R2
│           ├── job/
│           │   ├── create/
│           │   │   └── +server.ts      # POST — create job, push to queue
│           │   └── [id]/
│           │       ├── +server.ts      # GET — job status; DELETE — cancel job
│           │       ├── confirm/
│           │       │   └── +server.ts  # POST — confirm review pages, resume workflow
│           │       └── epub/
│           │           └── +server.ts  # GET — R2 presigned download URL
│           ├── template/
│           │   ├── +server.ts          # POST — create template
│           │   └── [id]/
│           │       └── +server.ts      # GET/PUT/DELETE template
│           ├── billing/
│           │   ├── checkout/
│           │   │   └── +server.ts      # GET — redirect to Polar checkout
│           │   └── portal/
│           │       └── +server.ts      # GET — redirect to Polar customer portal
│           └── webhook/
│               ├── polar/
│               │   └── +server.ts      # POST — Polar billing events
│               └── workflow/
│                   └── +server.ts      # POST — workflow completion callback
│
├── workers/
│   ├── ocr-pipeline.ts             # CF Workflow class (OcrPipeline)
│   └── cleanup.ts                  # CF Cron handler — purge anonymous users + R2
│
├── migrations/
│   ├── 0001_initial.sql            # D1 initial schema
│   └── 0002_templates.sql          # Templates table
│
├── static/
│   ├── favicon.ico
│   └── og-image.png
│
├── tests/
│   ├── unit/                       # Vitest unit tests
│   │   └── example.test.ts
│   ├── integration/                # Integration tests (future)
│   ├── e2e/                        # Playwright E2E tests
│   │   └── landing.spec.ts
│   └── helpers/                    # Test utilities (future)
│       ├── mockPlatform.ts
│       └── testData.ts
│
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions CI/CD pipeline
│
├── .husky/
│   └── pre-commit                  # Git pre-commit hook (format + lint)
│
├── wrangler.jsonc                  # CF config (see ARCHITECTURE.md)
├── svelte.config.js
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts                # Vitest configuration
├── playwright.config.ts            # Playwright configuration
├── postcss.config.js               # PostCSS with Tailwind CSS v4
├── eslint.config.js                # ESLint flat config (TypeScript + Svelte)
├── .prettierrc                     # Prettier config (2-space indent)
├── .editorconfig                   # Editor indentation settings
└── package.json
```

---

## Key Conventions

### Server vs Client imports
- `$lib/server/*` — ONLY importable in `+server.ts`, `+page.server.ts`, `hooks.server.ts`
- `$lib/client/*` — ONLY importable in `+page.svelte`, Svelte components
- `$lib/shared/*` — importable anywhere

SvelteKit enforces the `$lib/server` boundary at build time. Any attempt to import
server code in a client component will throw a build error.

### Route files
- `+page.svelte` — UI component, runs in browser after hydration
- `+page.server.ts` — `load()` and `actions` functions, runs server-side only
- `+layout.server.ts` — auth guards, shared server data for layout
- `+server.ts` — API endpoint, no UI, returns `json()` or `Response`

### Naming
- Components: PascalCase (`RegionEditor.svelte`)
- Stores: camelCase (`job.ts` exports `jobStore`)
- Server helpers: camelCase (`db.ts` exports `getJob`, `createJob`)
- DB columns: snake_case
- TypeScript interfaces: PascalCase (`type Job`, `type RegionRule`)
- Zod schemas: camelCase with `Schema` suffix (`jobSchema`, `regionRuleSchema`)
