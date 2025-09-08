import { IIntegrationRepository } from '../../contracts/repositories/IIntegrationRepository';
import { IRateLimiter, RateLimitConfig } from '../../contracts/patterns/IRateLimiter';
import { ICircuitBreaker, CircuitBreakerConfig, CircuitState } from '../../contracts/patterns/ICircuitBreaker';
import { IEventEmitter } from '../../contracts/events/IEventEmitter';
import { IntegrationSource } from '../../shared/types';
import { BaseDomainEvent, DomainEventType } from '../../domain/events/DomainEvent';

/**
 * Sync result interface
 */
export interface SyncResult {
  successful: IntegrationSource[];
  failed: IntegrationSource[];
  errors: Map<IntegrationSource, Error>;
  duration: number;
  timestamp: Date;
}

/**
 * Sync metrics interface
 */
export interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageDuration: number;
  lastSyncTime?: Date;
  nextScheduledSync?: Date;
  sourceMetrics: Map<IntegrationSource, SourceMetrics>;
}

/**
 * Source-specific metrics
 */
export interface SourceMetrics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  averageResponseTime: number;
  lastSuccess?: Date;
  lastFailure?: Date;
  circuitState: CircuitState;
}

/**
 * Sync cycle started event
 */
export class SyncCycleStartedEvent extends BaseDomainEvent {
  readonly payload: {
    sources: IntegrationSource[];
    scheduled: boolean;
  };

  constructor(sources: IntegrationSource[], scheduled: boolean) {
    super(DomainEventType.SYNC_CYCLE_STARTED);
    this.payload = { sources, scheduled };
  }
}

/**
 * Sync cycle completed event
 */
export class SyncCycleCompletedEvent extends BaseDomainEvent {
  readonly payload: SyncResult;

  constructor(result: SyncResult) {
    super(DomainEventType.SYNC_CYCLE_COMPLETED);
    this.payload = result;
  }
}

/**
 * Service for orchestrating synchronization across integrations
 */
export class SyncOrchestratorService {
  private rateLimiters: Map<IntegrationSource, IRateLimiter> = new Map();
  private circuitBreakers: Map<IntegrationSource, ICircuitBreaker> = new Map();
  private metrics: SyncMetrics;
  private syncInterval?: NodeJS.Timeout;
  private syncInProgress = false;

  constructor(
    private integrations: Map<IntegrationSource, IIntegrationRepository>,
    rateLimiterFactory: (source: IntegrationSource) => IRateLimiter,
    circuitBreakerFactory: (source: IntegrationSource) => ICircuitBreaker,
    private eventEmitter?: IEventEmitter
  ) {
    // Initialize rate limiters and circuit breakers for each integration
    for (const source of integrations.keys()) {
      this.rateLimiters.set(source, rateLimiterFactory(source));
      this.circuitBreakers.set(source, circuitBreakerFactory(source));
    }

    // Initialize metrics
    this.metrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageDuration: 0,
      sourceMetrics: new Map()
    };

