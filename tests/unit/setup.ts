/**
 * Test setup file for unit tests
 * Provides mocks for SvelteKit modules
 *
 * Note: $app/navigation is mocked via alias in vitest.config.ts
 * pointing to tests/unit/__mocks__/$app/navigation.ts
 */
import { vi } from 'vitest';

// Mock $app/stores
vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn(),
  },
  navigating: {
    subscribe: vi.fn(),
  },
  updated: {
    subscribe: vi.fn(),
  },
}));

// Mock $app/environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: true,
  building: false,
  version: 'test',
}));
