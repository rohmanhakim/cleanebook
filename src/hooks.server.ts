/**
 * SvelteKit server hook that handles:
 * 1. Conditional Basic Auth gating (development phase protection)
 * 2. Session validation for all requests
 * 3. Lazy anonymous user creation on specific routes
 */
import type { Handle } from '@sveltejs/kit';
import {
  validateSessionToken,
  getSessionTokenFromCookies,
  generateSessionToken,
  createSession,
  setSessionCookie,
} from '$lib/server/auth';
import { createAnonymousUser } from '$lib/server/db';

// Routes where we should auto-create an anonymous session
// (avoids creating throwaway anon users for every bot/crawler hit)
const ANON_SESSION_ROUTES = ['/editor', '/api/upload', '/api/job'];

export const handle: Handle = async ({ event, resolve }) => {
  // Basic Auth gating - only active if BASIC_AUTH_USER is configured
  // Remove BASIC_AUTH_USER and BASIC_AUTH_PASSWORD secrets to disable
  // Check both CF bindings (production) and process.env (dev/CI)
  const platform = event.platform;
  const basicAuthUser = platform?.env?.BASIC_AUTH_USER ?? process.env.BASIC_AUTH_USER;
  const basicAuthPassword = platform?.env?.BASIC_AUTH_PASSWORD ?? process.env.BASIC_AUTH_PASSWORD;

  if (basicAuthUser && basicAuthPassword) {
    const authHeader = event.request.headers.get('Authorization');

    if (!authHeader || !isValidBasicAuth(authHeader, basicAuthUser, basicAuthPassword)) {
      // Return 401 with WWW-Authenticate header to trigger browser login
      return new Response(null, {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="CleanEbook Development", charset="UTF-8"',
        },
      });
    }
  }

  // Session validation - check for existing session cookie
  const token = getSessionTokenFromCookies(event.request.headers.get('cookie'));

  if (token && platform?.env?.DB) {
    const result = await validateSessionToken(platform.env.DB, token);
    event.locals.user = result?.user ?? null;
  } else {
    event.locals.user = null;
  }

  // Track if we need to set a session cookie on the response
  let newSessionToken: string | null = null;

  // Lazy anonymous user creation - BEFORE resolve
  // This ensures locals.user is populated when route handlers run
  // Only create on routes that represent real interactions (avoids flooding D1 with bot traffic)
  if (!event.locals.user && platform?.env?.DB) {
    const path = event.url.pathname;
    const shouldCreateAnon = ANON_SESSION_ROUTES.some((r) => path.startsWith(r));

    if (shouldCreateAnon) {
      try {
        // Create anonymous user and session
        const anonUser = await createAnonymousUser(platform.env.DB);
        newSessionToken = generateSessionToken();
        await createSession(platform.env.DB, anonUser.id, newSessionToken);

        // Set user in locals for this request - BEFORE resolve
        event.locals.user = anonUser;
      } catch (error) {
        // Log but don't fail the request - user will remain null
        console.error('Failed to create anonymous user:', error);
      }
    }
  }

  // Now resolve the response with locals.user properly populated
  const response = await resolve(event);

  // Set cookie on the response if we created a new session
  if (newSessionToken) {
    response.headers.append('Set-Cookie', setSessionCookie(newSessionToken));
  }

  return response;
};

/**
 * Validates Basic Auth credentials from the Authorization header
 */
function isValidBasicAuth(
  authHeader: string,
  expectedUser: string,
  expectedPassword: string
): boolean {
  if (!authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    return username === expectedUser && password === expectedPassword;
  } catch {
    return false;
  }
}
