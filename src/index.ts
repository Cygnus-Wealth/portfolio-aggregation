/**
 * @cygnus-wealth/portfolio-aggregation
 * 
 * Portfolio Aggregation Service Library
 * A reusable npm package that provides portfolio orchestration and aggregation capabilities
 */

// ============================================================================
// Domain Layer Exports
// ============================================================================

// Aggregates
export { PortfolioAggregate } from './domain/aggregates/Portfolio';

// Entities
export { AssetEntity } from './domain/entities/Asset';

// Value Objects
export { Money } from './domain/value-objects/Money';
export { Address } from './domain/value-objects/Address';

// Domain Services
export { AssetReconciliationService } from './domain/services/AssetReconciliationService';
export { 
  PortfolioValuationService,
  type PortfolioMetrics 
} from './domain/services/PortfolioValuationService';

// Domain Events
export type { DomainEvent } from './domain/events/DomainEvent';
export {
  BaseDomainEvent,
  DomainEventType
} from './domain/events/DomainEvent';

export type {
  IEventBus,
  EventHandler,
  UnsubscribeFn
} from './domain/events/EventBus';
export { InMemoryEventBus } from './domain/events/EventBus';

export {
  PortfolioAggregationStartedEvent,
  PortfolioAggregationCompletedEvent,
  PortfolioAggregationFailedEvent,
  PortfolioReconciliationStartedEvent,
  PortfolioReconciliationCompletedEvent
} from './domain/events/portfolio/PortfolioEvents';

export {
  AssetAddedToPortfolioEvent,
  AssetMergedEvent,
  AssetPriceUpdatedEvent
} from './domain/events/portfolio/AssetEvents';

// ============================================================================
// Application Layer Exports
// ============================================================================

// Application Services
export { 
  PortfolioAggregationService,
  type AggregationOptions 
} from './application/services/PortfolioAggregationService';

export { 
  AddressRegistryService,
  AddressAddedEvent,
  AddressRemovedEvent,
  type WalletConnection
} from './application/services/AddressRegistryService';

export { 
  SyncOrchestratorService,
  SyncCycleStartedEvent,
  SyncCycleCompletedEvent,
  type SyncResult,
  type SyncMetrics,
  type SourceMetrics
} from './application/services/SyncOrchestratorService';

// Commands
export { 
  type ICommand,
  type ICommandHandler,
  type ICommandBus
} from './application/commands/Command';

export { 
  AggregatePortfolioCommand,
  type AggregatePortfolioResult
} from './application/commands/AggregatePortfolioCommand';

export { 
  RefreshSourceCommand,
  type RefreshSourceResult
} from './application/commands/RefreshSourceCommand';

export { AddAddressCommand } from './application/commands/AddAddressCommand';

// ============================================================================
// Infrastructure Layer Exports
// ============================================================================

// Patterns
export { CircuitBreaker } from './infrastructure/patterns/CircuitBreaker';
export { 
  TokenBucketRateLimiter,
  SlidingWindowRateLimiter 
} from './infrastructure/patterns/RateLimiter';

// Repository Implementations
export { LocalStoragePortfolioRepository } from './infrastructure/repositories/LocalStoragePortfolioRepository';
export { MockAssetValuatorRepository } from './infrastructure/repositories/MockAssetValuatorRepository';
export { MockEVMIntegrationRepository } from './infrastructure/integrations/MockEVMIntegrationRepository';

// Validation
export {
  EnvironmentValidator,
  type EnvironmentValidatorConfig
} from './infrastructure/validation/EnvironmentValidator';

// ============================================================================
// Contracts (Interfaces) Exports
// ============================================================================

// Repository Interfaces
export { 
  type IIntegrationRepository 
} from './contracts/repositories/IIntegrationRepository';

export { 
  type IPortfolioRepository 
} from './contracts/repositories/IPortfolioRepository';

export { 
  type IAssetValuatorRepository,
  type Price,
  type MarketData
} from './contracts/repositories/IAssetValuatorRepository';

