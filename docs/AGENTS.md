# CleanEbook — AI Agents Master Context

This is the root context file. Read this first, then read the referenced documents
for the area you are working on. Every document in this folder is authoritative.

---

## What is CleanEbook?

CleanEbook is a SaaS web application that converts PDF files into clean, well-structured
EPUB files optimized for eReaders (Kindle, Kobo, Onyx Boox, etc.).

The core problem it solves: Publisher PDFs converted with generic tools (Calibre, online
converters) produce garbled output because they cannot distinguish body content from
page chrome (headers, footers, page numbers), figures, captions, and code blocks.

CleanEbook solves this with a two-layer approach:
1. User defines semantic region rules on a sample page (chrome, content, heading, figure, etc.)
2. A heuristic + AI pipeline applies those rules to every page automatically, flagging
   low-confidence pages for user review instead of silently failing.

---

## Document Index

| File | What it covers |
|---|---|
| `docs/AGENTS.md` | This file — master context and index |
| `docs/ARCHITECTURE.md` | Full system architecture, CF stack, data flow |
| `docs/STACK.md` | All dependencies with exact verified versions |
| `docs/PROJECT_STRUCTURE.md` | Directory layout, file naming conventions |
| `docs/DATABASE.md` | D1 schema, all tables, indexes, queries |
| `docs/PIPELINE.md` | OCR pipeline, heuristic matching, CF Workflow steps |
| `docs/UI.md` | Route structure, page descriptions, component map |
| `docs/AUTH.md` | Session-based auth with oslojs + arctic, no lucia |
| `docs/API.md` | All server route endpoints, request/response shapes |
| `docs/ADMIN.md` | Admin dashboard routes and data requirements |
| `docs/CONVENTIONS.md` | Code style, naming, patterns to follow consistently |
| `docs/learnings/` | Learning documents, you may run `tree docs/learnings` to explore these when you want to troubleshoot a problem |

---

## Core Principles for AI Agents

1. **Never guess dependency versions** — all versions are pinned in `STACK.md`. Use exactly those.
2. **No lucia** — it is deprecated. Auth uses `@oslojs/crypto` + `@oslojs/encoding` + `arctic`. See `AUTH.md`.
3. **No Node.js server** — everything runs on Cloudflare Workers/Pages. No Express, no Fastify.
4. **PDF rendering is always client-side** — never import `pdfjs-dist` in a server route or Worker.
5. **One SvelteKit project** — marketing, app, and admin are all route groups in one project.
6. **TypeScript everywhere** — no plain `.js` files except config files that require it.
7. **Zod v3 only** — do not use Zod v4 API. See `STACK.md`.
8. **shadcn-svelte components** — use existing shadcn components before writing custom UI.
9. **Polar for billing** — no Stripe. Use `@polar-sh/sdk` for API calls and `@polar-sh/checkout` for embeddable checkout. Do NOT install `@polar-sh/nextjs` or `@polar-sh/astro`. See `ARCHITECTURE.md` Billing section.

---

## Quick Mental Model

```
Browser                          Cloudflare (server)              External APIs
──────────────────               ────────────────────             ────────────
Svelte 5 UI                 ←→  SvelteKit +server.js        ←→  HuggingFace
PDF.js (page render)             CF Workers (API routes)          Inference API
Konva.js (region editor)         CF Workflows (OCR pipeline)  ←→  Polar (billing
@tanstack/svelte-query           CF D1 (SQLite database)           MoR, checkout,
svelte-sonner (toasts)           CF R2 (file storage)              webhooks)
                                 CF Queues (job queue)
                                 CF KV (sessions, cache)
```

---

## Naming Conventions

- Product name: **CleanEbook** (one word, capital C, capital E)
- Domain: `cleanebook.app` (placeholder)
- CLI/config references: `cleanebook`
- DB prefix: none (tables are unprefixed)
- Environment variables: `CLEANEBOOK_` prefix for custom vars, CF bindings use their binding name directly

## Common Tasks

- use `source ~/.nvm/nvm.sh` prefix before running any `pnpm` or `wrangler` commands.
- use project-specific wrangler CLI : `source ~/.nvm/nvm.sh && npx wrangler`