# Implementation Guide - Portfolio Aggregation Service Library

## Overview

This guide provides implementation patterns for building and consuming the Portfolio Aggregation service library. This bounded context is designed as a reusable service library that orchestrates portfolio data aggregation across multiple blockchain and traditional financial data sources.

## 1. Library Entry Points and Public API

### 1.1 Main Library Export

```typescript
// src/index.ts
export { PortfolioAggregationService } from './application/services/PortfolioAggregationService';
export { PortfolioAggregate } from './domain/aggregates/Portfolio';

// Value Objects
export { Money } from './domain/value-objects/Money';
export { Address } from './domain/value-objects/Address';

// Entities
export { AssetEntity } from './domain/entities/Asset';

// Events
export * from './domain/events/portfolio/PortfolioEvents';
export * from './domain/events/portfolio/AssetEvents';
export { EventBus } from './domain/events/EventBus';
export type { EventHandler, DomainEvent } from './domain/events/DomainEvent';

// Contracts (interfaces for dependency injection)
export type { IIntegrationRepository } from './contracts/repositories/IIntegrationRepository';
export type { IPortfolioRepository } from './contracts/repositories/IPortfolioRepository';
export type { IAssetValuatorRepository } from './contracts/repositories/IAssetValuatorRepository';

// Configuration types for service initialization
export type { 
  PortfolioServiceConfig,
  IntegrationConfig,
  CacheConfig 
} from './shared/config/types';

// Core types for consuming applications
export type {
  AggregationOptions,
  Asset,
  Portfolio,
  IntegrationSource,
  Chain
} from './shared/types';
```

### 1.2 Service Factory Pattern

```typescript
// src/ServiceFactory.ts
import { PortfolioAggregationService } from './application/services/PortfolioAggregationService';
import { IIntegrationRepository } from './contracts/repositories/IIntegrationRepository';
import { IPortfolioRepository } from './contracts/repositories/IPortfolioRepository';
import { IAssetValuatorRepository } from './contracts/repositories/IAssetValuatorRepository';
import { PortfolioServiceConfig } from './shared/config/types';

export class PortfolioServiceFactory {
  static create(config: PortfolioServiceConfig): PortfolioAggregationService {
    const integrations = new Map<string, IIntegrationRepository>();
    
    // Register provided integrations
    config.integrations.forEach((integration, source) => {
      integrations.set(source, integration);
    });
    
    return new PortfolioAggregationService(
      integrations,
      config.portfolioRepository,
      config.assetValuator,
      config.cache
    );
  }
  
  static createWithDefaults(
    integrationPackages: Map<string, any>
  ): PortfolioAggregationService {
    // Create service with sensible defaults and provided integration packages
    const integrations = new Map<string, IIntegrationRepository>();
    
    integrationPackages.forEach((pkg, source) => {
      if (pkg.createAdapter) {
        integrations.set(source, pkg.createAdapter());
      }
    });
    
    return new PortfolioAggregationService(
      integrations,
      new InMemoryPortfolioRepository(), // Default implementation
      new MockAssetValuator(), // Default implementation
      { ttl: 300000 } // 5 minutes
    );
  }
}
```

## 2. Integration Package Consumption

### 2.1 Consuming Integration Packages

```typescript
// Consumer application example
import { PortfolioServiceFactory } from '@cygnus-wealth/portfolio-aggregation';
import { createEVMAdapter } from '@cygnus-wealth/evm-integration';
import { createSolanaAdapter } from '@cygnus-wealth/sol-integration';
import { createRobinhoodAdapter } from '@cygnus-wealth/robinhood-integration';
import { createAssetValuator } from '@cygnus-wealth/asset-valuator';

// Initialize the service with integration packages
const integrations = new Map();
integrations.set('evm', createEVMAdapter({
  rpcUrl: 'https://eth.llamarpc.com',
  timeout: 30000
}));
integrations.set('solana', createSolanaAdapter({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  timeout: 30000
}));
integrations.set('robinhood', createRobinhoodAdapter({
  apiKey: process.env.ROBINHOOD_API_KEY
}));

const portfolioService = PortfolioServiceFactory.createWithDefaults(integrations);
```

### 2.2 Custom Integration Adapter

