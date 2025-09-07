# Portfolio Aggregation Service Contract

## Overview

This document defines the public API contract for the `@cygnus-wealth/portfolio-aggregation` service library. This library provides portfolio orchestration and aggregation capabilities as a reusable npm package for client applications.

## Library Type

**Package**: `@cygnus-wealth/portfolio-aggregation`  
**Type**: Service Library (NPM Package)  
**Deployment**: Published to npm registry  
**Consumers**: Client applications like `@cygnus-wealth/cygnus-wealth-core`

## Dependencies

This service library depends on the following packages:

```json
{
  "@cygnus-wealth/data-models": "^1.0.0",
  "@cygnus-wealth/evm-integration": "^1.0.0",
  "@cygnus-wealth/sol-integration": "^1.0.0",
  "@cygnus-wealth/robinhood-integration": "^1.0.0",
  "@cygnus-wealth/asset-valuator": "^1.0.0"
}
```

## Public API Surface

### Core Services

#### PortfolioAggregationService

The main orchestration service that coordinates portfolio data collection.

```typescript
export class PortfolioAggregationService {
  constructor(
    integrations: IIntegrationRepository[],
    portfolioRepository: IPortfolioRepository,
    assetValuator: IAssetValuatorRepository,
    eventEmitter?: EventEmitter
  );

  // Main aggregation method
  aggregatePortfolio(params: AggregationParams): Promise<PortfolioAggregate>;
  
  // Force refresh portfolio data
  refreshPortfolio(portfolioId: string): Promise<PortfolioAggregate>;
  
  // Get cached portfolio if available
  getPortfolio(portfolioId: string): Promise<PortfolioAggregate | null>;
  
  // Event subscription
  on(event: DomainEventType, handler: EventHandler): void;
  off(event: DomainEventType, handler: EventHandler): void;
}

interface AggregationParams {
  sources: IntegrationSource[];
  addresses: Map<string, string[]>;
  userId?: string;
  forceRefresh?: boolean;
  options?: AggregationOptions;
}

interface AggregationOptions {
  includeZeroBalances?: boolean;
  enrichWithPrices?: boolean;
  cacheStrategy?: 'aggressive' | 'normal' | 'disabled';
  timeout?: number;
}
```

#### ReconciliationService

Handles asset deduplication and reconciliation.

```typescript
export class ReconciliationService {
  // Reconcile assets from multiple sources
  reconcileAssets(assets: AssetEntity[]): AssetEntity[];
  
  // Detect duplicate assets
  findDuplicates(assets: AssetEntity[]): Map<string, AssetEntity[]>;
  
  // Merge duplicate assets
  mergeAssets(primary: AssetEntity, secondary: AssetEntity): AssetEntity;
  
  // Apply reconciliation rules
  applyRules(assets: AssetEntity[], rules: ReconciliationRule[]): AssetEntity[];
}

interface ReconciliationRule {
  type: 'prefer_source' | 'sum_balances' | 'max_value';
  priority: number;
  condition?: (asset: AssetEntity) => boolean;
}
```

### Repository Interfaces

#### IIntegrationRepository

Interface that integration packages must implement.

```typescript
export interface IIntegrationRepository {
  source: IntegrationSource;
  
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Data fetching
  fetchAssets(addresses: string[]): Promise<Asset[]>;
  fetchTransactions?(addresses: string[], options?: any): Promise<Transaction[]>;
  
  // Metadata
  getSupportedChains?(): Chain[];
  getCapabilities(): IntegrationCapabilities;
}

interface IntegrationCapabilities {
  supportsRealtime: boolean;
  supportsTransactions: boolean;
  supportsNFTs: boolean;
  supportsDeFi: boolean;
  maxAddressesPerRequest: number;
  rateLimit?: RateLimit;
}
```

#### IPortfolioRepository

Interface for portfolio persistence (implemented by consuming application).

```typescript
export interface IPortfolioRepository {
  // CRUD operations
  save(portfolio: PortfolioAggregate): Promise<void>;
  findById(id: string): Promise<PortfolioAggregate | null>;
  findByUserId(userId: string): Promise<PortfolioAggregate[]>;
  delete(id: string): Promise<void>;
  
  // Cache management
  getCacheKey(params: AggregationParams): string;
  isCacheValid(portfolio: PortfolioAggregate, ttl: number): boolean;
  invalidateCache(pattern?: string): Promise<void>;
}
```

#### IAssetValuatorRepository

Interface for asset valuation services.

```typescript
export interface IAssetValuatorRepository {
  // Price fetching
  getPrice(symbol: string, currency?: string): Promise<Price>;
  getBatchPrices(symbols: string[], currency?: string): Promise<Map<string, Price>>;
  
  // Market data
  getMarketData(symbol: string): Promise<MarketData>;
  get24HourChange(symbol: string): Promise<PriceChange>;
  
  // Currency conversion
  convertValue(amount: number, from: string, to: string): Promise<number>;
  getSupportedCurrencies(): string[];
}
```

