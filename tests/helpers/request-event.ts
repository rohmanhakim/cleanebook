/**
 * Test helper for creating SvelteKit RequestEvent objects
 * Used for direct route handler testing without HTTP stack
 */
import type { D1Database, R2Bucket, KVNamespace, Queue } from '@cloudflare/workers-types';
import type { RequestHandler, ServerLoadEvent } from '@sveltejs/kit';

/**
 * User object type matching App.Locals['user']
 */
export type TestUser = {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  plan: 'anonymous' | 'free' | 'reader' | 'collector';
  isAnonymous: boolean;
  hfApiKeyEncrypted: string | null;
  polarCustomerId: string | null;
  conversionsThisMonth: number;
  conversionsTotal: number;
  conversionsResetAt: string;
  createdAt: string;
};

/**
 * Platform environment for tests
 */
export interface TestPlatformEnv {
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;
  QUEUE: Queue;
  [key: string]: unknown;
}

/**
 * Simplified RequestEvent for testing route handlers
 * Contains the essential properties needed for handler testing
 */
export interface TestRequestEvent {
  request: Request;
  locals: { user: TestUser | null };
  params: Record<string, string>;
  platform: {
    env: TestPlatformEnv;
    context: ExecutionContext;
    caches: CacheStorage & { default: Cache };
  };
  url: URL;
  cookies: {
    get: (name: string) => string | undefined;
    set: (name: string, value: string, options?: Record<string, unknown>) => void;
    delete: (name: string, options?: Record<string, unknown>) => void;
    getAll: () => Array<{ name: string; value: string }>;
    serialize: (name: string, value: string, options?: Record<string, unknown>) => string;
  };
  setHeaders: (headers: Record<string, string>) => void;
  getClientAddress: () => string;
  // SvelteKit RequestEvent compatibility
  route: { id: string | null };
  isDataRequest: boolean;
  isSubRequest: boolean;
  isRemoteRequest: boolean;
  fetch: typeof fetch;
  tracing?: {
    traceId: string;
    spanId: string;
  };
  // ServerLoadEvent methods
  parent?: () => Promise<Record<string, unknown>>;
  depends?: (...deps: string[]) => void;
  untrack?: <T>(fn: () => T) => T;
}

/**
 * Options for creating a test RequestEvent
 */
export interface CreateRequestEventOptions {
  request: Request;
  locals?: { user: TestUser | null };
  params?: Record<string, string>;
  platform?: {
    env: TestPlatformEnv;
    context?: ExecutionContext;
    caches?: CacheStorage & { default: Cache };
  };
  cookies?: Map<string, string>;
  url?: URL;
}

/**
 * Creates a minimal RequestEvent-like object for testing route handlers directly
 *
 * @example
 * ```ts
 * const request = new Request('http://localhost/api/upload', {
 *   method: 'POST',
 *   body: formData
 * });
 *
 * const event = createRequestEvent({
 *   request,
 *   locals: { user: testUser },
 *   platform: { env: { DB, R2, KV, QUEUE } }
 * });
 *
 * const response = await POST(event);
 * ```
 */
export function createRequestEvent(options: CreateRequestEventOptions): TestRequestEvent {
  const {
    request,
    locals = { user: null },
    params = {},
    platform,
    cookies = new Map(),
    url = new URL(request.url),
  } = options;

  // Default execution context (simplified)
  const defaultContext = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  // Default caches with mock default cache
  const defaultCaches = {
    ...caches,
    default: {} as Cache,
  } as CacheStorage & { default: Cache };

  // Merge provided platform with defaults
  const mergedPlatform: TestRequestEvent['platform'] = platform
    ? {
        env: platform.env,
        context: platform.context ?? defaultContext,
        caches: platform.caches ?? defaultCaches,
      }
    : {
        env: {} as TestPlatformEnv,
        context: defaultContext,
        caches: defaultCaches,
      };

  // Create cookies interface
  const cookiesInterface: TestRequestEvent['cookies'] = {
    get: (name: string) => cookies.get(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      void options; // Options not needed for tests
      cookies.set(name, value);
    },
    delete: (name: string, options?: Record<string, unknown>) => {
      void options; // Options not needed for tests
      cookies.delete(name);
    },
    getAll: () => Array.from(cookies.entries()).map(([name, value]) => ({ name, value })),
    serialize: (name: string, value: string, options?: Record<string, unknown>) => {
      void options; // Options not needed for tests
      return `${name}=${value}`;
    },
  };

  return {
    request,
    locals,
    params,
    platform: mergedPlatform,
    cookies: cookiesInterface,
    url,
    setHeaders: (headers: Record<string, string>) => {
      void headers; // No-op for tests
    },
    getClientAddress: () => '127.0.0.1',
    route: { id: null },
    isDataRequest: false,
    isSubRequest: false,
    isRemoteRequest: false,
    fetch: globalThis.fetch.bind(globalThis),
    // ServerLoadEvent methods for page server load functions
    parent: async () => ({}),
    depends: (...deps: string[]) => {
      void deps; // No-op for tests
    },
    untrack: <T>(fn: () => T) => fn(),
  };
}

/**
 * Casts a TestRequestEvent to a RequestHandler's parameter type.
 *
 * This centralizes the type assertion needed because:
 * 1. SvelteKit's RequestEvent is parameterized with route-specific types
 * 2. Our TestRequestEvent has the runtime shape but not the compile-time route types
 * 3. The double cast through `unknown` is required because the types don't overlap
 *
 * @example
 * ```ts
 * const event = createRequestEvent({ ... });
 * const response = await handleUpload(toHandlerEvent(event));
 * ```
 */
export function toHandlerEvent<T extends RequestHandler>(
  event: TestRequestEvent
): Parameters<T>[0] {
  return event as unknown as Parameters<T>[0];
}

/**
 * Casts a TestRequestEvent to a ServerLoadEvent's parameter type.
 *
 * Used for testing page server load functions which require a ServerLoadEvent
 * (which has additional methods like parent, depends, untrack).
 *
 * @example
 * ```ts
 * const event = createRequestEvent({ ... });
 * const result = await load(toServerLoadEvent(event));
 * ```
 */
export function toServerLoadEvent<T extends ServerLoadEvent>(event: TestRequestEvent): T {
  return event as unknown as T;
}

/**
 * Creates a mock user for testing
 */
export function createMockUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: 'anon_test123456789012345',
    email: '',
    name: 'Anonymous',
    role: 'user',
    plan: 'anonymous',
    isAnonymous: true,
    hfApiKeyEncrypted: null,
    polarCustomerId: null,
    conversionsThisMonth: 0,
    conversionsTotal: 0,
    conversionsResetAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
