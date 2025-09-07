# Domain Events Specification

## Overview

This document defines the domain events emitted by the Portfolio Aggregation service library. As a library package, this bounded context emits events through an event emitter interface provided by the consuming application, enabling loose coupling and real-time notifications.

## Library Event Architecture

Since this is a service library (npm package), not a standalone application:

1. **Event Emission**: Events are emitted through an optional EventEmitter interface provided during service initialization
2. **No Built-in Persistence**: Event storage/persistence is the responsibility of consuming applications
3. **Subscription Pattern**: Consuming applications subscribe to events they're interested in
4. **Transport Agnostic**: The library doesn't dictate how events are transported or stored

## Event Contract for Consuming Applications

### Integration Pattern

Consuming applications (like @cygnus-wealth/cygnus-wealth-core) integrate with events as follows:

```typescript
import { PortfolioAggregationService, DomainEventType } from '@cygnus-wealth/portfolio-aggregation';
import { EventEmitter } from 'events';

// Provide event emitter during initialization
const eventEmitter = new EventEmitter();
const service = new PortfolioAggregationService(
  integrations,
  repository,
  valuator,
  eventEmitter  // Optional: if not provided, events won't be emitted
);

// Subscribe to events
service.on(DomainEventType.PORTFOLIO_AGGREGATION_COMPLETED, (event) => {
  // Handle event in consuming application
  updateUI(event.payload);
  saveToAuditLog(event);
});
```

### Base Event Structure

All domain events follow this structure for consistency across the library:

```typescript
interface DomainEventMetadata {
  eventId: string;          // Unique event identifier (UUID)
  eventType: string;         // Event class name
  aggregateId: string;       // ID of the aggregate that generated the event
  aggregateType: string;     // Type of aggregate (e.g., "Portfolio")
  occurredAt: Date;          // When the event occurred
  correlationId?: string;    // For tracing related events
  causationId?: string;      // ID of the event that caused this one
  userId?: string;           // User who triggered the action
  version: number;           // Event schema version
}

abstract class DomainEvent {
  readonly metadata: DomainEventMetadata;
  
  constructor(aggregateId: string, userId?: string) {
    this.metadata = {
      eventId: generateUUID(),
      eventType: this.constructor.name,
      aggregateId,
      aggregateType: this.getAggregateType(),
      occurredAt: new Date(),
      userId,
      version: 1
    };
  }
  
  abstract getAggregateType(): string;
  abstract getPayload(): unknown;
}
```

## Portfolio Events

### 1. PortfolioCreatedEvent

**Emitted When**: A new portfolio aggregate is instantiated  
**Aggregate**: PortfolioAggregate  
**Frequency**: Once per portfolio lifecycle

```typescript
class PortfolioCreatedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly userId: string | undefined,
    public readonly initialSources: IntegrationSource[]
  ) {
    super(portfolioId, userId);
  }
  
  getAggregateType(): string {
    return 'Portfolio';
  }
  
  getPayload() {
    return {
      userId: this.userId,
      initialSources: this.initialSources
    };
  }
}
```

### 2. PortfolioAggregationStartedEvent

**Emitted When**: Portfolio aggregation process begins  
**Aggregate**: PortfolioAggregate  
**Frequency**: Every aggregation cycle

```typescript
class PortfolioAggregationStartedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly sources: IntegrationSource[],
    public readonly addresses: Map<string, string[]>,
    public readonly isRefresh: boolean,
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      sources: this.sources,
      addressCount: Array.from(this.addresses.values()).flat().length,
      chains: Array.from(this.addresses.keys()),
      isRefresh: this.isRefresh
    };
  }
}
```

### 3. PortfolioAggregationCompletedEvent

**Emitted When**: Portfolio aggregation successfully completes  
**Aggregate**: PortfolioAggregate  
**Frequency**: Every successful aggregation

