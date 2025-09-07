# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always use manjaro-sysadmin. When using sudo, use "sudo -A"

## Critical: This is a Service Library

**This is a SERVICE LIBRARY (NPM package), NOT a standalone application.**
- Package: `@cygnus-wealth/portfolio-aggregation`
- Type: NPM library consumed by other applications
- Domain: Portfolio Management (Core Domain in CygnusWealth enterprise architecture)
- Architecture: Hexagonal Architecture (Ports and Adapters pattern)

**NEVER add these to this library:**
- React components or UI elements
- Application-specific code
- Direct API/RPC calls (use integration packages)
- User authentication/session management
- Browser storage management

## Architecture Overview

This implements **Hexagonal Architecture** within a bounded context. See `ARCHITECTURE.md` for complete details.

### Dependency Flow (CRITICAL)
All dependencies point **inward** toward the domain core:
- Infrastructure → Application → Domain
- Domain has ZERO external dependencies
- External systems accessed only through ports (interfaces)

### Layer Structure
```
src/
├── domain/           # Pure business logic, NO external deps
├── application/      # Orchestration, depends only on domain
├── infrastructure/   # Adapters for external systems
├── contracts/        # Port interfaces
└── shared/          # Cross-cutting concerns
```

## Commands

### Library Development
```bash
npm run build:lib    # Build library for distribution
npm run build:types  # Generate TypeScript declarations
npm run watch        # Watch mode for library development
npm run prepublishOnly # Run before publishing to npm
```

### Testing
```bash
npm run test         # Run Vitest in watch mode
npm run test:once    # Run tests once
npm run test:ui      # Run tests with UI interface
npm run test:coverage # Generate coverage report (target: 85%+)
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking (no emit)
npm run format       # Format code with Prettier
```

## Core Components

### Domain Layer (src/domain/)
**PortfolioAggregate** (`aggregates/Portfolio.ts`)
- Central aggregate root managing portfolio state
- Maintains invariants: deduplication, total value consistency
- Key methods: `addAsset()`, `reconcile()`, `getTotalValue()`

**AssetEntity** (`entities/Asset.ts`)
- Represents financial assets with balance and price
- Can merge with similar assets
- Key methods: `getValue()`, `isSameAsset()`, `merge()`

**Value Objects** (`value-objects/`)
- Money: Immutable monetary value with currency
- Address: Immutable blockchain address with validation

**Domain Events** (`events/`)
- Portfolio lifecycle events (Started, Completed, Failed)
- Asset events (Added, Merged, PriceUpdated)
- Integration events (Connected, Failed, DataFetched)

### Application Layer (src/application/)
**PortfolioAggregationService** (`services/PortfolioAggregationService.ts`)
- Main orchestration service
- Coordinates parallel data fetching
- Manages caching and reconciliation
- Emits domain events

### Infrastructure Layer (src/infrastructure/)
- Repository implementations (Browser, Node.js, InMemory)
- Integration adapters (anti-corruption layers)
- External system connectors

### Contracts Layer (src/contracts/)
**Port Interfaces** (all consumers must implement):
- `IIntegrationRepository`: Data source integration
- `IPortfolioRepository`: Portfolio persistence
- `IAssetValuatorRepository`: Asset pricing

## Dependencies

### Downstream (This library depends on)
- `@cygnus-wealth/data-models` - Shared contracts
- `@cygnus-wealth/evm-integration` - EVM blockchain data
- `@cygnus-wealth/sol-integration` - Solana blockchain data
- `@cygnus-wealth/robinhood-integration` - TradFi data
- `@cygnus-wealth/asset-valuator` - Pricing services

### Upstream (Applications consuming this library)
- `@cygnus-wealth/cygnus-wealth-app` - Main web application
- Future client applications

## Path Aliases
```typescript
@domain/         → /src/domain/
@application/    → /src/application/
@infrastructure/ → /src/infrastructure/
@contracts/      → /src/contracts/
@shared/         → /src/shared/
```
**NO @presentation/ - this library has no UI**

## Testing Requirements

### Coverage Targets
- Branches: 80%+
- Functions: 85%+
- Lines: 85%+
- Statements: 85%+

### Test Structure
```
src/tests/
├── unit/        # Isolated domain logic tests
├── integration/ # Cross-boundary tests
├── e2e/         # Full service tests
├── mocks/       # Test doubles for consumers
└── helpers/     # Test utilities
```

### Consumer Testing Support
Export test helpers for applications using this library:
- `TestServiceFactory.createMockService()`
- Mock implementations of all interfaces
- Test data builders

## Event-Driven Architecture

Domain events are emitted through an optional EventEmitter provided by consuming applications:

```typescript
const eventBus = new EventEmitter();
const service = new PortfolioAggregationService(
  integrations,
  repository,
  valuator,
  eventBus  // Optional: consumer provides
);

service.on(DomainEventType.PORTFOLIO_AGGREGATION_COMPLETED, handler);
```

## Security Constraints

1. **NO private keys** - Never handle or store private keys
2. **Read-only operations** - All blockchain/API ops are read-only
3. **Input validation** - Validate all addresses and inputs at boundaries
4. **No direct network calls** - Use integration packages
5. **Anti-corruption layers** - Transform external data at boundaries

## Performance Targets

- Full portfolio aggregation: < 3 seconds
- Bundle size (core): < 50KB gzipped
- Memory efficient deduplication
- Parallel integration calls with Promise.allSettled

## Browser Compatibility

- ES2020+ (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Node.js 16+
- ESM primary, CommonJS compatibility
- Tree-shaking support via named exports

## Important Patterns

### Anti-Corruption Layer
```typescript
// Transform external data to domain models
private translateToAsset(externalData: any): Asset {
  return {
    id: generateAssetId(this.source, externalData),
    symbol: externalData.symbol,
    // ... validate and transform
  };
}
```

### Repository Pattern
```typescript
// Consumers provide implementation
interface IPortfolioRepository {
  save(portfolio: PortfolioAggregate): Promise<void>;
  findById(id: string): Promise<PortfolioAggregate | null>;
  // ...
}
```

### Factory Pattern
```typescript
// Service creation via factory
const service = PortfolioServiceFactory.create({
  integrations,
  portfolioRepository,
  assetValuator
});
```

## Common Mistakes to Avoid

1. **Adding UI code** - This is a library, not an app
2. **Direct API calls** - Use integration packages
3. **Breaking hexagonal architecture** - Keep dependencies inward
4. **Storing state** - Let consumers handle persistence
5. **Handling auth** - Consumer's responsibility
6. **Adding app-specific logic** - Keep it generic

## Quick Reference

- **Main entry**: `src/index.ts` (public API exports)
- **Core service**: `PortfolioAggregationService`
- **Core aggregate**: `PortfolioAggregate`
- **Architecture doc**: `ARCHITECTURE.md` (complete details)
- **Repository**: https://github.com/cygnus-wealth/portfolio-aggregation