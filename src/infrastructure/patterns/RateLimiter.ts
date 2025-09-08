import { 
  IRateLimiter, 
  RateLimitConfig, 
  RateLimiterStats 
} from '../../contracts/patterns/IRateLimiter';

/**
 * Token bucket rate limiter implementation
 */
export class TokenBucketRateLimiter implements IRateLimiter {
  private tokens: number;
  private lastRefillTime: Date;
  private requestQueue: Array<() => void> = [];

  constructor(private config: RateLimitConfig) {
    this.tokens = config.burstLimit || config.requestsPerMinute;
    this.lastRefillTime = new Date();
  }

  async allowRequest(): Promise<boolean> {
    this.refillTokens();
    
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    
    return false;
  }

  async waitForSlot(): Promise<void> {
    while (!(await this.allowRequest())) {
      // Wait for next refill
      const msToNextToken = this.getMillisecondsToNextToken();
      await this.sleep(Math.min(msToNextToken, 100)); // Check every 100ms max
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    return fn();
  }

  reset(): void {
    this.tokens = this.config.burstLimit || this.config.requestsPerMinute;
    this.lastRefillTime = new Date();
    
    // Process any waiting requests
    while (this.requestQueue.length > 0 && this.tokens > 0) {
      const resolve = this.requestQueue.shift();
      if (resolve) {
        this.tokens--;
        resolve();
      }
    }
  }

  getStats(): RateLimiterStats {
    this.refillTokens();
    
    return {
      requestsInWindow: this.config.requestsPerMinute - this.tokens,
      remainingRequests: this.tokens,
      resetTime: this.getNextResetTime(),
      isLimited: this.tokens === 0
    };
  }

  updateConfig(config: RateLimitConfig): void {
    this.config = config;
    this.reset();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = new Date();
    const elapsedMs = now.getTime() - this.lastRefillTime.getTime();
    const elapsedMinutes = elapsedMs / 60000;
    
    if (elapsedMinutes > 0) {
      const tokensToAdd = Math.floor(elapsedMinutes * this.config.requestsPerMinute);
      if (tokensToAdd > 0) {
        const maxTokens = this.config.burstLimit || this.config.requestsPerMinute;
        this.tokens = Math.min(this.tokens + tokensToAdd, maxTokens);
        this.lastRefillTime = now;
      }
    }
  }

  /**
   * Get milliseconds until next token is available
   */
  private getMillisecondsToNextToken(): number {
    const millisecondsPerToken = 60000 / this.config.requestsPerMinute;
    const timeSinceLastRefill = Date.now() - this.lastRefillTime.getTime();
    const timeToNextToken = millisecondsPerToken - (timeSinceLastRefill % millisecondsPerToken);
    return Math.max(0, timeToNextToken);
  }

  /**
   * Get the next reset time
   */
  private getNextResetTime(): Date {
    const msToNextToken = this.getMillisecondsToNextToken();
    return new Date(Date.now() + msToNextToken);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Sliding window rate limiter implementation
 */
export class SlidingWindowRateLimiter implements IRateLimiter {
  private requestTimestamps: number[] = [];

  constructor(private config: RateLimitConfig) {}

  async allowRequest(): Promise<boolean> {
    this.cleanOldRequests();
    
    const maxRequests = this.config.burstLimit || this.config.requestsPerMinute;
    if (this.requestTimestamps.length < maxRequests) {
      this.requestTimestamps.push(Date.now());
      return true;
    }
    
    return false;
  }

  async waitForSlot(): Promise<void> {
    while (!(await this.allowRequest())) {
      // Wait until oldest request expires
      this.cleanOldRequests();
      if (this.requestTimestamps.length > 0) {
        const oldestRequest = this.requestTimestamps[0];
        const windowSize = 60000; // 1 minute in milliseconds
        const timeToWait = Math.max(0, (oldestRequest + windowSize) - Date.now());
        await this.sleep(Math.min(timeToWait, 100)); // Check every 100ms max
      } else {
        await this.sleep(100);
      }
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    return fn();
  }

  reset(): void {
    this.requestTimestamps = [];
  }

  getStats(): RateLimiterStats {
    this.cleanOldRequests();
    
    const maxRequests = this.config.burstLimit || this.config.requestsPerMinute;
    const requestsInWindow = this.requestTimestamps.length;
    
    return {
      requestsInWindow,
      remainingRequests: Math.max(0, maxRequests - requestsInWindow),
      resetTime: this.getNextResetTime(),
      isLimited: requestsInWindow >= maxRequests
    };
  }

  updateConfig(config: RateLimitConfig): void {
    this.config = config;
    // Keep existing timestamps, they'll be cleaned based on new config
  }

  /**
   * Remove requests outside the time window
   */
  private cleanOldRequests(): void {
    const windowSize = 60000; // 1 minute in milliseconds
    const cutoff = Date.now() - windowSize;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > cutoff);
  }

  /**
   * Get the next reset time (when oldest request expires)
   */
  private getNextResetTime(): Date {
    this.cleanOldRequests();
    
    if (this.requestTimestamps.length === 0) {
      return new Date();
    }
    
    const oldestRequest = this.requestTimestamps[0];
    const windowSize = 60000; // 1 minute in milliseconds
    return new Date(oldestRequest + windowSize);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}