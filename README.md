# Portfolio Aggregation Service Library

**Domain**: Portfolio  
**Bounded Context**: Orchestration and Aggregation  
**Type**: Service Library (NPM Package)  
**Package**: `@cygnus-wealth/portfolio-aggregation`

## Overview

The Portfolio Aggregation service library is a reusable npm package that provides portfolio orchestration and aggregation capabilities for client applications. This library coordinates data collection from multiple integration packages and combines them into a unified portfolio view.

**Key Characteristics**:
- Service layer library, not a standalone application
- No UI components (consumed by @cygnus-wealth/cygnus-wealth-core)
- Orchestrates but doesn't implement integrations
- Provides domain services and aggregates as reusable components
- Emits domain events for consuming applications

## Installation

```bash
npm install @cygnus-wealth/portfolio-aggregation
```

## Library Architecture

This service library follows Domain-Driven Design (DDD) principles with the following structure:

```
src/
├── domain/              # Core business logic
│   ├── entities/       # Domain entities
│   ├── value-objects/  # Value objects
│   ├── aggregates/     # Domain aggregates
│   └── services/       # Domain services
├── application/        # Application layer
│   ├── services/      # Application services (main exports)
│   ├── use-cases/     # Use case implementations
│   └── commands/      # Command handlers
├── infrastructure/    # Infrastructure layer
│   ├── repositories/  # Repository implementations
│   ├── adapters/     # Integration adapters
│   └── cache/        # Caching strategies
├── contracts/        # Public interfaces and contracts
├── shared/          # Shared utilities and types
└── index.ts        # Public API exports
```

**Note**: This library has no presentation layer. UI components are implemented in consuming applications like @cygnus-wealth/cygnus-wealth-core.

## Core Responsibilities

1. **Data Orchestration**: Coordinates parallel data fetching from multiple integration domains
2. **Portfolio Composition**: Combines assets from different sources into a unified portfolio
3. **Deduplication**: Identifies and merges duplicate assets across sources
4. **Reconciliation**: Handles discrepancies between different data sources
5. **Caching Strategy**: Implements intelligent caching to minimize external API calls
6. **Error Handling**: Provides graceful degradation when some sources are unavailable

## Dependencies

### Runtime Dependencies
- `@cygnus-wealth/data-models` - Shared data contracts and unified structures
- `@cygnus-wealth/evm-integration` - EVM blockchain integration
- `@cygnus-wealth/sol-integration` - Solana blockchain integration  
- `@cygnus-wealth/robinhood-integration` - Traditional finance integration
- `@cygnus-wealth/asset-valuator` - Asset pricing and valuation services

### Development Dependencies
- TypeScript - Type safety and library definitions
- Vite - Build tooling for library bundling
- Vitest - Testing framework

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run typecheck

# Build for production
npm run build
```

## Testing

The project uses Vitest for testing with the following structure:

- `src/tests/unit/` - Unit tests for domain logic
- `src/tests/integration/` - Integration tests
- `src/tests/e2e/` - End-to-end tests

Run tests with:
```bash
npm run test         # Run tests in watch mode
npm run test:once    # Run tests once
npm run test:coverage # Generate coverage report
```

## Library Usage

### Installation in Client Applications

```bash
npm install @cygnus-wealth/portfolio-aggregation
```

### Basic Integration

```typescript
import { 
  PortfolioAggregationService,
  IIntegrationRepository,
  IPortfolioRepository,
  IAssetValuatorRepository 
} from '@cygnus-wealth/portfolio-aggregation';

// Client application provides implementations
const integrations: IIntegrationRepository[] = [
  evmIntegration,
  solanaIntegration,
  robinhoodIntegration
];

const portfolioRepository: IPortfolioRepository = // client's storage implementation
const assetValuator: IAssetValuatorRepository = // valuator service instance

// Initialize the service
const service = new PortfolioAggregationService(
  integrations,
  portfolioRepository,
  assetValuator
);

// Use the service to aggregate portfolio
const portfolio = await service.aggregatePortfolio({
  sources: [IntegrationSource.EVM, IntegrationSource.SOLANA],
  addresses: new Map([
    ['ethereum', ['0x...']],
    ['solana', ['...']],
  ]),
  userId: 'user123',
  forceRefresh: false
});
```

### Event Subscription

```typescript
// Subscribe to domain events
service.on('PortfolioAggregated', (event) => {
  console.log('Portfolio aggregation completed', event);
});

service.on('IntegrationSourceFailed', (event) => {
  console.error('Integration failed', event.source, event.error);
});
```

## Public API Exports

The library exports the following for use by consuming applications:

### Services
- `PortfolioAggregationService` - Main orchestration service
- `ReconciliationService` - Asset deduplication and reconciliation

### Interfaces
- `IIntegrationRepository` - Interface for integration adapters
- `IPortfolioRepository` - Portfolio persistence interface
- `IAssetValuatorRepository` - Valuation service interface

### Domain Models
- `PortfolioAggregate` - Core portfolio aggregate
- `AssetEntity` - Asset domain entity
- `Money` - Value object for monetary values
- `Address` - Value object for blockchain addresses

### Event Types
- Domain event interfaces and types
- Event emitter integration

## Integration with CygnusWealth Core

This library is primarily consumed by `@cygnus-wealth/cygnus-wealth-core`, which:
- Provides the UI components and user interactions
- Manages client-side state and browser storage
- Handles user configuration and preferences
- Instantiates and coordinates service library usage

## Contributing

When contributing to this service library:
1. Maintain clear domain boundaries - this is orchestration only
2. Don't add UI components - those belong in consuming applications
3. Follow DDD principles for domain modeling
4. Ensure all public API changes are backward compatible or properly versioned
5. Add integration interfaces through the IIntegrationRepository pattern

## License

MIT