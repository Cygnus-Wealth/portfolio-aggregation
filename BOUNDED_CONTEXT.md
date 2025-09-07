# Portfolio Aggregation Bounded Context

## 1. Context Definition

### 1.1 Bounded Context Identity
**Name**: Portfolio Aggregation  
**Domain**: Portfolio Management  
**Type**: Service Library (Core Domain)  
**Library Package**: `@cygnus-wealth/portfolio-aggregation`  
**Purpose**: A service layer library that orchestrates the collection, reconciliation, and aggregation of financial assets from multiple heterogeneous data sources into a unified, coherent portfolio view. This bounded context exists as a reusable npm package that other applications depend on.

### 1.2 Context Boundaries

#### Responsibilities (What's Inside)
- Asset collection orchestration from multiple integration sources
- Asset deduplication and reconciliation across sources
- Portfolio state management and persistence
- Asset valuation enrichment coordination
- Cache management for aggregated portfolio data
- Parallel data fetching optimization
- Source-specific address routing

#### Non-Responsibilities (What's Outside)
- Direct blockchain interaction (delegated to integration package dependencies)
- Asset price discovery algorithms (delegated to @cygnus-wealth/asset-valuator)
- User interface components (owned by @cygnus-wealth/cygnus-wealth-core)
- User authentication and authorization (handled by consuming applications)
- Transaction execution (not supported - read-only system)
- Portfolio analytics and reporting (separate bounded context)
- Tax calculation and reporting (separate bounded context)
- Client-side state management (responsibility of consuming applications)
- Browser storage management (handled by consuming applications)

### 1.3 Strategic Classification
- **Core Domain**: This is a core subdomain service library that provides essential portfolio aggregation capabilities
- **Deployment Model**: NPM package library consumed by client applications
- **Complexity**: High - requires sophisticated reconciliation logic and orchestration patterns
- **Differentiation**: Medium - while not unique, the quality of aggregation directly impacts user experience
- **Dependencies**: 
  - `@cygnus-wealth/data-models` - Shared data contracts
  - `@cygnus-wealth/evm-integration` - EVM blockchain integration
  - `@cygnus-wealth/sol-integration` - Solana blockchain integration
  - `@cygnus-wealth/robinhood-integration` - Traditional finance integration
  - `@cygnus-wealth/asset-valuator` - Asset pricing services

## 2. Domain Model

### 2.1 Aggregate Roots

#### PortfolioAggregate
**Purpose**: Central consistency boundary for portfolio state management  
**Identity**: Portfolio ID (string)  
**Invariants**:
- A portfolio must have at least one source when it contains assets
- Asset deduplication must be maintained within a portfolio
- Total value must equal the sum of all asset values
- Last updated timestamp must reflect the most recent modification

**Key Behaviors**:
- `addAsset()`: Adds or merges an asset, maintaining deduplication
- `reconcile()`: Reconciles duplicate assets across sources
- `getTotalValue()`: Calculates aggregate portfolio value
- `mergePortfolio()`: Combines another portfolio into this one

### 2.2 Entities

#### AssetEntity
**Purpose**: Represents a financial asset within the portfolio  
**Identity**: Asset ID (string)  
**Characteristics**:
- Mutable balance and price
- Can be merged with similar assets
- Maintains source metadata

**Key Behaviors**:
- `getValue()`: Calculates current market value
- `isSameAsset()`: Determines asset equivalence for deduplication
- `merge()`: Combines with another asset instance
- `updatePrice()`: Updates current market price

### 2.3 Value Objects

#### Money
**Purpose**: Represents monetary value with currency  
**Immutability**: Fully immutable  
**Validation Rules**:
- Amount cannot be negative
- Currency must be 3-letter ISO code
- Operations must maintain currency consistency

**Operations**:
- `add()`: Addition with same currency validation
- `subtract()`: Subtraction with sufficiency check
- `multiply()`: Scalar multiplication

#### Address
**Purpose**: Represents a blockchain address with chain context  
**Immutability**: Fully immutable  
**Validation Rules**:
- EVM addresses: 42-character hex strings (0x prefix)
- Solana addresses: 32-44 character base58 strings
- Chain-specific normalization applied

### 2.4 Domain Services

#### PortfolioAggregationService (Application Service)
**Purpose**: Orchestrates the portfolio aggregation workflow  
**Responsibilities**:
- Coordinates parallel data fetching from integration sources
- Manages caching strategies
- Enriches assets with current prices
- Handles partial failures gracefully

**Key Operations**:
- `aggregatePortfolio()`: Main orchestration method
- `refreshPortfolio()`: Force refresh existing portfolio
- `enrichWithPrices()`: Coordinates price enrichment

## 3. Ubiquitous Language

