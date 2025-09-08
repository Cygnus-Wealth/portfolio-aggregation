/**
 * Base domain event interface
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly aggregateId?: string;
  readonly payload: unknown;
}

/**
 * Base domain event class
 */
export abstract class BaseDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly aggregateId?: string;
  abstract readonly payload: unknown;

  constructor(eventType: string, aggregateId?: string) {
    this.eventId = this.generateEventId();
    this.eventType = eventType;
    this.occurredAt = new Date();
    this.aggregateId = aggregateId;
  }

  private generateEventId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Domain event types enum
 */
export enum DomainEventType {
  // Portfolio Lifecycle
  PORTFOLIO_AGGREGATION_STARTED = 'PortfolioAggregationStarted',
  PORTFOLIO_AGGREGATION_COMPLETED = 'PortfolioAggregationCompleted',
  PORTFOLIO_AGGREGATION_FAILED = 'PortfolioAggregationFailed',
  
  // Asset Management
  ASSET_ADDED_TO_PORTFOLIO = 'AssetAddedToPortfolio',
  ASSET_MERGED = 'AssetMerged',
  ASSET_PRICE_UPDATED = 'AssetPriceUpdated',
  
  // Integration Events
  INTEGRATION_SOURCE_CONNECTED = 'IntegrationSourceConnected',
  INTEGRATION_SOURCE_FAILED = 'IntegrationSourceFailed',
  INTEGRATION_SOURCE_DATA_FETCHED = 'IntegrationSourceDataFetched',
  
  // Reconciliation Events
  PORTFOLIO_RECONCILIATION_STARTED = 'PortfolioReconciliationStarted',
  PORTFOLIO_RECONCILIATION_COMPLETED = 'PortfolioReconciliationCompleted',
  
  // Address Registry Events
  ADDRESS_ADDED = 'AddressAdded',
  ADDRESS_REMOVED = 'AddressRemoved',
  ADDRESS_METADATA_UPDATED = 'AddressMetadataUpdated',
  
  // Sync Events
  SYNC_CYCLE_STARTED = 'SyncCycleStarted',
  SYNC_CYCLE_COMPLETED = 'SyncCycleCompleted',
  SYNC_SOURCE_FAILED = 'SyncSourceFailed',
  
  // Circuit Breaker Events
  CIRCUIT_BREAKER_OPENED = 'CircuitBreakerOpened',
  CIRCUIT_BREAKER_CLOSED = 'CircuitBreakerClosed',
  CIRCUIT_BREAKER_HALF_OPEN = 'CircuitBreakerHalfOpen'
}