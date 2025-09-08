/**
 * Rate limiter configuration
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit?: number;
}

/**
 * Rate limiter interface
 */
export interface IRateLimiter {
  /**
   * Check if request is allowed
   */
  allowRequest(): Promise<boolean>;
  
  /**
   * Wait until request is allowed
   */
  waitForSlot(): Promise<void>;
  
  /**
   * Execute function with rate limiting
   */
  execute<T>(fn: () => Promise<T>): Promise<T>;
  
  /**
   * Reset the rate limiter
   */
  reset(): void;
  
  /**
   * Get current rate limiter stats
   */
  getStats(): RateLimiterStats;
  
  /**
   * Update configuration
   */
  updateConfig(config: RateLimitConfig): void;
}

/**
 * Rate limiter statistics
 */
export interface RateLimiterStats {
  requestsInWindow: number;
  remainingRequests: number;
  resetTime: Date;
  isLimited: boolean;
}