### Core Terms

**Portfolio**: A collection of financial assets owned by a user across multiple sources and chains

**Asset**: A financial instrument with a balance, including tokens, NFTs, stocks, or DeFi positions

**Aggregation**: The process of collecting and combining assets from multiple sources into a unified view

**Reconciliation**: The process of identifying and merging duplicate assets from different sources

**Integration Source**: An external system that provides asset data (EVM chains, Solana, Robinhood)

**Valuation**: The process of determining current market value for assets

**Deduplication**: Identifying and merging assets that represent the same underlying instrument

**Chain**: A blockchain network (Ethereum, Polygon, Solana, etc.)

**Balance**: The quantity of an asset held, with decimal precision

**Price**: Current market value per unit of an asset in a specific currency

## 4. Context Mapping

### 4.1 Upstream Contexts (Consuming Applications)

#### CygnusWealth Core Application
**Relationship**: Customer/Supplier  
**Integration**: NPM package dependency  
**Contract**: Exported service classes and interfaces
**Usage Pattern**: Core application instantiates services with required dependencies

#### Future Client Applications
**Relationship**: Customer/Supplier  
**Integration**: NPM package import  
**Contract**: Public API surface defined in index.ts exports

### 4.2 Downstream Contexts (NPM Dependencies)

#### @cygnus-wealth/evm-integration
**Relationship**: Customer/Supplier  
**Integration**: NPM package dependency, Anti-Corruption Layer via IIntegrationRepository  
**Contract**: 
- Async asset fetching by addresses
- Standardized Asset data structure from @cygnus-wealth/data-models
- Connection lifecycle management
- Read-only operations only

#### @cygnus-wealth/sol-integration
**Relationship**: Customer/Supplier  
**Integration**: NPM package dependency, Anti-Corruption Layer via IIntegrationRepository  
**Contract**: Same as EVM Integration

#### @cygnus-wealth/robinhood-integration
**Relationship**: Customer/Supplier  
**Integration**: NPM package dependency, Anti-Corruption Layer via IIntegrationRepository  
**Contract**: Same pattern, address-agnostic for traditional finance

#### @cygnus-wealth/asset-valuator
**Relationship**: Customer/Supplier  
**Integration**: NPM package dependency, Anti-Corruption Layer via IAssetValuatorRepository  
**Contract**:
- Batch price fetching by symbols
- Currency conversion capabilities
- Cache invalidation control
- Read-only price queries

#### @cygnus-wealth/data-models
**Relationship**: Shared Kernel  
**Integration**: NPM package dependency for shared types  
**Contract**: Common data structures and interfaces used across all domains

### 4.3 Peer Contexts

#### Portfolio Analytics Context (Future)
**Relationship**: Partnership  
**Integration**: Separate NPM package that may consume this library  
**Contract**: Read-only access to aggregated portfolios via exported interfaces

#### Transaction History Context (Future)
**Relationship**: Partnership  
**Integration**: Separate bounded context package  
**Contract**: May share @cygnus-wealth/data-models definitions

## 5. Anti-Corruption Layer Patterns

### 5.1 Integration Repository Pattern

**Purpose**: Isolate domain from external integration specifics

**Implementation**:
```typescript
interface IIntegrationRepository {
  source: IntegrationSource;
  connect(): Promise<void>;
  fetchAssets(addresses: string[]): Promise<Asset[]>;
  // ... standardized interface
}
```

**Benefits**:
- Domain remains pure and testable
- Integration changes don't affect domain logic
- Easy to add new integration sources
- Consistent error handling across sources

### 5.2 Repository Abstraction

**Portfolio Repository**: Abstracts persistence mechanism
- Currently uses LocalStorage
- Can switch to IndexedDB or remote storage
- Domain unaware of storage implementation

**Asset Valuator Repository**: Abstracts pricing services
- Hides external API complexity
- Manages rate limiting and caching
- Provides consistent price format

### 5.3 Data Translation

**Inbound Translation**: External data → Domain models
- Integration repositories return generic Asset type
- Service layer creates domain entities (AssetEntity)
- Validation and normalization at boundary

**Outbound Translation**: Domain models → External format
- `toJSON()` methods for serialization
- Presentation-specific DTOs when needed

## 6. Domain Events

### 6.1 Event Contract for Consuming Applications

This service library emits domain events that consuming applications can subscribe to. Events are emitted through an event emitter interface that must be provided by the consuming application.

#### PortfolioAggregated
**Trigger**: Successful portfolio aggregation completion  
**Payload**: Portfolio ID, user ID, sources used, asset count, total value  
**Contract**: Consuming applications can subscribe to track aggregation completion

