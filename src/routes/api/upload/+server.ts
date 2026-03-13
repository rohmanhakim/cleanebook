/**
 * PDF Upload API Route
 * Thin wrapper that delegates to the upload handler in $lib/server
 */
import type { RequestHandler } from './$types';
import { handleUpload } from '$lib/server/upload';

export const POST: RequestHandler = handleUpload;
