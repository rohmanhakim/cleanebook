import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('Cloudflare bindings', () => {
  it('should have access to D1 database binding', () => {
    expect(env.DB).toBeDefined();
    expect(env.DB).toBeTruthy();
  });

  it('should have access to R2 bucket binding', () => {
    expect(env.R2).toBeDefined();
    expect(env.R2).toBeTruthy();
  });

  it('should have access to KV namespace binding', () => {
    expect(env.KV).toBeDefined();
    expect(env.KV).toBeTruthy();
  });
});