### Domain Models

#### PortfolioAggregate

Core aggregate for portfolio management.

```typescript
export class PortfolioAggregate {
  readonly id: string;
  readonly userId?: string;
  readonly assets: Map<string, AssetEntity>;
  readonly sources: IntegrationSource[];
  readonly lastUpdated: Date;
  readonly metadata: PortfolioMetadata;
  
  // Domain operations
  addAsset(asset: AssetEntity): void;
  removeAsset(assetId: string): void;
  reconcile(): void;
  getTotalValue(currency?: string): Money;
  getAssetsByChain(chain: Chain): AssetEntity[];
  getAssetsByType(type: AssetType): AssetEntity[];
  
  // Serialization
  toJSON(): PortfolioJSON;
  static fromJSON(json: PortfolioJSON): PortfolioAggregate;
}
```

#### AssetEntity

Represents a financial asset.

```typescript
export class AssetEntity {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly type: AssetType;
  readonly chain?: Chain;
  readonly balance: Balance;
  price?: Price;
  readonly metadata: AssetMetadata;
  
  // Domain operations
  getValue(currency?: string): Money | null;
  isSameAsset(other: AssetEntity): boolean;
  merge(other: AssetEntity): AssetEntity;
  updatePrice(price: Price): void;
  
  // Serialization
  toJSON(): AssetJSON;
  static fromJSON(json: AssetJSON): AssetEntity;
}
```

### Value Objects

#### Money

Immutable value object for monetary values.

```typescript
export class Money {
  readonly amount: number;
  readonly currency: string;
  
  // Operations
  add(other: Money): Money;
  subtract(other: Money): Money;
  multiply(factor: number): Money;
  divide(divisor: number): Money;
  
  // Comparison
  equals(other: Money): boolean;
  greaterThan(other: Money): boolean;
  lessThan(other: Money): boolean;
  
  // Formatting
  format(locale?: string): string;
  toJSON(): { amount: number; currency: string };
}
```

#### Address

Immutable value object for blockchain addresses.

```typescript
export class Address {
  readonly value: string;
  readonly chain: Chain;
  
  // Validation
  static isValid(address: string, chain: Chain): boolean;
  static normalize(address: string, chain: Chain): string;
  
  // Comparison
  equals(other: Address): boolean;
  toString(): string;
}
```

### Domain Events

Events emitted by the service for consuming applications to subscribe to.

```typescript
export enum DomainEventType {
  // Portfolio events
  PORTFOLIO_AGGREGATION_STARTED = 'PortfolioAggregationStarted',
  PORTFOLIO_AGGREGATION_COMPLETED = 'PortfolioAggregationCompleted',
  PORTFOLIO_AGGREGATION_FAILED = 'PortfolioAggregationFailed',
  
  // Asset events
  ASSET_ADDED = 'AssetAdded',
  ASSET_MERGED = 'AssetMerged',
  ASSET_REMOVED = 'AssetRemoved',
  ASSET_PRICE_UPDATED = 'AssetPriceUpdated',
  
  // Integration events
  INTEGRATION_CONNECTED = 'IntegrationConnected',
  INTEGRATION_FAILED = 'IntegrationFailed',
  INTEGRATION_DATA_FETCHED = 'IntegrationDataFetched',
  
  // Reconciliation events
  RECONCILIATION_STARTED = 'ReconciliationStarted',
  RECONCILIATION_COMPLETED = 'ReconciliationCompleted',
  
  // Valuation events
  PRICE_ENRICHMENT_STARTED = 'PriceEnrichmentStarted',
  PRICE_ENRICHMENT_COMPLETED = 'PriceEnrichmentCompleted'
}

export interface DomainEvent<T = any> {
  type: DomainEventType;
  aggregateId: string;
  payload: T;
  metadata: EventMetadata;
}

export interface EventMetadata {
  eventId: string;
  occurredAt: Date;
  userId?: string;
  correlationId?: string;
  version: number;
}
```

## Usage Examples

### Basic Integration

```typescript
import { 
  PortfolioAggregationService,
  IntegrationSource 
} from '@cygnus-wealth/portfolio-aggregation';

// Initialize with dependencies
const aggregationService = new PortfolioAggregationService(
  integrations,
  portfolioRepository,
  assetValuator,
  eventEmitter
);

// Aggregate portfolio
const portfolio = await aggregationService.aggregatePortfolio({
  sources: [IntegrationSource.EVM, IntegrationSource.SOLANA],
  addresses: new Map([
    ['ethereum', ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4']],
    ['solana', ['5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X']]
  ]),
  userId: 'user-123',
  options: {
    enrichWithPrices: true,
    cacheStrategy: 'normal'
  }
});
```

### Event Subscription

