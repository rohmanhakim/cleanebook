/**
 * Layout server for (app) route group
 * Auth guard that allows anonymous users (no redirect to login)
 */
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  // Pass user to page - anonymous users are valid
  // No auth redirect needed for this route group
  return {
    user: locals.user,
  };
};