```typescript
class PortfolioAggregationCompletedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly assetCount: number,
    public readonly totalValue: Money,
    public readonly successfulSources: IntegrationSource[],
    public readonly failedSources: IntegrationSource[],
    public readonly duration: number, // milliseconds
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      assetCount: this.assetCount,
      totalValue: this.totalValue.toJSON(),
      successfulSources: this.successfulSources,
      failedSources: this.failedSources,
      duration: this.duration,
      successRate: this.successfulSources.length / 
        (this.successfulSources.length + this.failedSources.length)
    };
  }
}
```

### 4. PortfolioAggregationFailedEvent

**Emitted When**: Portfolio aggregation completely fails  
**Aggregate**: PortfolioAggregate  
**Frequency**: On catastrophic aggregation failure

```typescript
class PortfolioAggregationFailedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly error: Error,
    public readonly sources: IntegrationSource[],
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      errorType: this.error.name,
      errorMessage: this.error.message,
      sources: this.sources
    };
  }
}
```

## Asset Events

### 5. AssetAddedToPortfolioEvent

**Emitted When**: New asset is added to portfolio  
**Aggregate**: PortfolioAggregate  
**Frequency**: Per unique asset addition

```typescript
class AssetAddedToPortfolioEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly asset: AssetEntity,
    public readonly source: IntegrationSource,
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      assetId: this.asset.id,
      symbol: this.asset.symbol,
      type: this.asset.type,
      chain: this.asset.chain,
      balance: this.asset.balance,
      value: this.asset.getValue()?.toJSON(),
      source: this.source
    };
  }
}
```

### 6. AssetMergedEvent

**Emitted When**: Duplicate assets are merged during reconciliation  
**Aggregate**: PortfolioAggregate  
**Frequency**: Per merge operation

```typescript
class AssetMergedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly primaryAsset: AssetEntity,
    public readonly mergedAsset: AssetEntity,
    public readonly resultingAsset: AssetEntity,
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      primaryAssetId: this.primaryAsset.id,
      mergedAssetId: this.mergedAsset.id,
      resultingAssetId: this.resultingAsset.id,
      symbol: this.resultingAsset.symbol,
      oldBalance: this.primaryAsset.balance.amount,
      addedBalance: this.mergedAsset.balance.amount,
      newBalance: this.resultingAsset.balance.amount
    };
  }
}
```

### 7. AssetPriceUpdatedEvent

**Emitted When**: Asset price is updated from valuation service  
**Aggregate**: PortfolioAggregate  
**Frequency**: Per price update

```typescript
class AssetPriceUpdatedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly assetId: string,
    public readonly symbol: string,
    public readonly oldPrice: Price | undefined,
    public readonly newPrice: Price,
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      assetId: this.assetId,
      symbol: this.symbol,
      oldPrice: this.oldPrice,
      newPrice: this.newPrice,
      priceChange: this.oldPrice ? 
        ((this.newPrice.value - this.oldPrice.value) / this.oldPrice.value) * 100 : null,
      source: this.newPrice.source
    };
  }
}
```

### 8. AssetRemovedFromPortfolioEvent

**Emitted When**: Asset is removed from portfolio  
**Aggregate**: PortfolioAggregate  
**Frequency**: Per asset removal

```typescript
class AssetRemovedFromPortfolioEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly assetId: string,
    public readonly symbol: string,
    public readonly reason: string,
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      assetId: this.assetId,
      symbol: this.symbol,
      reason: this.reason
    };
  }
}
```

## Reconciliation Events

### 9. PortfolioReconciliationStartedEvent

**Emitted When**: Reconciliation process begins  
**Aggregate**: PortfolioAggregate  
**Frequency**: Per reconciliation trigger

```typescript
class PortfolioReconciliationStartedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly assetCount: number,
    public readonly sources: IntegrationSource[],
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      assetCount: this.assetCount,
      sources: this.sources
    };
  }
}
```

### 10. PortfolioReconciliationCompletedEvent

**Emitted When**: Reconciliation process completes  
**Aggregate**: PortfolioAggregate  
**Frequency**: Per reconciliation completion