```typescript
// Custom integration implementation in consuming application
import { IIntegrationRepository, Asset, IntegrationSource } from '@cygnus-wealth/portfolio-aggregation';

export class CustomExchangeAdapter implements IIntegrationRepository {
  readonly source = 'custom-exchange' as IntegrationSource;
  
  constructor(private apiClient: CustomAPIClient) {}
  
  async connect(): Promise<void> {
    await this.apiClient.authenticate();
  }
  
  async fetchAssets(addresses: string[]): Promise<Asset[]> {
    const assets: Asset[] = [];
    
    for (const userId of addresses) {
      const holdings = await this.apiClient.getHoldings(userId);
      
      for (const holding of holdings) {
        assets.push({
          id: `${this.source}-${userId}-${holding.symbol}`,
          symbol: holding.symbol,
          name: holding.name,
          type: 'TOKEN',
          balance: {
            amount: holding.quantity,
            decimals: holding.decimals || 18,
            formatted: holding.quantity.toString()
          },
          price: holding.currentPrice ? {
            value: holding.currentPrice,
            currency: 'USD',
            timestamp: new Date()
          } : undefined,
          metadata: {
            source: this.source,
            userId,
            fetchedAt: new Date().toISOString()
          }
        });
      }
    }
    
    return assets;
  }
  
  async disconnect(): Promise<void> {
    await this.apiClient.disconnect();
  }
  
  isConnected(): boolean {
    return this.apiClient.isConnected();
  }
}
```

## 3. Dependency Injection Patterns

### 3.1 Service Configuration Interface

```typescript
// src/shared/config/types.ts
export interface PortfolioServiceConfig {
  integrations: Map<string, IIntegrationRepository>;
  portfolioRepository: IPortfolioRepository;
  assetValuator: IAssetValuatorRepository;
  cache?: CacheConfig;
  events?: EventConfig;
}

export interface CacheConfig {
  ttl: number;
  maxSize?: number;
  storage?: 'memory' | 'indexeddb' | 'custom';
  customStorage?: CacheStorage;
}

export interface EventConfig {
  enableEventStore?: boolean;
  eventHandlers?: Map<string, EventHandler>;
}
```

### 3.2 Repository Implementations for Different Environments

```typescript
// src/infrastructure/repositories/BrowserPortfolioRepository.ts
import { IPortfolioRepository } from '../../contracts/repositories/IPortfolioRepository';
import { PortfolioAggregate } from '../../domain/aggregates/Portfolio';

export class BrowserPortfolioRepository implements IPortfolioRepository {
  private readonly storeName = 'portfolios';
  private db: IDBDatabase | null = null;
  
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CygnusPortfolio', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
        }
      };
    });
  }
  
  async save(portfolio: PortfolioAggregate): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.put(portfolio.toJSON());
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async findById(id: string): Promise<PortfolioAggregate | null> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve(PortfolioAggregate.fromJSON(result));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  // ... other methods
}

// Node.js/Server environment repository
// src/infrastructure/repositories/FileSystemPortfolioRepository.ts
export class FileSystemPortfolioRepository implements IPortfolioRepository {
  constructor(private dataDir: string = './data/portfolios') {}
  
  async save(portfolio: PortfolioAggregate): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    await fs.mkdir(this.dataDir, { recursive: true });
    const filePath = path.join(this.dataDir, `${portfolio.id}.json`);
    
    await fs.writeFile(filePath, JSON.stringify(portfolio.toJSON(), null, 2));
  }
  
  // ... other methods
}
```

### 3.3 Environment-Specific Service Creation

```typescript
// src/factories/EnvironmentServiceFactory.ts
import { PortfolioServiceFactory } from '../ServiceFactory';
import { BrowserPortfolioRepository } from '../infrastructure/repositories/BrowserPortfolioRepository';
import { FileSystemPortfolioRepository } from '../infrastructure/repositories/FileSystemPortfolioRepository';

export class EnvironmentServiceFactory {
  static async createForBrowser(integrations: Map<string, any>) {
    const portfolioRepo = new BrowserPortfolioRepository();
    await portfolioRepo.initialize();
    
    return PortfolioServiceFactory.create({
      integrations,
      portfolioRepository: portfolioRepo,
      assetValuator: new BrowserAssetValuator(),
      cache: {
        ttl: 300000,
        storage: 'indexeddb'
      }
    });
  }
  
  static async createForNode(integrations: Map<string, any>, dataDir?: string) {
    return PortfolioServiceFactory.create({
      integrations,
      portfolioRepository: new FileSystemPortfolioRepository(dataDir),
      assetValuator: new HttpAssetValuator(),
      cache: {
        ttl: 300000,
        storage: 'memory'
      }
    });
  }
}
```

## 4. Library Usage Examples

### 4.1 React Application Integration

