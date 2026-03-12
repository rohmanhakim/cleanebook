# CleanEbook — Code Conventions

## TypeScript

- **Strict mode** on. No `any`. Use `unknown` and narrow.
- All function parameters and return types explicitly typed.
- Prefer `type` over `interface` for plain data shapes.
- Use `interface` only when you need declaration merging or `implements`.
- No `!` non-null assertions — narrow properly or handle null.

```typescript
// ✅ correct
const user = locals.user;
if (!user) return error(401);
console.log(user.email); // TypeScript knows user is non-null here

// ❌ wrong
console.log(locals.user!.email);
```

---

## Svelte 5

Use **Svelte 5 runes** syntax. Do not use Svelte 4 reactive syntax.

```svelte
<!-- ✅ Svelte 5 runes -->
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);

  function increment() {
    count++;
  }
</script>

<!-- ❌ Svelte 4 syntax — do not use -->
<script lang="ts">
  let count = 0;
  $: doubled = count * 2;
</script>
```

Use `$props()` for component props:
```svelte
<script lang="ts">
  const { jobId, onComplete }: { jobId: string; onComplete: () => void } = $props();
</script>
```

---

## SvelteKit Patterns

### Form actions (use sveltekit-superforms)

```typescript
// +page.server.ts
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/shared/schemas';

export const actions = {
  default: async ({ request, platform, cookies }) => {
    const form = await superValidate(request, zod(loginSchema));
    if (!form.valid) return fail(400, { form });
    // ... handle login
    return message(form, 'Success');
  }
};
```

### Server load functions — always return typed data

```typescript
// +page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, platform }) => {
  const job = await getJobById(platform!.env.DB, params.id);
  if (!job || job.userId !== locals.user!.id) error(404);
  return { job };
};
```

### Accessing CF bindings

Always via `platform.env`:
```typescript
// In +server.ts or +page.server.ts
export async function GET({ platform, locals }) {
  const db = platform!.env.DB;
  const r2 = platform!.env.R2;
  // ...
}
```

**Never** import `platform` directly in `$lib/server/*.ts` helpers.
Always pass bindings as function parameters. This makes helpers testable.

```typescript
// ✅ correct — binding passed as param
export async function getJob(db: D1Database, id: string) { ... }

// ❌ wrong — never import platform in lib
import { platform } from '...';
```

---

## Zod Schemas (src/lib/shared/schemas.ts)

All schemas use **Zod v3** API. Co-locate schemas with types.

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const createJobSchema = z.object({
  pdfKey: z.string().min(1),
  pdfFilename: z.string().min(1),
  pdfPageCount: z.number().int().positive(),
  templateId: z.string().optional(),
  ocrModel: z.string().optional(),
  layoutModel: z.string().optional(),
});

export const regionRuleSchema = z.object({
  id: z.string(),
  label: z.enum(['chrome', 'content', 'heading', 'figure', 'caption', 'code', 'footnote']),
  action: z.enum(['ignore', 'ocr', 'ocr-heading', 'crop-image', 'ocr-code', 'ocr-caption', 'ocr-footnote']),
  match: z.object({
    yRange: z.tuple([z.number(), z.number()]).optional(),
    xRange: z.tuple([z.number(), z.number()]).optional(),
    fontSizeRatio: z.tuple([z.number(), z.number()]).optional(),
    fontNames: z.array(z.string()).optional(),
    visualSimilarityThreshold: z.number().min(0).max(1).optional(),
  }),
  confidence: z.number().min(0).max(1),
});
```

---

## API Route Pattern

Every `+server.ts` follows this structure:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

const bodySchema = z.object({ ... });

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  // 1. Auth check
  if (!locals.user) return error(401, 'Unauthorized');

  // 2. Parse + validate body
  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    body = bodySchema.parse(raw);
  } catch {
    return error(400, 'Invalid request body');
  }

  // 3. Business logic
  const db = platform!.env.DB;
  // ...

  // 4. Return
  return json({ success: true });
};
```

---

## Error Handling

- Use `error(status, message)` from `@sveltejs/kit` in load functions and server routes
- Use `fail(status, data)` in form actions
- Never throw raw `Error` in server routes — it becomes a 500 without a useful message
- Log errors to console (Cloudflare captures these in Workers logs)

```typescript
// ✅ correct
if (!job) return error(404, 'Job not found');

// ❌ wrong
if (!job) throw new Error('Job not found');
```

---

## ID Generation

Use `crypto.randomUUID()` (available in all Workers/browsers) or a nanoid pattern.

```typescript
// Prefixed IDs for readability in logs/DB
export function generateId(prefix: 'usr' | 'job' | 'tpl' | 'ses'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}
// e.g. "job_a3f2c1b4d8e7f6a5"
```

---

## File Organization Rules

1. **One component per file.** No multiple exports from a single `.svelte` file.
2. **No barrel `index.ts` files** in `$lib/components/` — import directly.
3. **Co-locate** `+page.svelte` and `+page.server.ts` in the same directory.
4. **Shared types** go in `$lib/shared/types.ts`, not scattered in route files.
5. **Never import** from `$lib/server/` in `.svelte` files or `+page.ts` files.

---

## CSS / Styling

- Use **Tailwind utility classes** as primary styling.
- Component-specific styles use Svelte `<style>` blocks with `:global()` sparingly.
- CSS variables for theming are defined in `app.css` and used via shadcn conventions.
- Do not use inline `style=` attributes except for dynamic values (e.g., canvas dimensions).
- Dark mode via `mode-watcher` — use `dark:` Tailwind variants.

---

## Comments

- Comment the **why**, not the **what**.
- All exported functions in `$lib/server/` and `$lib/shared/` get JSDoc.
- Svelte components get a one-line comment at the top if their purpose isn't obvious from the filename.

```typescript
/**
 * Validates a session token and returns the associated user.
 * Returns null if the token is invalid or expired.
 * Automatically extends the session if past the halfway point.
 */
export async function validateSessionToken(...) { ... }
```
