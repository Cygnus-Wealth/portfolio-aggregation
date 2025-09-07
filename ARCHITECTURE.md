# Portfolio Aggregation Bounded Context Architecture

## Overview

The Portfolio Aggregation bounded context is a **service library** (`@cygnus-wealth/portfolio-aggregation`) that orchestrates data collection from multiple blockchain and traditional financial sources, combining them into a unified portfolio view. This bounded context implements **Hexagonal Architecture** within the CygnusWealth enterprise domain structure.

**Package**: `@cygnus-wealth/portfolio-aggregation`  
**Type**: Service Library (NPM Package)  
**Domain**: Portfolio Management (Core Domain)  
**Repository**: `https://github.com/cygnus-wealth/portfolio-aggregation`

## Enterprise Context

This bounded context operates within the CygnusWealth enterprise architecture:

### Domain Classification
- **Strategic Domain**: Portfolio Domain
- **Bounded Context**: portfolio-aggregation
- **Type**: Service library consumed by client applications
- **Core Responsibilities**: Data orchestration, portfolio composition, asset deduplication, reconciliation

### Dependencies
- **Upstream Dependencies** (Consuming this library):
  - `@cygnus-wealth/cygnus-wealth-app` - Main web application
  - Future client applications

- **Downstream Dependencies** (This library depends on):
  - `@cygnus-wealth/data-models` - Shared contracts and data structures
  - `@cygnus-wealth/evm-integration` - EVM blockchain data
  - `@cygnus-wealth/sol-integration` - Solana blockchain data
  - `@cygnus-wealth/robinhood-integration` - Traditional finance data
  - `@cygnus-wealth/asset-valuator` - Pricing and valuation services

## Architectural Principles

### Hexagonal Architecture (Ports and Adapters)

This bounded context implements hexagonal architecture to maintain clean separation between business logic and external dependencies:

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SYSTEMS                        │
├─────────────────────────────────────────────────────────────────┤
│  EVM Chain    │  Solana     │  Robinhood   │  Price APIs      │
│  RPC Nodes    │  RPC Nodes  │  API         │  CoinGecko       │
└─────────────┬───────────────┬──────────────┬───────────────────┘
              │               │              │
         ┌────▼────┐    ┌─────▼─────┐   ┌────▼────┐
         │ EVM     │    │ Solana    │   │ Asset   │
         │ Adapter │    │ Adapter   │   │ Valuator│
         └────┬────┘    └─────┬─────┘   │ Adapter │
              │               │         └────┬────┘
              │        ┌──────┴──────┐       │
              │        │ Integration │       │
              │        │    Ports    │       │
              │        └──────┬──────┘       │
              │               │              │
┌─────────────┴───────────────┴──────────────┴─────────────────────┐
│                      APPLICATION CORE                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    DOMAIN LAYER                             │ │
│ │ ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │ │
│ │ │ Portfolio   │  │   Asset     │  │    Domain Events    │  │ │
│ │ │ Aggregate   │  │  Entity     │  │  ┌───────────────┐  │  │ │
│ │ └─────────────┘  └─────────────┘  │  │Portfolio      │  │  │ │
│ │                                   │  │Events         │  │  │ │
│ │ ┌─────────────┐  ┌─────────────┐  │  └───────────────┘  │  │ │
│ │ │   Money     │  │  Address    │  │  ┌───────────────┐  │  │ │
│ │ │Value Object │  │Value Object │  │  │Asset Events   │  │  │ │
│ │ └─────────────┘  └─────────────┘  │  └───────────────┘  │  │ │
│ │                                   └─────────────────────┘  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                 APPLICATION LAYER                           │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │            PortfolioAggregationService                  │ │ │
│ │ │  ┌─────────────────┐  ┌─────────────────────────────┐  │ │ │
│ │ │  │  Integration    │  │    Portfolio Orchestration │  │ │ │
│ │ │  │  Coordination   │  │    & Event Management      │  │ │ │
│ │ │  └─────────────────┘  └─────────────────────────────┘  │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                           │                    │
         ▼                           ▼                    ▼