```typescript
// Consumer React app
import React, { useEffect, useState } from 'react';
import { 
  PortfolioAggregationService, 
  PortfolioAggregate, 
  EventBus 
} from '@cygnus-wealth/portfolio-aggregation';
import { EnvironmentServiceFactory } from '@cygnus-wealth/portfolio-aggregation/factories';

function usePortfolioService() {
  const [service, setService] = useState<PortfolioAggregationService | null>(null);
  
  useEffect(() => {
    async function initializeService() {
      const integrations = new Map();
      // Add integrations...
      
      const portfolioService = await EnvironmentServiceFactory.createForBrowser(integrations);
      setService(portfolioService);
    }
    
    initializeService();
  }, []);
  
  return service;
}

function PortfolioComponent() {
  const service = usePortfolioService();
  const [portfolio, setPortfolio] = useState<PortfolioAggregate | null>(null);
  const [loading, setLoading] = useState(false);
  
  const aggregatePortfolio = async () => {
    if (!service) return;
    
    setLoading(true);
    try {
      const addresses = new Map([
        ['ethereum', ['0x742d35cCfbC65F...']],
        ['solana', ['7xKXtg2CW87d9...']],
        ['robinhood', ['user123']]
      ]);
      
      const result = await service.aggregatePortfolio({
        addresses,
        sources: ['evm', 'solana', 'robinhood'],
        forceRefresh: false
      });
      
      setPortfolio(result);
    } catch (error) {
      console.error('Aggregation failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <button onClick={aggregatePortfolio} disabled={loading}>
        {loading ? 'Aggregating...' : 'Refresh Portfolio'}
      </button>
      {portfolio && (
        <div>
          <h2>Total Value: {portfolio.getTotalValue().formatted}</h2>
          <div>Assets: {portfolio.assets.length}</div>
        </div>
      )}
    </div>
  );
}
```

### 4.2 Node.js/Express API Integration

```typescript
// Express API server example
import express from 'express';
import { EnvironmentServiceFactory } from '@cygnus-wealth/portfolio-aggregation/factories';

const app = express();
app.use(express.json());

let portfolioService: PortfolioAggregationService;

async function initializeServices() {
  const integrations = new Map();
  // Configure integrations for server environment...
  
  portfolioService = await EnvironmentServiceFactory.createForNode(
    integrations,
    process.env.DATA_DIR || './data'
  );
}

app.post('/api/portfolios/aggregate', async (req, res) => {
  try {
    const { addresses, sources, userId } = req.body;
    
    const addressMap = new Map(Object.entries(addresses));
    
    const portfolio = await portfolioService.aggregatePortfolio({
      addresses: addressMap,
      sources,
      userId,
      forceRefresh: false
    });
    
    res.json({
      id: portfolio.id,
      totalValue: portfolio.getTotalValue(),
      assetCount: portfolio.assets.length,
      lastUpdated: portfolio.lastUpdated
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/portfolios/:id', async (req, res) => {
  try {
    const portfolio = await portfolioService.getPortfolio(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    res.json({
      id: portfolio.id,
      assets: portfolio.assets.map(asset => asset.toJSON()),
      totalValue: portfolio.getTotalValue(),
      lastUpdated: portfolio.lastUpdated
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initializeServices().then(() => {
  app.listen(3000, () => {
    console.log('Portfolio API server running on port 3000');
  });
});
```

### 4.3 CLI Tool Integration

```typescript
// CLI tool example
#!/usr/bin/env node
import { Command } from 'commander';
import { EnvironmentServiceFactory } from '@cygnus-wealth/portfolio-aggregation/factories';

const program = new Command();

program
  .name('portfolio-cli')
  .description('Portfolio aggregation CLI tool')
  .version('1.0.0');

program
  .command('aggregate')
  .description('Aggregate portfolio from multiple sources')
  .option('--ethereum <addresses>', 'Comma-separated Ethereum addresses')
  .option('--solana <addresses>', 'Comma-separated Solana addresses')
  .option('--sources <sources>', 'Comma-separated integration sources')
  .option('--format <format>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    const integrations = new Map();
    // Configure integrations...
    
    const service = await EnvironmentServiceFactory.createForNode(integrations);
    
    const addresses = new Map();
    if (options.ethereum) {
      addresses.set('ethereum', options.ethereum.split(','));
    }
    if (options.solana) {
      addresses.set('solana', options.solana.split(','));
    }
    
    try {
      const portfolio = await service.aggregatePortfolio({
        addresses,
        sources: options.sources ? options.sources.split(',') : undefined,
        forceRefresh: true
      });
      
      if (options.format === 'json') {
        console.log(JSON.stringify(portfolio.toJSON(), null, 2));
      } else {
        console.log(`Portfolio ID: ${portfolio.id}`);
        console.log(`Total Value: ${portfolio.getTotalValue().formatted}`);
        console.log(`Assets: ${portfolio.assets.length}`);
        
        console.table(portfolio.assets.map(asset => ({
          Symbol: asset.symbol,
          Name: asset.name,
          Chain: asset.chain,
          Balance: asset.balance.formatted,
          Value: asset.getValue()?.formatted || 'N/A'
        })));
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();
```

