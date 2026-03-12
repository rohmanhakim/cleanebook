# Basic Auth Gating for Development

**Date**: Wed Mar 12 10:52:00 AM WIB 2026

## Summary

Implemented HTTP Basic Authentication as a development gate to protect the CleanEbook frontend during the development phase. This prevents unauthorized access to the application while still allowing AI agents to access the API with credentials.

## Problem

During development, we want to:
1. Prevent anonymous visitors from accessing the landing page and potentially spamming storage
2. Allow AI agents to access the API for testing and development
3. Have an easy way to disable the gate when the application is ready for production

## Solution

Implemented conditional Basic Auth in `src/hooks.server.ts` that:
- Only activates when `BASIC_AUTH_USER` environment variable is set
- Returns 401 with `WWW-Authenticate` header for unauthenticated requests
- Validates credentials from the `Authorization` header
- Can be completely disabled by removing the secrets

## Files Created/Modified

| File | Change |
|------|--------|
| `src/hooks.server.ts` | Created with Basic Auth middleware |
| `src/app.d.ts` | Added `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` to env types |
| `.dev.vars` | Added Basic Auth credentials for local development |
| `README.md` | Documented the Basic Auth environment variables |
| `docs/AUTH.md` | Added Development Gating section |

## Implementation Details

### src/hooks.server.ts

```typescript
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const { platform } = event;

	// Basic Auth gating - only active if BASIC_AUTH_USER is configured
	if (platform?.env.BASIC_AUTH_USER) {
		const authHeader = event.request.headers.get('Authorization');
		
		if (!authHeader || !isValidBasicAuth(authHeader, platform.env)) {
			return new Response(null, {
				status: 401,
				headers: {
					'WWW-Authenticate': 'Basic realm="CleanEbook Development", charset="UTF-8"'
				}
			});
		}
	}

	event.locals.user = null;
	return resolve(event);
};

function isValidBasicAuth(
	authHeader: string,
	env: { BASIC_AUTH_USER: string; BASIC_AUTH_PASSWORD: string }
): boolean {
	if (!authHeader.startsWith('Basic ')) return false;

	try {
		const base64Credentials = authHeader.slice(6);
		const credentials = atob(base64Credentials);
		const [username, password] = credentials.split(':');
		return username === env.BASIC_AUTH_USER && password === env.BASIC_AUTH_PASSWORD;
	} catch {
		return false;
	}
}
```

### Key Design Decisions

1. **Conditional Activation**: The gate only activates if `BASIC_AUTH_USER` is set. This allows easy enable/disable by adding/removing the environment variable.

2. **Separate from User Auth**: Basic Auth is completely separate from the planned user authentication system. It's a development-only measure.

3. **All Routes Protected**: The gate applies to ALL routes including landing page, app routes, admin routes, and API routes.

4. **Browser-Friendly**: Using `WWW-Authenticate` header triggers the browser's built-in login dialog.

5. **AI Agent Compatible**: AI agents can include credentials in requests via the `Authorization` header.

## Configuration

### Local Development

Add to `.dev.vars`:
```
BASIC_AUTH_USER=admin
BASIC_AUTH_PASSWORD=your_password
```

### Production

Set via wrangler CLI:
```bash
source ~/.nvm/nvm.sh
wrangler pages secret put BASIC_AUTH_USER
wrangler pages secret put BASIC_AUTH_PASSWORD
```

### Disabling

When ready for public access:
```bash
source ~/.nvm/nvm.sh
wrangler pages secret delete BASIC_AUTH_USER
wrangler pages secret delete BASIC_AUTH_PASSWORD
```

## Testing

```bash
# Without credentials → 401 Unauthorized
curl -i http://localhost:5174/
# HTTP/1.1 401 Unauthorized
# www-authenticate: Basic realm="CleanEbook Development", charset="UTF-8"

# With valid credentials → 200 OK
curl -i -u admin:password http://localhost:5174/
# HTTP/1.1 200 OK
```

## Key Learnings

### 1. SvelteKit hooks.server.ts Runs on Every Request

The `handle` function in `hooks.server.ts` is called for every incoming request, making it the ideal place for authentication middleware.

### 2. Environment Variables in SvelteKit + Cloudflare

Environment variables are accessed via `event.platform.env` for Cloudflare-specific bindings and secrets. These must be typed in `app.d.ts`.

### 3. Basic Auth is Sufficient for Development Gating

Basic Auth, while not suitable for production user authentication, is perfect for development gating because:
- Browsers have built-in support (login dialog)
- Easy to configure via environment variables
- Easy to disable by removing secrets
- Works with curl and other CLI tools

### 4. atob() is Available in Cloudflare Workers

The `atob()` function for Base64 decoding is available natively in Cloudflare Workers runtime, no need for polyfills.

### 5. Cloudflare Pages Has Separate Environments for Secrets

Cloudflare Pages has **two separate environments**:
- **production** - For deployments from the master branch (via Git integration)
- **preview** - For deployments via direct upload (`wrangler pages deploy`)

**Secrets must be set for each environment separately!**

```bash
# For production environment (Git integration deployments)
wrangler pages secret put BASIC_AUTH_USER
wrangler pages secret put BASIC_AUTH_PASSWORD

# For preview environment (direct upload deployments)
wrangler pages secret put BASIC_AUTH_USER --env preview
wrangler pages secret put BASIC_AUTH_PASSWORD --env preview
```

This was the root cause of basic auth not working in production - secrets were only set for the `production` environment, but direct uploads via `wrangler pages deploy` create preview deployments that use `preview` environment secrets.

## Future Considerations

1. **Remove Basic Auth**: Once the application is ready for public launch, remove the Basic Auth secrets from production.

2. **Implement User Auth**: The `hooks.server.ts` has a TODO comment for adding session validation when user authentication is implemented.

3. **Rate Limiting**: Consider adding rate limiting on top of or instead of Basic Auth for production.