┌─────────────────┐       ┌─────────────────┐   ┌─────────────────┐
│   Portfolio     │       │  Persistence    │   │   Event Bus     │
│  Repository     │       │   Adapters      │   │   Subscribers   │
│     Port        │       │  (Consumer)     │   │   (Consumer)    │
└─────────────────┘       └─────────────────┘   └─────────────────┘
```

### Dependency Flow

All dependencies point **inward** toward the domain core, following the dependency inversion principle:
- **Infrastructure** depends on **Application** and **Domain**
- **Application** depends on **Domain**
- **Domain** has no external dependencies
- **Consuming Applications** depend on this library's public interface

This ensures:
- Business logic remains pure and testable
- Easy substitution of external integrations
- Clear boundaries and contracts
- Library can be consumed by multiple applications

## Bounded Context Scope

### What This Bounded Context Owns
- Portfolio aggregation logic and orchestration strategies
- Cross-source asset reconciliation and deduplication rules
- Portfolio calculation algorithms and business rules
- Aggregation-specific caching policies
- Domain events for portfolio lifecycle

### What This Bounded Context Doesn't Own
- Direct blockchain/API connections (delegated to integration packages)
- UI components and user interactions (owned by consuming applications)
- Price data discovery algorithms (owned by asset-valuator)
- Data model definitions (shared via data-models package)
- User authentication and session management
- Browser storage management (handled by consuming applications)

### Context Boundaries and Anti-Corruption Layers

This bounded context maintains strict boundaries through:

1. **Integration Repository Pattern**: All external data sources accessed through `IIntegrationRepository` interface
2. **Repository Abstraction**: Persistence delegated to consuming applications via `IPortfolioRepository`
3. **Value Object Translation**: External data transformed to domain models at boundaries
4. **Event Emission**: Domain events emitted to consuming applications through provided event emitter

## Ubiquitous Language

**Portfolio**: A collection of financial assets owned by a user across multiple sources and chains

**Asset**: A financial instrument with a balance, including tokens, NFTs, stocks, or DeFi positions

**Aggregation**: The process of collecting and combining assets from multiple sources into a unified view

**Reconciliation**: The process of identifying and merging duplicate assets from different sources

**Reconciliation Rules**: Standardized approach to handle same asset from multiple sources:
- Prefer on-chain data over CEX data  
- Use most recently updated source for pricing
- Sum quantities across sources for total holdings

**Integration Source**: An external system that provides asset data (EVM chains, Solana, Robinhood)

**Valuation**: The process of determining current market value for assets

**Deduplication**: Identifying and merging assets that represent the same underlying instrument

**Chain**: A blockchain network (Ethereum, Polygon, Solana, etc.)

**Balance**: The quantity of an asset held, with decimal precision

**Price**: Current market value per unit of an asset in a specific currency

## Module Structure

### Domain Layer (`src/domain/`)

**Purpose**: Contains pure business logic, entities, value objects, and domain events.

```
src/domain/
├── aggregates/
│   └── Portfolio.ts           # Portfolio aggregate root
├── entities/
│   └── Asset.ts              # Asset entity
├── value-objects/
│   ├── Money.ts              # Money value object
│   └── Address.ts            # Address value object
├── events/
│   ├── DomainEvent.ts        # Base domain event
│   ├── EventBus.ts           # In-process event bus
│   └── portfolio/
│       ├── PortfolioEvents.ts # Portfolio-specific events
│       └── AssetEvents.ts     # Asset-specific events
└── services/
    ├── AssetReconciliationService.ts  # Domain service
    └── PortfolioValuationService.ts   # Domain service
```

**Key Components:**

#### PortfolioAggregate
- **Purpose**: Central consistency boundary for portfolio state management
- **Identity**: Portfolio ID (string)
- **Invariants**:
  - A portfolio must have at least one source when it contains assets
  - Asset deduplication must be maintained within a portfolio
  - Total value must equal the sum of all asset values
  - Last updated timestamp must reflect the most recent modification
- **Key Behaviors**: `addAsset()`, `reconcile()`, `getTotalValue()`, `mergePortfolio()`

#### AssetEntity
- **Purpose**: Represents individual financial assets with balance, price, and metadata
- **Identity**: Asset ID (string)
- **Characteristics**: Mutable balance and price, can be merged with similar assets, maintains source metadata
- **Key Behaviors**: `getValue()`, `isSameAsset()`, `merge()`, `updatePrice()`

#### Value Objects
- **Money**: Immutable monetary value with currency validation and arithmetic operations
- **Address**: Immutable blockchain address with chain-specific validation

#### Domain Events
- **Portfolio Events**: PortfolioAggregated, PortfolioReconciled, etc.
- **Asset Events**: AssetAdded, AssetMerged, AssetPriceUpdated, etc.
- **Integration Events**: IntegrationFailed, DataFetched, etc.

#### Domain Services
- **AssetReconciliationService**: Complex logic for identifying and merging duplicate assets
- **PortfolioValuationService**: Business rules for portfolio value calculations

### Application Layer (`src/application/`)

**Purpose**: Orchestrates domain objects and coordinates with external systems through ports.

```
src/application/
├── services/
│   ├── PortfolioAggregationService.ts  # Main orchestration service
│   ├── AddressRegistryService.ts       # Address management service
│   └── SyncOrchestratorService.ts      # Sync coordination service
├── use-cases/
│   ├── AggregatePortfolioUseCase.ts    # Portfolio aggregation use case
│   └── RefreshPortfolioUseCase.ts      # Portfolio refresh use case
├── commands/
│   ├── AggregatePortfolioCommand.ts    # Command for portfolio aggregation
│   ├── RefreshSourceCommand.ts         # Command for source refresh
│   └── AddAddressCommand.ts            # Command for adding addresses
└── events/
    └── ApplicationEventHandlers.ts     # Application event handlers
