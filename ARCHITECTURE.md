# Architecture - Portfolio Aggregation Service Library

## Overview

The Portfolio Aggregation Service Library implements a **Hexagonal Architecture** (Ports and Adapters) pattern within the CygnusWealth domain. This bounded context serves as a **service library** that orchestrates data collection from multiple blockchain and traditional financial sources, providing a unified portfolio view to consuming applications.

## Architectural Principles

### Hexagonal Architecture (Ports and Adapters)

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
│   Portfolio     │       │  IndexedDB      │   │   Event Bus     │
│  Repository     │       │   Repository    │   │   Subscribers   │
│     Port        │       │    Adapter      │   │    (External)   │
└─────────────────┘       └─────────────────┘   └─────────────────┘
```

### Dependency Flow

All dependencies point **inward** toward the domain core:
- **Infrastructure** depends on **Application** and **Domain**
- **Application** depends on **Domain**
- **Domain** has no external dependencies

This ensures the business logic remains isolated and testable.

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

- **PortfolioAggregate**: Central aggregate managing portfolio state, asset deduplication, and business rules
- **AssetEntity**: Represents individual financial assets with balance, price, and metadata
- **Value Objects**: Immutable objects representing Money and blockchain addresses
- **Domain Events**: Capture significant business events for integration and audit
- **Domain Services**: Complex business logic that doesn't belong to a single entity

### Application Layer (`src/application/`)

**Purpose**: Orchestrates domain objects and coordinates with external systems through ports.

```
src/application/
├── services/
│   └── PortfolioAggregationService.ts  # Main orchestration service
├── use-cases/
│   ├── AggregatePortfolioUseCase.ts    # Portfolio aggregation use case
│   └── RefreshPortfolioUseCase.ts      # Portfolio refresh use case
└── events/
    └── ApplicationEventHandlers.ts     # Application event handlers
```

**Key Components:**

- **PortfolioAggregationService**: Primary service orchestrating data fetching, reconciliation, and caching
- **Use Cases**: Specific business operations with clear input/output contracts
- **Event Handlers**: React to domain events for side effects and integration

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

## Browser Compatibility and Bundle Optimization

### Target Environments

- **Browsers**: ES2020+ (Chrome 85+, Firefox 80+, Safari 14+)
- **Node.js**: Version 16+
- **Module Systems**: ESM primary, UMD fallback

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

### Caching Strategy
- **L1 Cache**: In-memory for session data
- **L2 Cache**: IndexedDB for persistent data
- **Cache Keys**: Source-specific with TTL management
- **Cache Invalidation**: Event-driven updates

### Parallel Processing
- **Concurrent Integration Calls**: Promise.allSettled for multiple sources
- **Async Event Processing**: Non-blocking event handlers
- **Background Refresh**: Optional background portfolio updates

### Memory Management
- **Weak References**: For event subscribers cleanup
- **Asset Pooling**: Reuse asset objects where possible
- **Garbage Collection**: Explicit cleanup methods for long-running instances

This architecture ensures the Portfolio Aggregation service library is maintainable, testable, and provides clear boundaries between business logic and technical concerns while supporting both browser and Node.js environments.