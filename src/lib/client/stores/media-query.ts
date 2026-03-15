/**
 * Media Query Store
 *
 * A reactive media query utility for responsive design.
 * Uses Svelte's writable store for reactivity.
 */

import { writable, type Readable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Create a reactive media query matcher
 *
 * @param query - CSS media query string (e.g., '(min-width: 768px)')
 * @returns A Svelte store that contains a boolean indicating if the query matches
 *
 * @example
 * ```svelte
 * <script>
 *   import { createMediaQuery } from '$lib/client/stores/media-query';
 *
 *   const isDesktop = createMediaQuery('(min-width: 768px)');
 * </script>
 *
 * {#if $isDesktop}
 *   <p>Desktop view</p>
 * {:else}
 *   <p>Mobile view</p>
 * {/if}
 * ```
 */
export function createMediaQuery(query: string): Readable<boolean> {
  const { subscribe, set } = writable(false);

  if (browser) {
    const mql = window.matchMedia(query);
    set(mql.matches);

    mql.addEventListener('change', (e) => {
      set(e.matches);
    });
  }

  return { subscribe };
}