```

**Key Components:**

#### Required Architectural Services

##### PortfolioAggregationService
- **Purpose**: Primary service orchestrating data fetching, reconciliation, and caching
- **Responsibilities**:
  - Fetches data from all configured sources
  - Applies reconciliation and deduplication
  - Returns unified portfolio
  - Implements partial failure strategy

##### AddressRegistryService  
- **Purpose**: Manages which addresses to track per blockchain/integration
- **Responsibilities**:
  - Manages addresses to track per chain
  - Stores user labels and metadata for addresses
  - Provides address discovery capabilities
  - Validates addresses for each chain type

##### SyncOrchestratorService
- **Purpose**: Coordinates refresh cycles and manages rate limiting
- **Responsibilities**:
  - Coordinates refresh cycles across sources
  - Manages rate limiting for each integration
  - Implements retry logic with exponential backoff
  - Tracks sync state and metrics

#### Architectural Patterns

##### Command Pattern
All state-changing operations follow command pattern:
- **AggregatePortfolioCommand**: Initiates portfolio aggregation
- **RefreshSourceCommand**: Refreshes specific integration source
- **AddAddressCommand**: Adds new address to track

##### Observer Pattern
Event-driven notifications for portfolio updates:
- **PortfolioUpdatedEvent**: Emitted when portfolio changes
- **SourceSyncCompletedEvent**: Emitted when source sync completes
- **ErrorOccurredEvent**: Emitted on errors

##### Circuit Breaker Pattern
Handles failing integrations gracefully:
- Tracks failure rates per integration
- Temporarily skips failing integrations
- Automatic recovery attempts with backoff
- Configurable failure thresholds and recovery times

### Infrastructure Layer (`src/infrastructure/`)

**Purpose**: Implements adapters for external systems and provides technical capabilities.

```
src/infrastructure/
├── repositories/
│   ├── BrowserPortfolioRepository.ts   # IndexedDB implementation
│   ├── FileSystemPortfolioRepository.ts # Node.js filesystem implementation
│   └── InMemoryPortfolioRepository.ts  # Testing/development implementation
├── adapters/
│   ├── CoinGeckoValuatorAdapter.ts     # Price data adapter
│   └── CacheAdapter.ts                 # Caching implementation
├── integrations/
│   ├── EVMIntegrationAdapter.ts        # EVM blockchain adapter
│   ├── SolanaIntegrationAdapter.ts     # Solana blockchain adapter
│   └── RobinhoodIntegrationAdapter.ts  # Traditional finance adapter
└── config/
    ├── EnvironmentConfig.ts            # Environment configuration
    └── DIContainer.ts                  # Dependency injection container
```

**Key Components:**

- **Repository Implementations**: Environment-specific persistence adapters
- **Integration Adapters**: Anti-corruption layers for external data sources
- **Configuration**: Environment setup and dependency wiring

### Contracts Layer (`src/contracts/`)

**Purpose**: Defines interfaces (ports) for external dependencies.

```
src/contracts/
└── repositories/
    ├── IIntegrationRepository.ts      # Integration source interface
    ├── IPortfolioRepository.ts        # Portfolio persistence interface
    └── IAssetValuatorRepository.ts    # Asset valuation interface
```

### Shared Layer (`src/shared/`)

**Purpose**: Common types, utilities, and cross-cutting concerns.

```
src/shared/
├── types/
│   └── index.ts                       # Common type definitions
├── config/
│   └── types.ts                       # Configuration type definitions
├── utils/
│   ├── AddressValidator.ts            # Address validation utilities
│   └── AssetDeduplication.ts          # Asset deduplication logic
└── constants/
    └── Chains.ts                      # Blockchain constants
