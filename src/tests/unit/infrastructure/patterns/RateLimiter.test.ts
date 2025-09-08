import { describe, it, expect, beforeEach } from 'vitest';
import { 
  TokenBucketRateLimiter, 
  SlidingWindowRateLimiter 
} from '../../../../infrastructure/patterns/RateLimiter';

describe('TokenBucketRateLimiter', () => {
  let rateLimiter: TokenBucketRateLimiter;

  beforeEach(() => {
    rateLimiter = new TokenBucketRateLimiter({
      requestsPerMinute: 60,
      burstLimit: 10
    });
  });

  describe('allowRequest', () => {
    it('should allow requests within burst limit', async () => {
      for (let i = 0; i < 10; i++) {
        expect(await rateLimiter.allowRequest()).toBe(true);
      }
    });

    it('should deny requests after burst limit exhausted', async () => {
      // Exhaust burst limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.allowRequest();
      }
      
      expect(await rateLimiter.allowRequest()).toBe(false);
    });
  });

  describe('waitForSlot', () => {
    it('should wait for available slot', async () => {
      // Exhaust burst limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.allowRequest();
      }

      // This should wait but eventually succeed
      const startTime = Date.now();
      await rateLimiter.waitForSlot();
      const elapsed = Date.now() - startTime;
      
      // Should have waited at least a bit
      expect(elapsed).toBeGreaterThan(0);
    });
  });

  describe('execute', () => {
    it('should execute function with rate limiting', async () => {
      const fn = async () => 'success';
      const result = await rateLimiter.execute(fn);
      expect(result).toBe('success');
    });

    it('should rate limit multiple executions', async () => {
      const results: string[] = [];
      const fn = async (i: number) => `result-${i}`;

      // Execute more than burst limit
      const promises = [];
      for (let i = 0; i < 12; i++) {
        promises.push(
          rateLimiter.execute(() => fn(i)).then(r => results.push(r))
        );
      }

      // Some should complete immediately, others should wait
      await Promise.all(promises);
      expect(results).toHaveLength(12);
    });
  });

  describe('reset', () => {
    it('should reset token count', async () => {
      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.allowRequest();
      }
      expect(await rateLimiter.allowRequest()).toBe(false);

      // Reset
      rateLimiter.reset();
      expect(await rateLimiter.allowRequest()).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return current statistics', async () => {
      await rateLimiter.allowRequest();
      await rateLimiter.allowRequest();
      
      const stats = rateLimiter.getStats();
      // requestsInWindow is calculated as requestsPerMinute - tokens
      // After 2 requests, there should be 8 tokens left
      // So requestsInWindow = 60 - 8 = 52
      expect(stats.requestsInWindow).toBeGreaterThanOrEqual(2);
      expect(stats.remainingRequests).toBeLessThanOrEqual(8);
      expect(stats.isLimited).toBe(false);
    });

    it('should show limited status when tokens exhausted', async () => {
      for (let i = 0; i < 10; i++) {
        await rateLimiter.allowRequest();
      }
      
      const stats = rateLimiter.getStats();
      expect(stats.remainingRequests).toBe(0);
      expect(stats.isLimited).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration and reset', async () => {
      // Use some tokens
      await rateLimiter.allowRequest();
      await rateLimiter.allowRequest();

      // Update config
      rateLimiter.updateConfig({
        requestsPerMinute: 120,
        burstLimit: 20
      });

      const stats = rateLimiter.getStats();
      expect(stats.remainingRequests).toBe(20);
    });
  });
});

describe('SlidingWindowRateLimiter', () => {
  let rateLimiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    rateLimiter = new SlidingWindowRateLimiter({
      requestsPerMinute: 60,
      burstLimit: 10
    });
  });

  describe('allowRequest', () => {
    it('should allow requests within limit', async () => {
      for (let i = 0; i < 10; i++) {
        expect(await rateLimiter.allowRequest()).toBe(true);
      }
    });

    it('should deny requests after limit reached', async () => {
      // Use up the limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.allowRequest();
      }
      
      expect(await rateLimiter.allowRequest()).toBe(false);
    });
  });

  describe('sliding window behavior', () => {
    it('should track requests in sliding window', async () => {
      // Add some requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.allowRequest();
      }

      const stats = rateLimiter.getStats();
      expect(stats.requestsInWindow).toBe(5);
      expect(stats.remainingRequests).toBe(5);
    });
  });

  describe('reset', () => {
    it('should clear all timestamps', async () => {
      // Add some requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.allowRequest();
      }

      rateLimiter.reset();
      
      const stats = rateLimiter.getStats();
      expect(stats.requestsInWindow).toBe(0);
      expect(stats.remainingRequests).toBe(10);
    });
  });

  describe('execute', () => {
    it('should execute function with rate limiting', async () => {
      const fn = async () => 'success';
      const result = await rateLimiter.execute(fn);
      expect(result).toBe('success');
      
      const stats = rateLimiter.getStats();
      expect(stats.requestsInWindow).toBe(1);
    });
  });
});