#### AssetPriceUpdated
**Trigger**: Asset price refresh  
**Payload**: Asset ID, old price, new price, timestamp  
**Contract**: Enables real-time price update notifications in UI

#### ReconciliationCompleted
**Trigger**: Portfolio reconciliation process completion  
**Payload**: Portfolio ID, assets merged count, conflicts resolved  
**Contract**: Allows UI to show reconciliation statistics

#### IntegrationSourceFailed
**Trigger**: Integration source fetch failure  
**Payload**: Source, error type, affected addresses  
**Contract**: Enables error handling and user notification in consuming apps

### 6.2 Event Implementation Strategy

```typescript
// Proposed domain event base
abstract class DomainEvent {
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly eventType: string;
  
  constructor(aggregateId: string) {
    this.aggregateId = aggregateId;
    this.occurredAt = new Date();
    this.eventType = this.constructor.name;
  }
}

// Example implementation
class PortfolioAggregatedEvent extends DomainEvent {
  constructor(
    portfolioId: string,
    public readonly userId: string | undefined,
    public readonly sources: IntegrationSource[],
    public readonly assetCount: number,
    public readonly totalValue: Money
  ) {
    super(portfolioId);
  }
}
```

## 7. Integration Points

### 7.1 Library API Surface

**Service Exports**:
- `PortfolioAggregationService` - Main orchestration service
- `PortfolioRepository` - Portfolio persistence interface
- `IIntegrationRepository` - Integration adapter interface
- `IAssetValuatorRepository` - Valuation service interface

**Domain Model Exports**:
- `PortfolioAggregate` - Core aggregate for portfolio management
- `AssetEntity` - Asset representation
- `Money` - Value object for monetary values
- `Address` - Value object for blockchain addresses

**Event Exports**:
- Domain event types and interfaces
- Event emitter integration interface

### 7.2 External Dependencies

**Integration Package Dependencies**:
- `@cygnus-wealth/evm-integration` - EVM blockchain data
- `@cygnus-wealth/sol-integration` - Solana blockchain data
- `@cygnus-wealth/robinhood-integration` - Traditional finance data

**Service Dependencies**:
- `@cygnus-wealth/asset-valuator` - Price enrichment
- `@cygnus-wealth/data-models` - Shared data contracts

**No Direct External Calls**:
- All external API calls are delegated to integration packages
- This library only orchestrates and aggregates

## 8. Technical Patterns

### 8.1 Orchestration Pattern
- PortfolioAggregationService acts as orchestrator
- Parallel fetching with Promise.allSettled
- Graceful degradation on partial failures

### 8.2 Repository Pattern
- Abstracts persistence and external services
- Enables testing with mock implementations
- Supports multiple storage strategies

### 8.3 Aggregate Pattern
- PortfolioAggregate maintains consistency
- Encapsulates business rules
- Controls access to child entities

### 8.4 Value Object Pattern
- Money and Address ensure validity
- Immutable to prevent corruption
- Self-validating with business rules

## 9. Testing Strategy

### 9.1 Unit Tests
- Domain logic isolation
- Value object validation
- Entity behavior verification
- Aggregate invariant testing

### 9.2 Integration Tests
- Repository implementations
- External service mocking
- Anti-corruption layer validation

### 9.3 Acceptance Tests
- Full aggregation workflows
- Multiple source scenarios
- Error recovery paths

## 10. Future Considerations

### 10.1 Scalability
- Event sourcing for audit trail
- CQRS for read/write separation
- Distributed caching strategy

### 10.2 Features
- Real-time portfolio updates via WebSockets
- Historical portfolio snapshots
- Multi-currency support with conversion
- ZK proof integration for privacy

### 10.3 Integration Expansion
- Additional blockchain support (SUI, Cosmos)
- More traditional finance integrations
- DeFi protocol direct integration
- Cross-chain bridge tracking

## 11. Governance

### 11.1 Change Management
- Changes to public API require major version bump (semver)
- New integration sources must implement IIntegrationRepository interface
- Breaking changes require migration guide documentation
- Domain model changes must maintain backward compatibility

### 11.2 Library Quality Attributes
- **Bundle Size**: Minimize package size for browser consumption
- **Tree-Shaking**: Support ES modules for optimal bundling
- **Type Safety**: Full TypeScript definitions exported
- **Performance**: < 3s for full portfolio aggregation
- **Zero Dependencies**: Minimize runtime dependencies
- **Browser Compatible**: Must run in modern browsers

### 11.3 Security & Privacy
- **No Private Keys**: Library never handles private keys
- **Read-Only**: All operations are read-only
- **No Persistence**: Library doesn't persist data (delegated to consumers)
- **No Network Calls**: Direct network calls handled by integration packages
- **Client-Side**: Designed for browser execution environment