## 5. Build and Distribution Patterns

### 5.1 Library Build Configuration

```typescript
// vite.config.library.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PortfolioAggregation',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      external: [
        // Peer dependencies that consumers should provide
        'events',
        // Integration packages (consumed separately)
        '@cygnus-wealth/evm-integration',
        '@cygnus-wealth/sol-integration',
        '@cygnus-wealth/robinhood-integration',
        '@cygnus-wealth/asset-valuator',
        '@cygnus-wealth/data-models'
      ],
      output: {
        globals: {
          'events': 'Events'
        }
      }
    },
    sourcemap: true,
    minify: 'terser',
    target: ['es2020', 'node16']
  },
  define: {
    __LIB_VERSION__: JSON.stringify(process.env.npm_package_version)
  }
});
```

### 5.2 Package.json for Library Distribution

```json
{
  "name": "@cygnus-wealth/portfolio-aggregation",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./factories": {
      "import": "./dist/factories/index.js",
      "types": "./dist/factories/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc && vite build --config vite.config.library.ts",
    "build:types": "tsc --emitDeclarationOnly",
    "prepublishOnly": "npm run test && npm run build"
  },
  "peerDependencies": {
    "events": "^3.3.0"
  },
  "dependencies": {
    "@cygnus-wealth/data-models": "^1.0.0"
  },
  "devDependencies": {
    "@cygnus-wealth/evm-integration": "^1.0.0",
    "@cygnus-wealth/sol-integration": "^1.0.0",
    "@cygnus-wealth/robinhood-integration": "^1.0.0",
    "@cygnus-wealth/asset-valuator": "^1.0.0"
  }
}
```

### 5.3 Type Definitions Export

```typescript
// src/types/index.ts - Public type definitions
export interface LibraryConfig {
  version: string;
  environment: 'browser' | 'node';
  debug?: boolean;
}

export interface AggregationResult {
  portfolio: PortfolioAggregate;
  metadata: {
    duration: number;
    successfulSources: string[];
    failedSources: string[];
    assetCount: number;
  };
}

export interface ServiceMetrics {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
}
```

## 6. Event System for Service Library

### 6.1 Event Bus Configuration

```typescript
// src/events/EventBusConfig.ts
export interface EventBusConfig {
  maxListeners?: number;
  errorHandler?: (error: Error, event: DomainEvent) => void;
  enablePersistence?: boolean;
  persistenceStrategy?: 'memory' | 'indexeddb' | 'custom';
}

export class ConfigurableEventBus extends EventBus {
  constructor(private config: EventBusConfig = {}) {
    super();
    this.setMaxListeners(config.maxListeners || 100);
    
    if (config.errorHandler) {
      this.on('error', config.errorHandler);
    }
  }
  
  protected handleError(error: Error, event: DomainEvent): void {
    if (this.config.errorHandler) {
      this.config.errorHandler(error, event);
    } else {
      console.error(`Event handling error for ${event.metadata.eventType}:`, error);
    }
  }
}
```

### 6.2 External Event Subscription

```typescript
// Allow consuming applications to subscribe to service events
export class PortfolioServiceEventSubscriptions {
  constructor(private eventBus: EventBus) {}
  
  onPortfolioAggregationStarted(handler: (event: PortfolioAggregationStartedEvent) => void): () => void {
    return this.eventBus.subscribe(PortfolioAggregationStartedEvent, { handle: handler });
  }
  
  onPortfolioAggregationCompleted(handler: (event: PortfolioAggregationCompletedEvent) => void): () => void {
    return this.eventBus.subscribe(PortfolioAggregationCompletedEvent, { handle: handler });
  }
  
  onAssetPriceUpdated(handler: (event: AssetPriceUpdatedEvent) => void): () => void {
    return this.eventBus.subscribe(AssetPriceUpdatedEvent, { handle: handler });
  }
  
  // Utility method to subscribe to all portfolio events
  onAllPortfolioEvents(handlers: {
    onStarted?: (event: PortfolioAggregationStartedEvent) => void;
    onCompleted?: (event: PortfolioAggregationCompletedEvent) => void;
    onFailed?: (event: PortfolioAggregationFailedEvent) => void;
  }): () => void {
    const unsubscribers: (() => void)[] = [];
    
    if (handlers.onStarted) {
      unsubscribers.push(this.onPortfolioAggregationStarted(handlers.onStarted));
    }
    if (handlers.onCompleted) {
      unsubscribers.push(this.onPortfolioAggregationCompleted(handlers.onCompleted));
    }
    if (handlers.onFailed) {
      unsubscribers.push(this.onPortfolioAggregationFailed(handlers.onFailed));
    }
    
    // Return function to unsubscribe from all
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }
}
```