    // Initialize source metrics
    for (const source of integrations.keys()) {
      this.metrics.sourceMetrics.set(source, {
        totalAttempts: 0,
        successCount: 0,
        failureCount: 0,
        averageResponseTime: 0,
        circuitState: CircuitState.CLOSED
      });
    }
  }

  /**
   * Orchestrate sync across sources
   */
  async orchestrateSync(sources: IntegrationSource[]): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    
    // Emit sync started event
    if (this.eventEmitter) {
      const event = new SyncCycleStartedEvent(sources, false);
      this.eventEmitter.emit(DomainEventType.SYNC_CYCLE_STARTED, event);
    }

    const result: SyncResult = {
      successful: [],
      failed: [],
      errors: new Map(),
      duration: 0,
      timestamp: new Date()
    };

    try {
      // Execute sync for each source with circuit breaker and rate limiting
      const syncPromises = sources.map(source => this.syncSource(source));
      const results = await Promise.allSettled(syncPromises);

      // Process results
      for (let i = 0; i < results.length; i++) {
        const source = sources[i];
        const syncResult = results[i];

        if (syncResult.status === 'fulfilled') {
          result.successful.push(source);
          this.updateSourceMetrics(source, true);
        } else {
          result.failed.push(source);
          result.errors.set(source, syncResult.reason);
          this.updateSourceMetrics(source, false, syncResult.reason);
        }
      }

      // Calculate duration
      result.duration = Date.now() - startTime;

      // Update global metrics
      this.updateGlobalMetrics(result);

      // Emit sync completed event
      if (this.eventEmitter) {
        const event = new SyncCycleCompletedEvent(result);
        this.eventEmitter.emit(DomainEventType.SYNC_CYCLE_COMPLETED, event);
      }

      return result;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Schedule periodic sync cycles
   */
  scheduleSyncCycle(intervalMs: number): () => void {
    // Clear existing interval if any
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Schedule new interval
    this.syncInterval = setInterval(async () => {
      try {
        const sources = Array.from(this.integrations.keys());
        await this.orchestrateSync(sources);
      } catch (error) {
        console.error('Scheduled sync failed:', error);
      }
    }, intervalMs);

    // Update next scheduled sync time
    this.metrics.nextScheduledSync = new Date(Date.now() + intervalMs);

    // Return cleanup function
    return () => {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = undefined;
        this.metrics.nextScheduledSync = undefined;
      }
    };
  }

  /**
   * Configure rate limit for a source
   */
  configureRateLimit(source: IntegrationSource, config: RateLimitConfig): void {
    const rateLimiter = this.rateLimiters.get(source);
    if (!rateLimiter) {
      throw new Error(`Rate limiter not found for source: ${source}`);
    }
    rateLimiter.updateConfig(config);
  }

  /**
   * Configure circuit breaker for a source
   */
  configureCircuitBreaker(source: IntegrationSource, _config: CircuitBreakerConfig): void {
    const circuitBreaker = this.circuitBreakers.get(source);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker not found for source: ${source}`);
    }
    // Circuit breaker config is typically set at creation time
    // This would require recreating the circuit breaker
    console.warn('Circuit breaker reconfiguration not implemented');
  }

  /**
   * Get circuit state for a source
   */
  getCircuitState(source: IntegrationSource): CircuitState {
    const circuitBreaker = this.circuitBreakers.get(source);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker not found for source: ${source}`);
    }
    return circuitBreaker.getState();
  }

  /**
   * Retry a failed source
   */
  async retryFailedSource(source: IntegrationSource): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get(source);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker not found for source: ${source}`);
    }

    // Reset circuit breaker for retry
    circuitBreaker.reset();

    // Attempt sync
    await this.syncSource(source);
  }

  /**
   * Get sync metrics
   */
  getSyncMetrics(): SyncMetrics {
    // Update circuit states in metrics
    for (const [source, metrics] of this.metrics.sourceMetrics) {
      const circuitBreaker = this.circuitBreakers.get(source);
      if (circuitBreaker) {
        metrics.circuitState = circuitBreaker.getState();
      }
    }

    return { ...this.metrics };
  }

  /**
   * Sync a single source with protection
   */
  private async syncSource(source: IntegrationSource): Promise<void> {
    const integration = this.integrations.get(source);
    if (!integration) {
      throw new Error(`Integration not found: ${source}`);
    }

    const rateLimiter = this.rateLimiters.get(source);
    const circuitBreaker = this.circuitBreakers.get(source);

    if (!rateLimiter || !circuitBreaker) {
      throw new Error(`Protection mechanisms not found for source: ${source}`);
    }

    // Check circuit breaker
    if (!circuitBreaker.allowRequest()) {
      throw new Error(`Circuit breaker open for source: ${source}`);
    }

    // Apply rate limiting
    await rateLimiter.waitForSlot();

    // Execute with circuit breaker
    return circuitBreaker.execute(async () => {
      if (!integration.isConnected()) {
        await integration.connect();
      }
      
      // Perform a basic connectivity check
      // In real implementation, this might fetch minimal data
      await integration.fetchAssets(['test']);
    });
  }

  /**
   * Update source-specific metrics
   */
  private updateSourceMetrics(
    source: IntegrationSource,
    success: boolean,
    _error?: Error
  ): void {
    const metrics = this.metrics.sourceMetrics.get(source);
    if (!metrics) return;

    metrics.totalAttempts++;
    
    if (success) {
      metrics.successCount++;
      metrics.lastSuccess = new Date();
      
      // Record success in circuit breaker
      const circuitBreaker = this.circuitBreakers.get(source);
      if (circuitBreaker) {
        circuitBreaker.recordSuccess();
      }
    } else {
      metrics.failureCount++;
      metrics.lastFailure = new Date();
      
      // Record failure in circuit breaker
      const circuitBreaker = this.circuitBreakers.get(source);
      if (circuitBreaker) {
        circuitBreaker.recordFailure();
      }

      // Emit source failed event
      if (this.eventEmitter) {
        const event = new BaseDomainEvent(DomainEventType.SYNC_SOURCE_FAILED);
        this.eventEmitter.emit(DomainEventType.SYNC_SOURCE_FAILED, event);
      }
    }
  }

  /**
   * Update global metrics
   */
  private updateGlobalMetrics(result: SyncResult): void {
    this.metrics.totalSyncs++;
    
    if (result.failed.length === 0) {
      this.metrics.successfulSyncs++;
    } else if (result.successful.length === 0) {
      this.metrics.failedSyncs++;
    }

    // Update average duration
    const currentAvg = this.metrics.averageDuration;
    const totalDuration = currentAvg * (this.metrics.totalSyncs - 1) + result.duration;
    this.metrics.averageDuration = totalDuration / this.metrics.totalSyncs;

    this.metrics.lastSyncTime = result.timestamp;
  }
}