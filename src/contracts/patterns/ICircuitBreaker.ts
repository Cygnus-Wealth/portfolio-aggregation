/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;      // Milliseconds before attempting recovery
  halfOpenRetries: number;      // Number of retries in half-open state
}

/**
 * Circuit breaker interface
 */
export interface ICircuitBreaker {
  /**
   * Get current circuit state
   */
  getState(): CircuitState;
  
  /**
   * Execute function with circuit breaker protection
   */
  execute<T>(fn: () => Promise<T>): Promise<T>;
  
  /**
   * Record a success
   */
  recordSuccess(): void;
  
  /**
   * Record a failure
   */
  recordFailure(): void;
  
  /**
   * Reset the circuit breaker
   */
  reset(): void;
  
  /**
   * Check if circuit allows requests
   */
  allowRequest(): boolean;
  
  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextRetryTime?: Date;
}