## 7. Service Library Testing

### 7.1 Integration Test Setup for Library

```typescript
// src/tests/integration/ServiceLibraryIntegration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PortfolioServiceFactory } from '../../ServiceFactory';
import { MockIntegrationRepository } from '../mocks/MockIntegrationRepository';
import { InMemoryPortfolioRepository } from '../mocks/InMemoryPortfolioRepository';
import { MockAssetValuator } from '../mocks/MockAssetValuator';

describe('Portfolio Service Library Integration', () => {
  let service: PortfolioAggregationService;
  
  beforeEach(() => {
    const integrations = new Map();
    integrations.set('mock-evm', new MockIntegrationRepository('mock-evm'));
    integrations.set('mock-sol', new MockIntegrationRepository('mock-sol'));
    
    service = PortfolioServiceFactory.create({
      integrations,
      portfolioRepository: new InMemoryPortfolioRepository(),
      assetValuator: new MockAssetValuator(),
      cache: { ttl: 60000 }
    });
  });
  
  it('should aggregate portfolio from multiple mock sources', async () => {
    const addresses = new Map([
      ['ethereum', ['0x123...']],
      ['solana', ['abc123...']]
    ]);
    
    const portfolio = await service.aggregatePortfolio({
      addresses,
      sources: ['mock-evm', 'mock-sol'],
      userId: 'test-user'
    });
    
    expect(portfolio).toBeDefined();
    expect(portfolio.assets.length).toBeGreaterThan(0);
    expect(portfolio.getTotalValue().amount).toBeGreaterThan(0);
  });
  
  it('should handle integration failures gracefully', async () => {
    // Configure one integration to fail
    const failingIntegration = new MockIntegrationRepository('failing', true);
    const integrations = new Map([['failing', failingIntegration]]);
    
    const service = PortfolioServiceFactory.create({
      integrations,
      portfolioRepository: new InMemoryPortfolioRepository(),
      assetValuator: new MockAssetValuator()
    });
    
    const addresses = new Map([['test', ['addr1']]]);
    
    // Should not throw, but should handle failure
    const portfolio = await service.aggregatePortfolio({
      addresses,
      sources: ['failing']
    });
    
    expect(portfolio.assets.length).toBe(0);
  });
});
```

### 7.2 Consumer Application Mock Testing

```typescript
// Example test helper for consuming applications
// src/testing/TestHelpers.ts
export class PortfolioTestHelpers {
  static createMockService(): PortfolioAggregationService {
    const integrations = new Map();
    integrations.set('test-evm', new MockIntegrationRepository('test-evm'));
    
    return PortfolioServiceFactory.create({
      integrations,
      portfolioRepository: new InMemoryPortfolioRepository(),
      assetValuator: new MockAssetValuator()
    });
  }
  
  static createMockPortfolio(overrides?: Partial<Portfolio>): PortfolioAggregate {
    return new PortfolioAggregate({
      id: 'test-portfolio-123',
      userId: 'test-user',
      assets: [
        AssetEntity.fromJSON({
          id: 'eth-asset',
          symbol: 'ETH',
          name: 'Ethereum',
          type: 'TOKEN',
          chain: 'ethereum',
          balance: { amount: 1.5, decimals: 18, formatted: '1.5' },
          price: { value: 2000, currency: 'USD', timestamp: new Date() }
        })
      ],
      ...overrides
    });
  }
  
  static createMockEventHandlers(): {
    startedHandler: vi.Mock;
    completedHandler: vi.Mock;
    failedHandler: vi.Mock;
  } {
    return {
      startedHandler: vi.fn(),
      completedHandler: vi.fn(),
      failedHandler: vi.fn()
    };
  }
}
```

This implementation guide focuses on the service library patterns, dependency injection, and proper consumption by external applications. It removes the React-specific patterns that belong in the core application and provides clear examples of how to use this bounded context as a reusable service library.