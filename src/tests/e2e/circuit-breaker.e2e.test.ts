import { describe, it, expect, beforeEach } from 'vitest';
import { SyncOrchestratorService } from '../../application/services/SyncOrchestratorService';
import { CircuitBreaker } from '../../infrastructure/patterns/CircuitBreaker';
import { CircuitState } from '../../contracts/patterns/ICircuitBreaker';
import { IntegrationSource } from '../../shared/types';
import {
  E2EMockIntegrationRepository,
  E2EMockEventEmitter,
  E2EMockRateLimiter,
  createEVMAssets,
  createSolanaAssets,
} from './mocks';
import type { IIntegrationRepository } from '../../contracts/repositories/IIntegrationRepository';

describe('E2E: Circuit Breaker Activation', () => {
  let evmIntegration: E2EMockIntegrationRepository;
  let solanaIntegration: E2EMockIntegrationRepository;
  let eventEmitter: E2EMockEventEmitter;
  let orchestrator: SyncOrchestratorService;

  const ETH_ADDR = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';
  const SOL_ADDR = '5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X';

  beforeEach(() => {
    evmIntegration = new E2EMockIntegrationRepository({ source: IntegrationSource.EVM });
    solanaIntegration = new E2EMockIntegrationRepository({ source: IntegrationSource.SOLANA });

    evmIntegration.addAssetsForAddress(ETH_ADDR, createEVMAssets(ETH_ADDR));
    evmIntegration.addAssetsForAddress('test', createEVMAssets(ETH_ADDR));
    solanaIntegration.addAssetsForAddress(SOL_ADDR, createSolanaAssets(SOL_ADDR));
    solanaIntegration.addAssetsForAddress('test', createSolanaAssets(SOL_ADDR));

    eventEmitter = new E2EMockEventEmitter();

    const integrations = new Map<IntegrationSource, IIntegrationRepository>([
      [IntegrationSource.EVM, evmIntegration],
      [IntegrationSource.SOLANA, solanaIntegration],
    ]);

    orchestrator = new SyncOrchestratorService(
      integrations,
      () => new E2EMockRateLimiter(),
      () => new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 100,
        halfOpenRetries: 1,
      }),
      eventEmitter
    );
  });

  it('starts with all circuit breakers closed', () => {
    expect(orchestrator.getCircuitState(IntegrationSource.EVM)).toBe(CircuitState.CLOSED);
    expect(orchestrator.getCircuitState(IntegrationSource.SOLANA)).toBe(CircuitState.CLOSED);
  });

  it('opens circuit breaker after repeated failures', async () => {
    evmIntegration.setFailure(true, 'EVM RPC error');

    // First failure
    await orchestrator.orchestrateSync([IntegrationSource.EVM]);
    // Second failure hits threshold
    await orchestrator.orchestrateSync([IntegrationSource.EVM]);

    expect(orchestrator.getCircuitState(IntegrationSource.EVM)).toBe(CircuitState.OPEN);
  });

  it('blocks requests when circuit is open', async () => {
    evmIntegration.setFailure(true, 'EVM RPC error');

    // Trip the circuit breaker
    await orchestrator.orchestrateSync([IntegrationSource.EVM]);
    await orchestrator.orchestrateSync([IntegrationSource.EVM]);

    expect(orchestrator.getCircuitState(IntegrationSource.EVM)).toBe(CircuitState.OPEN);

    // Third sync should fail fast with circuit open
    const result = await orchestrator.orchestrateSync([IntegrationSource.EVM]);
    expect(result.failed).toContain(IntegrationSource.EVM);
  });

  it('keeps healthy sources working when one circuit trips', async () => {
    evmIntegration.setFailure(true, 'EVM down');

    // Trip EVM circuit breaker
    await orchestrator.orchestrateSync([IntegrationSource.EVM, IntegrationSource.SOLANA]);
    await orchestrator.orchestrateSync([IntegrationSource.EVM, IntegrationSource.SOLANA]);

    expect(orchestrator.getCircuitState(IntegrationSource.EVM)).toBe(CircuitState.OPEN);
    expect(orchestrator.getCircuitState(IntegrationSource.SOLANA)).toBe(CircuitState.CLOSED);

    // Solana should still work
    const result = await orchestrator.orchestrateSync([IntegrationSource.EVM, IntegrationSource.SOLANA]);
    expect(result.successful).toContain(IntegrationSource.SOLANA);
    expect(result.failed).toContain(IntegrationSource.EVM);
  });

  it('transitions to half-open after recovery timeout', async () => {
    evmIntegration.setFailure(true, 'EVM down');

    // Trip the circuit
    await orchestrator.orchestrateSync([IntegrationSource.EVM]);
    await orchestrator.orchestrateSync([IntegrationSource.EVM]);
    expect(orchestrator.getCircuitState(IntegrationSource.EVM)).toBe(CircuitState.OPEN);

    // Wait for recovery timeout (100ms configured above)
    await new Promise(r => setTimeout(r, 150));

    expect(orchestrator.getCircuitState(IntegrationSource.EVM)).toBe(CircuitState.HALF_OPEN);
  });

  it('closes circuit breaker after successful recovery', async () => {
    evmIntegration.setFailure(true, 'EVM down');

    // Trip the circuit
    await orchestrator.orchestrateSync([IntegrationSource.EVM]);
    await orchestrator.orchestrateSync([IntegrationSource.EVM]);
    expect(orchestrator.getCircuitState(IntegrationSource.EVM)).toBe(CircuitState.OPEN);

    // Wait for recovery timeout
    await new Promise(r => setTimeout(r, 150));

    // Fix the integration
    evmIntegration.setFailure(false);

    // Should transition to HALF_OPEN and then CLOSED after success
    const result = await orchestrator.orchestrateSync([IntegrationSource.EVM]);
    expect(result.successful).toContain(IntegrationSource.EVM);
    expect(orchestrator.getCircuitState(IntegrationSource.EVM)).toBe(CircuitState.CLOSED);
  });

  it('allows retrying a failed source by resetting its circuit breaker', async () => {
    evmIntegration.setFailure(true, 'EVM down');

    // Trip the circuit
    await orchestrator.orchestrateSync([IntegrationSource.EVM]);
    await orchestrator.orchestrateSync([IntegrationSource.EVM]);
    expect(orchestrator.getCircuitState(IntegrationSource.EVM)).toBe(CircuitState.OPEN);

    // Fix the integration and retry
    evmIntegration.setFailure(false);
    await orchestrator.retryFailedSource(IntegrationSource.EVM);

    expect(orchestrator.getCircuitState(IntegrationSource.EVM)).toBe(CircuitState.CLOSED);
  });

  it('tracks sync metrics correctly across successes and failures', async () => {
    // Successful sync
    await orchestrator.orchestrateSync([IntegrationSource.EVM, IntegrationSource.SOLANA]);

    let metrics = orchestrator.getSyncMetrics();
    expect(metrics.totalSyncs).toBe(1);
    expect(metrics.successfulSyncs).toBe(1);

    // Partial failure
    evmIntegration.setFailure(true);
    await orchestrator.orchestrateSync([IntegrationSource.EVM, IntegrationSource.SOLANA]);

    metrics = orchestrator.getSyncMetrics();
    expect(metrics.totalSyncs).toBe(2);
    // Partial failure means neither fully successful nor fully failed
    expect(metrics.lastSyncTime).toBeDefined();

    const evmMetrics = metrics.sourceMetrics.get(IntegrationSource.EVM);
    expect(evmMetrics).toBeDefined();
    expect(evmMetrics!.failureCount).toBeGreaterThanOrEqual(1);

    const solMetrics = metrics.sourceMetrics.get(IntegrationSource.SOLANA);
    expect(solMetrics).toBeDefined();
    expect(solMetrics!.successCount).toBeGreaterThanOrEqual(2);
  });

  it('emits sync cycle events', async () => {
    await orchestrator.orchestrateSync([IntegrationSource.EVM]);

    expect(eventEmitter.hasEvent('SyncCycleStarted')).toBe(true);
    expect(eventEmitter.hasEvent('SyncCycleCompleted')).toBe(true);
  });
});