```typescript
// Subscribe to events
aggregationService.on(DomainEventType.PORTFOLIO_AGGREGATION_COMPLETED, (event) => {
  console.log('Portfolio aggregated:', event.payload);
  updateUI(event.payload.portfolio);
});

aggregationService.on(DomainEventType.INTEGRATION_FAILED, (event) => {
  console.error('Integration failed:', event.payload.source, event.payload.error);
  showErrorNotification(event.payload);
});

aggregationService.on(DomainEventType.ASSET_PRICE_UPDATED, (event) => {
  console.log('Price updated:', event.payload.symbol, event.payload.newPrice);
  updateAssetPrice(event.payload);
});
```

### Custom Integration Implementation

```typescript
import { IIntegrationRepository, IntegrationSource, Asset } from '@cygnus-wealth/portfolio-aggregation';

class CustomIntegration implements IIntegrationRepository {
  source = IntegrationSource.CUSTOM;
  
  async connect(): Promise<void> {
    // Initialize connection
  }
  
  async disconnect(): Promise<void> {
    // Cleanup connection
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  async fetchAssets(addresses: string[]): Promise<Asset[]> {
    // Fetch and transform assets
    return assets;
  }
  
  getCapabilities() {
    return {
      supportsRealtime: false,
      supportsTransactions: true,
      supportsNFTs: false,
      supportsDeFi: true,
      maxAddressesPerRequest: 10
    };
  }
}
```

### Custom Repository Implementation

```typescript
import { IPortfolioRepository, PortfolioAggregate } from '@cygnus-wealth/portfolio-aggregation';

class IndexedDBPortfolioRepository implements IPortfolioRepository {
  async save(portfolio: PortfolioAggregate): Promise<void> {
    // Save to IndexedDB
    const db = await this.openDB();
    const tx = db.transaction('portfolios', 'readwrite');
    await tx.objectStore('portfolios').put(portfolio.toJSON());
  }
  
  async findById(id: string): Promise<PortfolioAggregate | null> {
    // Load from IndexedDB
    const db = await this.openDB();
    const data = await db.get('portfolios', id);
    return data ? PortfolioAggregate.fromJSON(data) : null;
  }
  
  async findByUserId(userId: string): Promise<PortfolioAggregate[]> {
    // Query by user ID
    const db = await this.openDB();
    const portfolios = await db.getAllFromIndex('portfolios', 'userId', userId);
    return portfolios.map(p => PortfolioAggregate.fromJSON(p));
  }
  
  // ... other methods
}
```

## Error Handling

The service uses typed errors for different failure scenarios:

```typescript
export class AggregationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly source?: IntegrationSource,
    public readonly recoverable: boolean = true
  ) {
    super(message);
  }
}

export class IntegrationError extends AggregationError {
  constructor(
    message: string,
    source: IntegrationSource,
    public readonly originalError?: Error
  ) {
    super(message, 'INTEGRATION_ERROR', source);
  }
}

export class ReconciliationError extends AggregationError {
  constructor(
    message: string,
    public readonly conflicts: AssetConflict[]
  ) {
    super(message, 'RECONCILIATION_ERROR');
  }
}

export class ValidationError extends AggregationError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, 'VALIDATION_ERROR', undefined, false);
  }
}
```

## Performance Considerations

### Caching Strategy

The service supports multiple caching strategies:

1. **Aggressive**: Cache for 15 minutes, serve stale while revalidating
2. **Normal**: Cache for 5 minutes, fetch fresh on expiry
3. **Disabled**: Always fetch fresh data

### Parallel Processing

- All integration sources are queried in parallel
- Price enrichment uses batch APIs
- Failures in one source don't block others (partial results)

### Memory Management

- Large portfolios are paginated
- Asset collections use Maps for O(1) lookups
- Event listeners are automatically cleaned up

## Versioning

This library follows semantic versioning:

- **Major**: Breaking changes to public API
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, no API changes

### Migration Guide

When upgrading major versions, consult the migration guide for breaking changes:

```typescript
// v1.x
const portfolio = await service.aggregatePortfolio(addresses, sources);

// v2.x (breaking change example)
const portfolio = await service.aggregatePortfolio({
  addresses,
  sources,
  options: { /* new options */ }
});
```

## Security Considerations

1. **No Private Keys**: This library never handles private keys
2. **Read-Only**: All operations are read-only
3. **Input Validation**: All addresses and inputs are validated
4. **No External Calls**: Library doesn't make direct network calls
5. **Dependency Security**: All dependencies are from @cygnus-wealth org

## Browser Compatibility

This library is designed for modern browsers:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Required browser features:
- ES2020 support
- Map/Set collections
- Promise/async-await
- EventTarget or EventEmitter polyfill

## Support

For issues and questions:
- GitHub Issues: https://github.com/cygnus-wealth/portfolio-aggregation/issues
- Documentation: https://docs.cygnus-wealth.com/portfolio-aggregation