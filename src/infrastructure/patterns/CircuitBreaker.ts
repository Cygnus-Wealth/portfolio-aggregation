import { 
  ICircuitBreaker, 
  CircuitState, 
  CircuitBreakerConfig, 
  CircuitBreakerStats 
} from '../../contracts/patterns/ICircuitBreaker';

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker implements ICircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextRetryTime?: Date;
  private halfOpenAttempts = 0;

  constructor(private config: CircuitBreakerConfig) {}

  getState(): CircuitState {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN && this.nextRetryTime) {
      if (new Date() >= this.nextRetryTime) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
      }
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.allowRequest()) {
      throw new Error(`Circuit breaker is ${this.state}`);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  recordSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        this.halfOpenAttempts++;
        if (this.halfOpenAttempts >= this.config.halfOpenRetries) {
          // Enough successful attempts in half-open, close the circuit
          this.state = CircuitState.CLOSED;
          this.failures = 0;
          this.halfOpenAttempts = 0;
        }
        break;
      
      case CircuitState.CLOSED:
        // Reset failure count on success
        this.failures = 0;
        break;
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();

    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.failures >= this.config.failureThreshold) {
          // Open the circuit
          this.state = CircuitState.OPEN;
          this.nextRetryTime = new Date(Date.now() + this.config.recoveryTimeout);
        }
        break;
      
      case CircuitState.HALF_OPEN:
        // Failure in half-open state, reopen the circuit
        this.state = CircuitState.OPEN;
        this.nextRetryTime = new Date(Date.now() + this.config.recoveryTimeout);
        this.halfOpenAttempts = 0;
        break;
    }
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextRetryTime = undefined;
    this.halfOpenAttempts = 0;
  }

  allowRequest(): boolean {
    const currentState = this.getState(); // This may transition state
    
    switch (currentState) {
      case CircuitState.CLOSED:
        return true;
      
      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open state
        return this.halfOpenAttempts < this.config.halfOpenRetries;
      
      case CircuitState.OPEN:
        return false;
      
      default:
        return false;
    }
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime: this.nextRetryTime
    };
  }
}