```

## Integration Points and Adapters

### Integration Repository Pattern

Each external data source is accessed through the `IIntegrationRepository` interface:

```typescript
interface IIntegrationRepository {
  readonly source: IntegrationSource;
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  fetchAssets(addresses: string[]): Promise<Asset[]>;
  fetchTransactions?(addresses: string[], limit?: number): Promise<Transaction[]>;
}
```

### Anti-Corruption Layer

Each integration adapter translates external data formats to domain models:

```typescript
// EVM Integration Adapter
export class EVMIntegrationAdapter implements IIntegrationRepository {
  async fetchAssets(addresses: string[]): Promise<Asset[]> {
    const rawData = await this.provider.getBalance(address);
    
    // Anti-corruption: translate external format to domain format
    return this.translateToAsset({
      balance: ethers.formatEther(rawData),
      symbol: 'ETH',
      decimals: 18
    });
  }
  
  private translateToAsset(externalData: any): Asset {
    // Transform external blockchain data to domain Asset
    return {
      id: generateAssetId(this.source, externalData),
      symbol: externalData.symbol,
      balance: {
        amount: parseFloat(externalData.balance),
        decimals: externalData.decimals,
        formatted: externalData.balance
      },
      metadata: {
        source: this.source,
        fetchedAt: new Date().toISOString()
      }
    };
  }
}
```

## Service Contract and Public API

### Primary Services

#### PortfolioAggregationService

```typescript
export class PortfolioAggregationService {
  constructor(
    integrations: Map<string, IIntegrationRepository>,
    portfolioRepository: IPortfolioRepository,
    assetValuator: IAssetValuatorRepository,
    eventEmitter?: IEventEmitter
  );

  // Main aggregation method
  aggregatePortfolio(params: AggregationParams): Promise<PortfolioAggregate>;
  
  // Force refresh portfolio data
  refreshPortfolio(portfolioId: string): Promise<PortfolioAggregate>;
  
  // Get cached portfolio if available
  getPortfolio(portfolioId: string): Promise<PortfolioAggregate | null>;
  
  // Event subscription
  on(event: DomainEventType, handler: EventHandler): () => void;
  off(event: DomainEventType, handler: EventHandler): void;
}

interface AggregationParams {
  addresses: Map<string, string[]>; // chain -> addresses
  sources: IntegrationSource[];
  userId?: string;
  forceRefresh?: boolean;
  options?: AggregationOptions;
}
```

#### AddressRegistryService

```typescript
export class AddressRegistryService {
  constructor(
    addressRepository: IAddressRepository,
    eventEmitter?: IEventEmitter
  );

  // Address management
  addAddress(chain: string, address: string, metadata?: AddressMetadata): Promise<void>;
  removeAddress(chain: string, address: string): Promise<void>;
  updateAddressMetadata(chain: string, address: string, metadata: AddressMetadata): Promise<void>;
  
  // Address retrieval
  getAddresses(chain?: string): Promise<Map<string, AddressEntry[]>>;
  getAddressByLabel(label: string): Promise<AddressEntry | null>;
  
  // Address discovery
  discoverAddresses(walletConnection: WalletConnection): Promise<AddressEntry[]>;
  
  // Address validation
  validateAddress(chain: string, address: string): Promise<boolean>;
}

interface AddressMetadata {
  label?: string;
  tags?: string[];
  source?: 'manual' | 'wallet' | 'discovered';
  addedAt?: Date;
}
```

#### SyncOrchestratorService

```typescript
export class SyncOrchestratorService {
  constructor(
    integrations: Map<string, IIntegrationRepository>,
    rateLimiter: IRateLimiter,
    circuitBreaker: ICircuitBreaker,
    eventEmitter?: IEventEmitter
  );

  // Sync orchestration
  orchestrateSync(sources: IntegrationSource[]): Promise<SyncResult>;
  scheduleSyncCycle(interval: number): () => void;
  
  // Rate limiting
  configureRateLimit(source: IntegrationSource, config: RateLimitConfig): void;
  
  // Circuit breaker
  configureCircuitBreaker(source: IntegrationSource, config: CircuitBreakerConfig): void;
  getCircuitState(source: IntegrationSource): CircuitState;
  
  // Retry logic
  retryFailedSource(source: IntegrationSource): Promise<void>;
  
  // Metrics
  getSyncMetrics(): SyncMetrics;
}

interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit?: number;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenRetries: number;
}
```

### Repository Interfaces (Ports)

Consumers must provide implementations for:

#### IIntegrationRepository
```typescript
export interface IIntegrationRepository {
  readonly source: IntegrationSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  fetchAssets(addresses: string[]): Promise<Asset[]>;
  fetchTransactions?(addresses: string[], options?: any): Promise<Transaction[]>;
}
```

#### IPortfolioRepository
```typescript
export interface IPortfolioRepository {
  save(portfolio: PortfolioAggregate): Promise<void>;
  findById(id: string): Promise<PortfolioAggregate | null>;
  findByUserId(userId: string): Promise<PortfolioAggregate[]>;
  delete(id: string): Promise<void>;
  getCacheKey(params: AggregationParams): string;
  isCacheValid(portfolio: PortfolioAggregate, ttl: number): boolean;
  invalidateCache(pattern?: string): Promise<void>;
}
```

#### IAddressRepository
```typescript
export interface IAddressRepository {
  save(chain: string, address: string, metadata: AddressMetadata): Promise<void>;
  remove(chain: string, address: string): Promise<void>;
  findByChain(chain: string): Promise<AddressEntry[]>;
  findAll(): Promise<Map<string, AddressEntry[]>>;
  findByLabel(label: string): Promise<AddressEntry | null>;
  update(chain: string, address: string, metadata: Partial<AddressMetadata>): Promise<void>;
  clear(): Promise<void>;
}
```

#### IAssetValuatorRepository
```typescript
export interface IAssetValuatorRepository {
  getPrice(symbol: string, currency?: string): Promise<Price>;
  getBatchPrices(symbols: string[], currency?: string): Promise<Map<string, Price>>;
  getMarketData(symbol: string): Promise<MarketData>;
  convertValue(amount: number, from: string, to: string): Promise<number>;
}
```

### Domain Events Contract

The library emits domain events that consuming applications can subscribe to:

```typescript
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
  PORTFOLIO_RECONCILIATION_COMPLETED = 'PortfolioReconciliationCompleted'
}
```

## Usage Examples

### Basic Usage in Consumer Application

```typescript
import { 
  PortfolioAggregationService,
  PortfolioServiceFactory 
} from '@cygnus-wealth/portfolio-aggregation';
import { createEVMAdapter } from '@cygnus-wealth/evm-integration';
import { createSolanaAdapter } from '@cygnus-wealth/sol-integration';

// Setup integrations
const integrations = new Map();
integrations.set('evm', createEVMAdapter({
  rpcUrl: 'https://eth.llamarpc.com'
}));
integrations.set('solana', createSolanaAdapter({
  rpcUrl: 'https://api.mainnet-beta.solana.com'
}));

// Create service
const service = PortfolioServiceFactory.create({
  integrations,
  portfolioRepository: new MyPortfolioRepository(),
  assetValuator: new MyAssetValuator()
});

// Subscribe to events
service.on(DomainEventType.PORTFOLIO_AGGREGATION_COMPLETED, (event) => {
  console.log('Portfolio updated:', event.payload);
  updateUI(event.payload.portfolio);
});