```typescript
class PortfolioReconciliationCompletedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly originalAssetCount: number,
    public readonly finalAssetCount: number,
    public readonly mergeCount: number,
    public readonly conflictsResolved: number,
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      originalAssetCount: this.originalAssetCount,
      finalAssetCount: this.finalAssetCount,
      mergeCount: this.mergeCount,
      conflictsResolved: this.conflictsResolved,
      deduplicationRate: 
        (this.originalAssetCount - this.finalAssetCount) / this.originalAssetCount
    };
  }
}
```

## Integration Events

### 11. IntegrationSourceConnectedEvent

**Emitted When**: Integration source successfully connects  
**Source**: Integration Repository  
**Frequency**: Per connection

```typescript
class IntegrationSourceConnectedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly source: IntegrationSource,
    public readonly connectionTime: number,
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      source: this.source,
      connectionTime: this.connectionTime
    };
  }
}
```

### 12. IntegrationSourceFailedEvent

**Emitted When**: Integration source fails to fetch data  
**Source**: Integration Repository  
**Frequency**: Per failure

```typescript
class IntegrationSourceFailedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly source: IntegrationSource,
    public readonly error: Error,
    public readonly addresses: string[],
    public readonly retryCount: number,
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      source: this.source,
      errorType: this.error.name,
      errorMessage: this.error.message,
      affectedAddresses: this.addresses.length,
      retryCount: this.retryCount
    };
  }
}
```

### 13. IntegrationSourceDataFetchedEvent

**Emitted When**: Integration source successfully fetches data  
**Source**: Integration Repository  
**Frequency**: Per successful fetch

```typescript
class IntegrationSourceDataFetchedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly source: IntegrationSource,
    public readonly assetCount: number,
    public readonly fetchDuration: number,
    public readonly addresses: string[],
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      source: this.source,
      assetCount: this.assetCount,
      fetchDuration: this.fetchDuration,
      addressCount: this.addresses.length
    };
  }
}
```

## Valuation Events

### 14. PriceEnrichmentStartedEvent

**Emitted When**: Price enrichment process begins  
**Source**: Valuation Service  
**Frequency**: Per enrichment cycle

```typescript
class PriceEnrichmentStartedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly symbols: string[],
    public readonly currency: string,
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      symbolCount: this.symbols.length,
      symbols: this.symbols.slice(0, 10), // First 10 for logging
      currency: this.currency
    };
  }
}
```

### 15. PriceEnrichmentCompletedEvent

**Emitted When**: Price enrichment completes  
**Source**: Valuation Service  
**Frequency**: Per enrichment completion

```typescript
class PriceEnrichmentCompletedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly successCount: number,
    public readonly failureCount: number,
    public readonly duration: number,
    public readonly source: string,
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRate: this.successCount / (this.successCount + this.failureCount),
      duration: this.duration,
      source: this.source
    };
  }
}
```

## Cache Events

### 16. PortfolioCacheHitEvent

**Emitted When**: Portfolio fetched from cache  
**Source**: Portfolio Repository  
**Frequency**: Per cache hit

```typescript
class PortfolioCacheHitEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly cacheAge: number,
    public readonly cacheType: 'memory' | 'storage',
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      cacheAge: this.cacheAge,
      cacheType: this.cacheType
    };
  }
}
```

### 17. PortfolioCacheMissEvent

**Emitted When**: Portfolio not found in cache  
**Source**: Portfolio Repository  
**Frequency**: Per cache miss

```typescript
class PortfolioCacheMissEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly reason: 'not_found' | 'expired' | 'invalidated',
    userId?: string
  ) {
    super(portfolioId, userId);
  }
  
  getPayload() {
    return {
      reason: this.reason
    };
  }
}
```

## Library Event Interface

### Event Emitter Integration

The service library accepts an optional event emitter that must implement this interface:

```typescript
export interface IEventEmitter {
  emit(eventType: string, event: DomainEvent): void;
  on(eventType: string, handler: (event: DomainEvent) => void): void;
  off(eventType: string, handler: (event: DomainEvent) => void): void;
  once(eventType: string, handler: (event: DomainEvent) => void): void;
}
```

### Service Event Methods

