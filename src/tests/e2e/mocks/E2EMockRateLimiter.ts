import { IRateLimiter, RateLimitConfig, RateLimiterStats } from '../../../contracts/patterns/IRateLimiter';

/**
 * E2E mock rate limiter that always allows requests
 */
export class E2EMockRateLimiter implements IRateLimiter {
  private _config: RateLimitConfig;

  constructor(config: RateLimitConfig = { requestsPerMinute: 1000 }) {
    this._config = config;
  }

  async allowRequest(): Promise<boolean> {
    return true;
  }

  async waitForSlot(): Promise<void> {
    // No-op: always available
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  reset(): void {
    // no-op
  }

  getStats(): RateLimiterStats {
    return {
      requestsInWindow: 0,
      remainingRequests: this._config.requestsPerMinute,
      resetTime: new Date(Date.now() + 60000),
      isLimited: false
    };
  }

  updateConfig(config: RateLimitConfig): void {
    this._config = config;
  }
}