// Aggregate portfolio
const portfolio = await service.aggregatePortfolio({
  addresses: new Map([
    ['ethereum', ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4']],
    ['solana', ['5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X']]
  ]),
  sources: ['evm', 'solana'],
  userId: 'user-123'
});
```

## Event-Driven Architecture

### Domain Events Flow

Events flow from this library to consuming applications:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Domain        │───▶│   Event Bus      │───▶│   Consumer      │
│   Operations    │    │   (Provided by   │    │   Application   │
│   (Library)     │    │    Consumer)     │    │   Handlers      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Event Processing Strategy

- **Synchronous**: Domain events within transaction boundaries
- **Asynchronous**: Integration events to external subscribers
- **Optional**: Event emission through provided EventEmitter interface
- **Consumers Control**: Persistence, storage, and further propagation

### Event Integration Pattern

```typescript
// Consumer provides EventEmitter during service initialization
import { EventEmitter } from 'events';

const eventBus = new EventEmitter();
const service = new PortfolioAggregationService(
  integrations,
  repository,
  valuator,
  eventBus  // Optional: if not provided, events won't be emitted
);

// Consumer subscribes to events
service.on(DomainEventType.PORTFOLIO_AGGREGATION_COMPLETED, (event) => {
  // Consumer handles event (UI updates, persistence, analytics, etc.)
  handlePortfolioUpdate(event.payload);
  saveToAuditLog(event);
});
```

## Browser Compatibility and Bundle Optimization

### Target Environments

- **Browsers**: ES2020+ (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- **Node.js**: Version 16+
- **Module Systems**: ESM primary, CommonJS compatibility

### Bundle Optimization Strategies

#### Tree Shaking Support
```typescript
// src/index.ts - Explicit named exports for tree shaking
export { PortfolioAggregationService } from './application/services/PortfolioAggregationService';
export { PortfolioAggregate } from './domain/aggregates/Portfolio';
export type { IIntegrationRepository } from './contracts/repositories/IIntegrationRepository';
```

#### Code Splitting
```typescript
// Lazy loading of integration adapters
const loadEVMIntegration = () => import('@cygnus-wealth/evm-integration');
const loadSolanaIntegration = () => import('@cygnus-wealth/sol-integration');

// Dynamic adapter registration
async function registerIntegration(source: string) {
  switch (source) {
    case 'evm':
      const evmModule = await loadEVMIntegration();
      return evmModule.createAdapter();
    // ...
  }
}
```

#### External Dependencies
```typescript
// vite.config.library.ts
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        // Mark integration packages as external to avoid bundling
        '@cygnus-wealth/evm-integration',
        '@cygnus-wealth/sol-integration',
        '@cygnus-wealth/robinhood-integration',
        '@cygnus-wealth/asset-valuator'
      ]
    }
  }
});
```

#### Bundle Size Targets
- **Core library**: < 50KB gzipped
- **With common integrations**: < 200KB gzipped
- **Individual adapters**: < 30KB gzipped each

### Browser-Specific Implementations

#### IndexedDB Repository
```typescript
export class BrowserPortfolioRepository implements IPortfolioRepository {
  private db: IDBDatabase | null = null;
  
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CygnusPortfolio', 1);
      // IndexedDB setup...
    });
  }
}
```

#### Web Workers Support
```typescript
// Optional: Offload heavy computation to Web Workers
export class WebWorkerAssetProcessor {
  private worker: Worker | null = null;
  
  async processPortfolio(assets: Asset[]): Promise<ProcessedPortfolio> {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./asset-worker.ts', import.meta.url));
      return this.processInWorker(assets);
    }
    
    // Fallback to main thread
    return this.processInMainThread(assets);
  }
}
```

## Testing Strategy for Service Library

### Test Architecture

```
src/tests/
├── unit/                              # Fast, isolated tests
│   ├── domain/
│   │   ├── aggregates/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   └── services/
│   ├── application/
│   │   └── services/
│   └── infrastructure/
│       ├── adapters/
│       └── repositories/
├── integration/                       # Cross-boundary tests
│   ├── ServiceLibraryIntegration.test.ts
│   ├── EventBusIntegration.test.ts
│   └── RepositoryIntegration.test.ts
├── e2e/                              # Full service tests
│   ├── PortfolioAggregation.e2e.test.ts
│   └── MultiSourceIntegration.e2e.test.ts
├── mocks/                            # Test doubles
│   ├── MockIntegrationRepository.ts
│   ├── InMemoryPortfolioRepository.ts
│   └── MockAssetValuator.ts
└── helpers/
    ├── TestDataBuilder.ts            # Test data creation
    └── ServiceTestHelpers.ts         # Service setup helpers
```

### Test Categories

#### Unit Tests (Domain Focus)
```typescript
// Test domain logic in isolation
describe('PortfolioAggregate', () => {
  it('should merge duplicate assets correctly', () => {
    const portfolio = new PortfolioAggregate({ id: 'test', userId: 'user' });
    const asset1 = createTestAsset({ symbol: 'ETH', balance: 1.0 });
    const asset2 = createTestAsset({ symbol: 'ETH', balance: 2.0 });
    
    portfolio.addAsset(asset1);
    portfolio.addAsset(asset2);
    
    expect(portfolio.assets).toHaveLength(1);
    expect(portfolio.assets[0].balance.amount).toBe(3.0);
  });
});
```

#### Integration Tests (Service Layer)
```typescript
// Test service with real adapters but controlled data
describe('Portfolio Service Integration', () => {
  let service: PortfolioAggregationService;
  
  beforeEach(() => {
    const integrations = new Map();
    integrations.set('mock-evm', new MockIntegrationRepository());
    
    service = PortfolioServiceFactory.create({
      integrations,
      portfolioRepository: new InMemoryPortfolioRepository(),
      assetValuator: new MockAssetValuator()
    });
  });
  
  it('should aggregate from multiple sources', async () => {
    const result = await service.aggregatePortfolio({
      addresses: new Map([['ethereum', ['0x123']]]),
      sources: ['mock-evm']
    });
    
    expect(result.assets.length).toBeGreaterThan(0);
  });
});
```

#### E2E Tests (External Dependencies)
```typescript
// Test with actual external services (optional, slower)
describe('Portfolio E2E', () => {
  it('should fetch real data from test networks', async () => {
    const service = await createRealService({
      evmRpcUrl: 'https://eth-goerli.public.blastapi.io',
      solanaRpcUrl: 'https://api.devnet.solana.com'
    });
    
    const portfolio = await service.aggregatePortfolio({
      addresses: new Map([
        ['ethereum', [TEST_ETHEREUM_ADDRESS]],
        ['solana', [TEST_SOLANA_ADDRESS]]
      ])
    });
    
    expect(portfolio).toBeDefined();
  });
});
```

### Consumer Testing Support

#### Test Helpers Export
```typescript
// Export test utilities for consuming applications
export * from './testing/TestHelpers';
export * from './testing/MockImplementations';

