import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncOrchestratorService } from '../../../../application/services/SyncOrchestratorService';
import { MockIntegrationRepository } from '../../../mocks/MockIntegrationRepository';
import { IntegrationSource, Environment } from '../../../../shared/types';
import type { IRateLimiter, RateLimiterStats } from '../../../../contracts/patterns/IRateLimiter';
import type { ICircuitBreaker, CircuitBreakerStats } from '../../../../contracts/patterns/ICircuitBreaker';
import { CircuitState } from '../../../../contracts/patterns/ICircuitBreaker';

function createMockRateLimiter(): IRateLimiter {
  return {
    allowRequest: vi.fn().mockResolvedValue(true),
    waitForSlot: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockImplementation((fn) => fn()) as IRateLimiter['execute'],
    getStats: vi.fn().mockReturnValue({ requestsInWindow: 0, remainingRequests: 10, resetTime: new Date(), isLimited: false } as RateLimiterStats),
    updateConfig: vi.fn(),
    reset: vi.fn(),
  };
}

function createMockCircuitBreaker(): ICircuitBreaker {
  return {
    execute: vi.fn().mockImplementation((fn) => fn()) as ICircuitBreaker['execute'],
    allowRequest: vi.fn().mockReturnValue(true),
    getState: vi.fn().mockReturnValue(CircuitState.CLOSED),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    reset: vi.fn(),
    getStats: vi.fn().mockReturnValue({
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      lastFailureTime: undefined,
    } as CircuitBreakerStats),
  };
}

describe('SyncOrchestratorService environment support', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('stores the environment on the service instance', () => {
    const integrations = new Map();
    const service = new SyncOrchestratorService(
      integrations,
      () => createMockRateLimiter(),
      () => createMockCircuitBreaker(),
      undefined,
      Environment.TESTNET
    );
    expect(service.environment).toBe(Environment.TESTNET);
  });

  it('defaults to mainnet when no environment is specified', () => {
    const integrations = new Map();
    const service = new SyncOrchestratorService(
      integrations,
      () => createMockRateLimiter(),
      () => createMockCircuitBreaker(),
    );
    expect(service.environment).toBe(Environment.MAINNET);
  });

  it('blocks mainnet sync in CI', async () => {
    process.env.CI = 'true';
    const mockRepo = new MockIntegrationRepository(IntegrationSource.EVM);
    const integrations = new Map([[IntegrationSource.EVM, mockRepo]]);

    const service = new SyncOrchestratorService(
      integrations,
      () => createMockRateLimiter(),
      () => createMockCircuitBreaker(),
      undefined,
      Environment.MAINNET
    );

    await expect(
      service.orchestrateSync([IntegrationSource.EVM])
    ).rejects.toThrow('Production (mainnet) access is blocked in CI environments');
  });

  it('allows testnet sync in CI', async () => {
    process.env.CI = 'true';
    const mockRepo = new MockIntegrationRepository(IntegrationSource.EVM);
    const integrations = new Map([[IntegrationSource.EVM, mockRepo]]);

    const service = new SyncOrchestratorService(
      integrations,
      () => createMockRateLimiter(),
      () => createMockCircuitBreaker(),
      undefined,
      Environment.TESTNET
    );

    const result = await service.orchestrateSync([IntegrationSource.EVM]);
    expect(result).toBeDefined();
  });

  it('allows mainnet sync in CI with explicit opt-in', async () => {
    process.env.CI = 'true';
    const mockRepo = new MockIntegrationRepository(IntegrationSource.EVM);
    const integrations = new Map([[IntegrationSource.EVM, mockRepo]]);

    const service = new SyncOrchestratorService(
      integrations,
      () => createMockRateLimiter(),
      () => createMockCircuitBreaker(),
      undefined,
      Environment.MAINNET,
      { allowProductionInCI: true }
    );

    const result = await service.orchestrateSync([IntegrationSource.EVM]);
    expect(result).toBeDefined();
  });
});