The PortfolioAggregationService exposes these event methods:

```typescript
export class PortfolioAggregationService {
  // Subscribe to events
  on(eventType: DomainEventType, handler: EventHandler): void;
  
  // Unsubscribe from events
  off(eventType: DomainEventType, handler: EventHandler): void;
  
  // One-time subscription
  once(eventType: DomainEventType, handler: EventHandler): void;
  
  // Get all emitted events (if tracking enabled)
  getEventHistory?(): DomainEvent[];
}
```

### Consumer Implementation Example

```typescript
// In @cygnus-wealth/cygnus-wealth-core or other consuming app
import { EventEmitter } from 'events';
import { DomainEvent } from '@cygnus-wealth/portfolio-aggregation';

class ApplicationEventBus extends EventEmitter {
  private eventStore: DomainEvent[] = [];
  
  constructor(private persistEvents: boolean = false) {
    super();
  }
  
  emit(eventType: string, event: DomainEvent): void {
    if (this.persistEvents) {
      this.eventStore.push(event);
      this.saveToIndexedDB(event);  // Consumer's choice of persistence
    }
    super.emit(eventType, event);
  }
  
  async getEventHistory(): Promise<DomainEvent[]> {
    return this.loadFromIndexedDB();
  }
  
  private async saveToIndexedDB(event: DomainEvent): Promise<void> {
    // Consumer implements their own persistence strategy
  }
  
  private async loadFromIndexedDB(): Promise<DomainEvent[]> {
    // Consumer implements their own loading strategy
  }
}
```

## Event Subscription Patterns in Consuming Applications

### UI State Management (React Example)

```typescript
// In @cygnus-wealth/cygnus-wealth-core
import { useEffect } from 'react';
import { usePortfolioStore } from './stores/portfolioStore';
import { aggregationService, DomainEventType } from '@cygnus-wealth/portfolio-aggregation';

function usePortfolioEvents() {
  const updatePortfolio = usePortfolioStore(state => state.updatePortfolio);
  const setLoading = usePortfolioStore(state => state.setLoading);
  const setError = usePortfolioStore(state => state.setError);
  
  useEffect(() => {
    const handlers = [
      aggregationService.on(DomainEventType.PORTFOLIO_AGGREGATION_STARTED, () => {
        setLoading(true);
      }),
      
      aggregationService.on(DomainEventType.PORTFOLIO_AGGREGATION_COMPLETED, (event) => {
        updatePortfolio(event.payload.portfolio);
        setLoading(false);
      }),
      
      aggregationService.on(DomainEventType.PORTFOLIO_AGGREGATION_FAILED, (event) => {
        setError(event.payload.error);
        setLoading(false);
      }),
      
      aggregationService.on(DomainEventType.ASSET_PRICE_UPDATED, (event) => {
        updateAssetPrice(event.payload.assetId, event.payload.newPrice);
      })
    ];
    
    // Cleanup subscriptions
    return () => {
      handlers.forEach(unsubscribe => unsubscribe());
    };
  }, []);
}
```

### Local Storage Persistence (IndexedDB)

```typescript
// Consumer application implements event persistence
class EventPersistenceHandler {
  constructor(private db: IDBDatabase) {
    this.subscribeToAllEvents();
  }
  
  private subscribeToAllEvents() {
    // Subscribe to all event types for persistence
    Object.values(DomainEventType).forEach(eventType => {
      aggregationService.on(eventType, this.persistEvent.bind(this));
    });
  }
  
  private async persistEvent(event: DomainEvent): Promise<void> {
    const tx = this.db.transaction(['events'], 'readwrite');
    const store = tx.objectStore('events');
    
    await store.add({
      ...event,
      timestamp: new Date().toISOString(),
      ttl: 7 * 24 * 60 * 60 * 1000  // 7 days retention
    });
  }
  
  async queryEvents(filters: EventFilters): Promise<DomainEvent[]> {
    // Consumer implements their own query logic
    const tx = this.db.transaction(['events'], 'readonly');
    const store = tx.objectStore('events');
    // ... query implementation
  }
}
```

