import { describe, it, expect } from 'vitest';

/**
 * Sample unit test to verify the test infrastructure works.
 * This will be replaced with actual tests in future tasks.
 */
describe('Example unit tests', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with string assertions', () => {
    const appName = 'CleanEbook';
    expect(appName).toBe('CleanEbook');
    expect(appName).toContain('Clean');
  });

  it('should work with object assertions', () => {
    const user = {
      id: 'usr_123',
      email: 'test@example.com',
      plan: 'free' as const,
    };

    expect(user).toHaveProperty('id');
    expect(user.email).toBe('test@example.com');
    expect(user.plan).toBe('free');
  });
});
