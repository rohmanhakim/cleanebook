import type { Handle } from '@sveltejs/kit';

/**
 * SvelteKit server hook that handles:
 * 1. Conditional Basic Auth gating (development phase protection)
 * 2. Session validation (future - will be added when user auth is implemented)
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Basic Auth gating - only active if BASIC_AUTH_USER is configured
	// Remove BASIC_AUTH_USER and BASIC_AUTH_PASSWORD secrets to disable
	const platform = event.platform;
	const basicAuthUser = platform?.env?.BASIC_AUTH_USER;
	
	if (basicAuthUser) {
		const authHeader = event.request.headers.get('Authorization');
		
		if (!authHeader || !isValidBasicAuth(authHeader, platform!.env)) {
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
	env: { BASIC_AUTH_USER: string; BASIC_AUTH_PASSWORD: string }
): boolean {
	if (!authHeader.startsWith('Basic ')) {
		return false;
	}

	try {
		const base64Credentials = authHeader.slice(6);
		const credentials = atob(base64Credentials);
		const [username, password] = credentials.split(':');

		return (
			username === env.BASIC_AUTH_USER &&
			password === env.BASIC_AUTH_PASSWORD
		);
	} catch {
		return false;
	}
}