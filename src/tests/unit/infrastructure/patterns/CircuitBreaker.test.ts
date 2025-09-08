import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from '../../../../infrastructure/patterns/CircuitBreaker';
import { CircuitState } from '../../../../contracts/patterns/ICircuitBreaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      halfOpenRetries: 2
    });
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should allow requests in CLOSED state', () => {
      expect(circuitBreaker.allowRequest()).toBe(true);
    });
  });

  describe('failure handling', () => {
    it('should remain CLOSED after failures below threshold', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.allowRequest()).toBe(true);
    });

    it('should transition to OPEN after reaching failure threshold', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker.allowRequest()).toBe(false);
    });

    it('should reject requests when OPEN', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.allowRequest()).toBe(false);
    });
  });

  describe('recovery', () => {
    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Open the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      expect(circuitBreaker.allowRequest()).toBe(true);
    });

    it('should close circuit after successful retries in HALF_OPEN', async () => {
      // Open the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Record successes
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should reopen on failure in HALF_OPEN state', async () => {
      // Open the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Record failure in half-open
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker.allowRequest()).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute function successfully in CLOSED state', async () => {
      const fn = async () => 'success';
      const result = await circuitBreaker.execute(fn);
      expect(result).toBe('success');
    });

    it('should record success when function succeeds', async () => {
      const fn = async () => 'success';
      await circuitBreaker.execute(fn);
      
      const stats = circuitBreaker.getStats();
      expect(stats.successes).toBe(1);
      expect(stats.failures).toBe(0);
    });

    it('should record failure and rethrow when function fails', async () => {
      const fn = async () => {
        throw new Error('test error');
      };
      
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('test error');
      
      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1);
    });

    it('should reject execution when circuit is OPEN', async () => {
      // Open the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      const fn = async () => 'success';
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordSuccess();
      
      circuitBreaker.reset();
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.lastFailureTime).toBeUndefined();
      expect(stats.lastSuccessTime).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return current statistics', () => {
      circuitBreaker.recordSuccess();
      circuitBreaker.recordFailure();
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.successes).toBe(1);
      expect(stats.failures).toBe(1);
      expect(stats.lastSuccessTime).toBeDefined();
      expect(stats.lastFailureTime).toBeDefined();
    });
  });
});