export { 
  type IAddressRepository,
  type AddressMetadata,
  type AddressEntry
} from './contracts/repositories/IAddressRepository';

// Pattern Interfaces
export { 
  type ICircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  CircuitState
} from './contracts/patterns/ICircuitBreaker';

export { 
  type IRateLimiter,
  type RateLimitConfig,
  type RateLimiterStats
} from './contracts/patterns/IRateLimiter';

// Event Interfaces
export { 
  type IEventEmitter,
  type EventHandler as IEventHandler
} from './contracts/events/IEventEmitter';

// ============================================================================
// Shared Types Exports
// ============================================================================

export {
  IntegrationSource,
  AssetType,
  Environment,
  type Asset,
  type Balance,
  type Chain,
  type Transaction,
  type Price as SharedPrice
} from './shared/types';

// ============================================================================
// Factory and Helper Exports
// ============================================================================

// Import concrete types needed for factory implementation
import type { IIntegrationRepository } from './contracts/repositories/IIntegrationRepository';
import type { IPortfolioRepository } from './contracts/repositories/IPortfolioRepository';
import type { IAssetValuatorRepository } from './contracts/repositories/IAssetValuatorRepository';
import type { IAddressRepository } from './contracts/repositories/IAddressRepository';
import type { ICircuitBreaker } from './contracts/patterns/ICircuitBreaker';
import type { IRateLimiter } from './contracts/patterns/IRateLimiter';
import type { IEventEmitter } from './contracts/events/IEventEmitter';
import { IntegrationSource, Environment } from './shared/types';
import type { EnvironmentValidatorConfig } from './infrastructure/validation/EnvironmentValidator';
import { PortfolioAggregationService } from './application/services/PortfolioAggregationService';
import { AddressRegistryService } from './application/services/AddressRegistryService';
import { SyncOrchestratorService } from './application/services/SyncOrchestratorService';

/**
 * Factory for creating portfolio aggregation service with default configuration
 */
export class PortfolioServiceFactory {
  static create(config: {
    integrations: Map<IntegrationSource, IIntegrationRepository>;
    portfolioRepository: IPortfolioRepository;
    assetValuator: IAssetValuatorRepository;
  }): PortfolioAggregationService {
    return new PortfolioAggregationService(
      config.integrations,
      config.portfolioRepository,
      config.assetValuator
    );
  }

  static createAddressRegistry(config: {
    addressRepository: IAddressRepository;
    eventEmitter?: IEventEmitter;
  }): AddressRegistryService {
    return new AddressRegistryService(
      config.addressRepository,
      config.eventEmitter
    );
  }

  static createSyncOrchestrator(config: {
    integrations: Map<IntegrationSource, IIntegrationRepository>;
    rateLimiterFactory: (source: IntegrationSource) => IRateLimiter;
    circuitBreakerFactory: (source: IntegrationSource) => ICircuitBreaker;
    eventEmitter?: IEventEmitter;
    environment?: Environment;
    environmentValidatorConfig?: EnvironmentValidatorConfig;
  }): SyncOrchestratorService {
    return new SyncOrchestratorService(
      config.integrations,
      config.rateLimiterFactory,
      config.circuitBreakerFactory,
      config.eventEmitter,
      config.environment,
      config.environmentValidatorConfig
    );
  }
}

// ============================================================================
// Test Helper Exports (for consumers to use in their tests)
// ============================================================================

export * from './tests/mocks/MockIntegrationRepository';
export * from './tests/mocks/InMemoryPortfolioRepository';
export * from './tests/mocks/MockAssetValuator';
export * from './tests/helpers/TestDataBuilder';

/**
 * Version information
 */
export const VERSION = '0.1.0';

/**
 * Library metadata
 */
export const LIBRARY_NAME = '@cygnus-wealth/portfolio-aggregation';

// Default export for convenience
export default {
  PortfolioAggregationService,
  AddressRegistryService,
  SyncOrchestratorService,
  PortfolioServiceFactory,
  VERSION,
  LIBRARY_NAME
};