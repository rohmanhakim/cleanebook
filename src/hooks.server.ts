import type { Handle } from '@sveltejs/kit';

/**
 * SvelteKit server hook that handles:
 * 1. Conditional Basic Auth gating (development phase protection)
 * 2. Session validation (future - will be added when user auth is implemented)
 */
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
					'WWW-Authenticate': 'Basic realm="CleanEbook Development", charset="UTF-8"'
				}
			});
		}
	}

	// Initialize locals.user as null (will be set by session validation later)
	event.locals.user = null;

	// TODO: Add session validation here when user auth is implemented
	// const token = getSessionTokenFromCookies(event.request.headers.get('cookie'));
	// if (token) {
	//   const result = await validateSessionToken(platform.env.DB, token);
	//   if (result) event.locals.user = result.user;
	// }

	return resolve(event);
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

		return (
			username === expectedUser &&
			password === expectedPassword
		);
	} catch {
		return false;
	}
}
