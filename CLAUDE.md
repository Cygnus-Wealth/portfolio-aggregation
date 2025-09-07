# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always use manjaro-sysadmin. When using sudo, use "sudo -A"

## Important: This is a Service Library

**This is a SERVICE LIBRARY (NPM package), not a standalone application.** It provides portfolio aggregation services that are consumed by other applications like `@cygnus-wealth/cygnus-wealth-core`. 

**DO NOT add React components, UI elements, or application-specific code here.** Those belong in the consuming applications.

## Commands

### Library Development
```bash
npm run build:lib    # Build library for distribution
npm run build:types  # Generate TypeScript declarations
npm run watch        # Watch mode for library development
```

### Testing
```bash
npm run test         # Run Vitest in watch mode
npm run test:once    # Run tests once
npm run test:ui      # Run tests with UI interface
npm run test:coverage # Generate coverage report
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking (no emit)
npm run format       # Format code with Prettier
```

## Architecture

This is a Domain-Driven Design (DDD) portfolio aggregation SERVICE LIBRARY for CygnusWealth. It orchestrates data collection from multiple blockchain and traditional sources, combining them into a unified portfolio view.

### Core Domain Components

**PortfolioAggregate** (`src/domain/aggregates/Portfolio.ts`): Central aggregate managing portfolio state, asset deduplication, and reconciliation across multiple data sources.

**PortfolioAggregationService** (`src/application/services/PortfolioAggregationService.ts`): Orchestrates parallel data fetching from integration sources, handles caching, enrichment with prices, and portfolio reconciliation.

### Dependencies on Other Packages
This library depends on other CygnusWealth packages:
- `@cygnus-wealth/data-models` - Shared data structures and contracts
- `@cygnus-wealth/evm-integration` - EVM blockchain integration
- `@cygnus-wealth/sol-integration` - Solana blockchain integration  
- `@cygnus-wealth/robinhood-integration` - Traditional finance integration
- `@cygnus-wealth/asset-valuator` - Asset pricing services

### Path Aliases
The project uses TypeScript path aliases:
- `@domain/` → `/src/domain/`
- `@application/` → `/src/application/`
- `@infrastructure/` → `/src/infrastructure/`
- `@contracts/` → `/src/contracts/`

Note: NO `@presentation/` alias since this library has no UI components.

### Testing Strategy
- Unit tests located in `src/tests/unit/`
- Integration tests in `src/tests/integration/`
- Mock implementations in `src/tests/mocks/`
- NO React testing libraries (this is not a UI library)
- Test environment configured for Node.js/browser compatibility

### Key Interfaces
- **IIntegrationRepository**: Interface for data source integrations (EVM, Solana, Robinhood)
- **IPortfolioRepository**: Portfolio persistence layer
- **IAssetValuatorRepository**: Asset price enrichment service