// Allow consumers to create test services easily
export class TestServiceFactory {
  static createMockService(overrides?: Partial<ServiceConfig>) {
    return PortfolioServiceFactory.create({
      integrations: new Map([
        ['test', new MockIntegrationRepository()]
      ]),
      portfolioRepository: new InMemoryPortfolioRepository(),
      assetValuator: new MockAssetValuator(),
      ...overrides
    });
  }
}
```

#### Test Configuration
```typescript
// vitest.config.ts - Library testing configuration
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
    coverage: {
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'src/tests/**',
        'src/**/*.test.ts',
        'src/examples/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    }
  }
});
```

## Event-Driven Architecture

### Domain Events Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Domain        │───▶│   Event Bus      │───▶│   External      │
│   Operations    │    │                  │    │   Subscribers   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Asset Added     │    │ Portfolio        │    │ Price Updates   │
│ Asset Merged    │    │ Aggregation      │    │ Notifications   │
│ Price Updated   │    │ Started/Complete │    │ Analytics       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Event Processing Strategy

- **Synchronous**: Domain events within transaction boundaries
- **Asynchronous**: Integration events and external notifications
- **Reliable**: Event persistence for critical business events
- **Scalable**: Event bus supports multiple subscribers

### Consumer Event Integration

```typescript
// Consuming applications can subscribe to service events
const portfolioService = new PortfolioAggregationService(config);
const eventSubscriptions = new PortfolioServiceEventSubscriptions(portfolioService.eventBus);

// Subscribe to aggregation lifecycle
const unsubscribe = eventSubscriptions.onAllPortfolioEvents({
  onStarted: (event) => updateUI({ status: 'loading' }),
  onCompleted: (event) => updateUI({ 
    status: 'complete',
    totalValue: event.totalValue,
    assetCount: event.assetCount
  }),
  onFailed: (event) => updateUI({ 
    status: 'error',
    error: event.error.message
  })
});

// Clean up subscriptions
window.addEventListener('beforeunload', unsubscribe);
```

## Performance and Scalability

### Caching Architecture

#### Multi-Layer Caching Strategy
1. **L1 Cache (Memory)**: Hot data for current session
   - TTL: 5 minutes for price data, 15 minutes for portfolio data
   - Size limit: 100MB max
   - Eviction: LRU (Least Recently Used)

2. **L2 Cache (Local Storage)**: Persistent cache across sessions  
   - TTL: 1 hour for portfolio data, 24 hours for historical data
   - Size limit: Configured by consumer application
   - Encryption: Optional, configured by consumer

3. **Stale-While-Revalidate Pattern**
   - Serve cached data immediately while fetching updates
   - Background refresh for frequently accessed data
   - Graceful degradation with stale data on failures

#### Cache Implementation Patterns

##### Stale-While-Revalidate
```typescript
interface StaleWhileRevalidateOptions {
  staleTime: number;      // Time before data is considered stale
  cacheTime: number;      // Time before cache is cleared
  backgroundRefresh: boolean;  // Enable background updates
}
```

##### Delta Synchronization
- Track last sync timestamp per source
- Fetch only changed data where supported
- Merge deltas with existing portfolio state
- Reduce bandwidth and processing overhead

### Parallel Processing
- **Concurrent Integration Calls**: Promise.allSettled for multiple sources
- **Async Event Processing**: Non-blocking event handlers
- **Background Refresh**: Optional background portfolio updates
- **Worker Thread Support**: Heavy computations offloaded to Web Workers

### Memory Management
- **Weak References**: For event subscribers cleanup
- **Asset Pooling**: Reuse asset objects where possible
- **Garbage Collection**: Explicit cleanup methods for long-running instances
- **Memory Limits**: Configurable thresholds with automatic cleanup

## Error Handling

### Error Handling Strategy

#### Partial Failure Strategy
- Continue aggregation even if individual sources fail
- Mark failed sources in response metadata
- Cache last known good data for failed sources
- Return available data with error context

#### Circuit Breaker Implementation
- Track failure rates per integration
- Open circuit after threshold failures
- Temporarily skip failing integrations
- Automatic recovery attempts with exponential backoff

### Typed Error Hierarchy

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

export class CircuitBreakerError extends AggregationError {
  constructor(
    message: string,
    source: IntegrationSource,
    public readonly retryAfter: Date
  ) {
    super(message, 'CIRCUIT_BREAKER_OPEN', source, false);
  }
}
```