### Analytics and Metrics Collection

```typescript
// Consumer tracks their own metrics
class MetricsCollector {
  constructor(private metricsService: IMetricsService) {
    this.subscribeToMetricEvents();
  }
  
  private subscribeToMetricEvents() {
    aggregationService.on(DomainEventType.PORTFOLIO_AGGREGATION_COMPLETED, (event) => {
      this.metricsService.recordMetric('portfolio.aggregation.duration', event.payload.duration);
      this.metricsService.recordMetric('portfolio.assets.count', event.payload.assetCount);
      this.metricsService.recordMetric('portfolio.value.total', event.payload.totalValue.amount);
    });
    
    aggregationService.on(DomainEventType.INTEGRATION_FAILED, (event) => {
      this.metricsService.incrementCounter('integration.failures', {
        source: event.payload.source,
        errorType: event.payload.error.name
      });
    });
  }
}
```

## Event Versioning Strategy

### Version Migration

```typescript
interface EventMigration {
  fromVersion: number;
  toVersion: number;
  migrate(event: any): any;
}

class EventVersionManager {
  private migrations = new Map<string, EventMigration[]>();
  
  registerMigration(eventType: string, migration: EventMigration): void {
    const migrations = this.migrations.get(eventType) || [];
    migrations.push(migration);
    migrations.sort((a, b) => a.fromVersion - b.fromVersion);
    this.migrations.set(eventType, migrations);
  }
  
  upgradeEvent(event: any): any {
    const migrations = this.migrations.get(event.metadata.eventType) || [];
    let currentEvent = event;
    
    for (const migration of migrations) {
      if (currentEvent.metadata.version === migration.fromVersion) {
        currentEvent = migration.migrate(currentEvent);
        currentEvent.metadata.version = migration.toVersion;
      }
    }
    
    return currentEvent;
  }
}
```

## Testing Events

### Event Testing Utilities

```typescript
class EventTestHelper {
  private dispatchedEvents: DomainEvent[] = [];
  
  captureEvents(eventBus: EventBus): void {
    eventBus.use({
      process: async (event) => {
        this.dispatchedEvents.push(event);
      }
    });
  }
  
  assertEventDispatched<T extends DomainEvent>(
    eventType: { new(...args: any[]): T },
    predicate?: (event: T) => boolean
  ): void {
    const found = this.dispatchedEvents.find(e => 
      e instanceof eventType && (!predicate || predicate(e as T))
    );
    
    if (!found) {
      throw new Error(`Event ${eventType.name} not dispatched`);
    }
  }
  
  getDispatchedEvents(): DomainEvent[] {
    return [...this.dispatchedEvents];
  }
  
  reset(): void {
    this.dispatchedEvents = [];
  }
}
```

## Library-Specific Considerations

### Performance Guidelines for Consumers

1. **Event Handler Performance**: Keep event handlers lightweight; offload heavy processing
2. **Selective Subscription**: Only subscribe to events you need to minimize overhead
3. **Memory Management**: The library doesn't store events; consumers manage their own storage
4. **Batch Processing**: Consumers can batch event processing for efficiency
5. **Debouncing**: Consider debouncing rapid events (like price updates) in the UI layer

### Security Considerations for Library Events

1. **No Sensitive Data**: The library never includes private keys or credentials in events
2. **Read-Only Events**: All events represent read-only operations
3. **Consumer Responsibility**: Event encryption/storage security is handled by consuming apps
4. **Input Validation**: All event payloads are validated before emission
5. **Immutable Payloads**: Event payloads are frozen to prevent modification

### Integration with Enterprise Architecture

As part of the CygnusWealth enterprise architecture:

1. **Upstream to Core**: Events flow from this library to @cygnus-wealth/cygnus-wealth-core
2. **No Cross-Domain Events**: This library doesn't subscribe to events from other domains
3. **Event Contracts**: Events follow the contracts defined in @cygnus-wealth/data-models
4. **Bounded Context**: Events respect bounded context boundaries
5. **No External Emission**: Events are only emitted to the provided EventEmitter, never externally