## Testing Strategy

### Library Testing Approach

```
src/tests/
├── unit/                              # Fast, isolated tests
│   ├── domain/                        # Domain logic tests
│   ├── application/                   # Service layer tests
│   └── infrastructure/                # Adapter tests
├── integration/                       # Cross-boundary tests
│   ├── ServiceLibraryIntegration.test.ts
│   └── EventBusIntegration.test.ts
├── e2e/                              # Full service tests
│   └── PortfolioAggregation.e2e.test.ts
├── mocks/                            # Test doubles
│   ├── MockIntegrationRepository.ts
│   └── InMemoryPortfolioRepository.ts
└── helpers/
    └── TestDataBuilder.ts            # Test data creation
```

### Consumer Testing Support

```typescript
// Export test utilities for consuming applications
export class TestServiceFactory {
  static createMockService(overrides?: Partial<ServiceConfig>) {
    return PortfolioServiceFactory.create({
      integrations: new Map([['test', new MockIntegrationRepository()]]),
      portfolioRepository: new InMemoryPortfolioRepository(),
      assetValuator: new MockAssetValuator(),
      ...overrides
    });
  }
}
```

## Security Considerations

1. **No Private Keys**: This library never handles private keys or signs transactions
2. **Read-Only Operations**: All blockchain and API operations are read-only
3. **Input Validation**: All addresses and inputs are validated at boundaries
4. **No Direct Network Calls**: Library delegates external calls to integration packages
5. **Dependency Security**: All dependencies are from trusted @cygnus-wealth organization
6. **Anti-Corruption Layers**: External data is validated and transformed at boundaries

## Versioning and Migration

This library follows semantic versioning:

- **Major**: Breaking changes to public API surface
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, no API changes

### Breaking Change Policy

- Changes to `PortfolioAggregationService` public methods
- Changes to repository interface contracts
- Changes to domain event structure
- Changes to domain model public API

### Migration Support

Major version upgrades include:
- Migration guides with before/after examples
- Deprecated method warnings in minor versions
- Compatibility layers when feasible

## Performance Characteristics

### Caching Strategy
- **L1 Cache**: In-memory for active session data
- **L2 Cache**: Delegated to consumer via IPortfolioRepository
- **Cache Invalidation**: Event-driven updates and TTL management

### Parallel Processing
- **Concurrent Integration Calls**: Promise.allSettled for multiple sources
- **Partial Failure Resilience**: Continue aggregation even if some sources fail
- **Async Event Processing**: Non-blocking domain event emission

### Scalability Considerations
- **Memory Management**: Efficient asset deduplication algorithms
- **Bundle Size**: Tree-shakeable exports and code splitting support
- **Performance Targets**: < 3s for full portfolio aggregation

## Integration with Enterprise Architecture

### Context Mapping

- **Customer/Supplier**: This library serves as supplier to consumer applications
- **Anti-Corruption Layer**: Implements ACL pattern for all external integrations
- **Shared Kernel**: Uses @cygnus-wealth/data-models for shared types
- **Published Language**: Domain events serve as published language for integration

### Domain Boundaries

This bounded context maintains strict boundaries:
- Does not handle wallet connections (delegated to wallet-integration-system)
- Does not implement UI components (owned by consumer applications)
- Does not perform direct price discovery (delegated to asset-valuator)
- Does not manage user sessions (handled by consumer applications)

### Future Evolution

Planned enhancements while maintaining boundaries:
- Support for additional blockchain integrations
- Enhanced reconciliation algorithms
- Real-time portfolio updates via WebSocket subscriptions
- Advanced portfolio analytics capabilities
- Historical portfolio snapshots

This architecture ensures the Portfolio Aggregation service library is maintainable, testable, provides clear boundaries between business logic and technical concerns, and integrates seamlessly with the broader CygnusWealth enterprise architecture while supporting both browser and Node.js environments.