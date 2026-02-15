import { describe, it, expect, beforeEach } from 'vitest';
import { PortfolioAggregationService } from '../../application/services/PortfolioAggregationService';
import { InMemoryPortfolioRepository } from '../mocks/InMemoryPortfolioRepository';
import { IntegrationSource } from '../../shared/types';
import {
  E2EMockIntegrationRepository,
  E2EMockAssetValuator,
  createEVMAssets,
  createSolanaAssets,
} from './mocks';
import type { IIntegrationRepository } from '../../contracts/repositories/IIntegrationRepository';

describe('E2E: Portfolio Refresh Lifecycle', () => {
  let evmIntegration: E2EMockIntegrationRepository;
  let solanaIntegration: E2EMockIntegrationRepository;
  let portfolioRepo: InMemoryPortfolioRepository;
  let valuator: E2EMockAssetValuator;
  let service: PortfolioAggregationService;
  let addresses: Map<string, string[]>;

  const ETH_ADDR = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';
  const SOL_ADDR = '5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X';

  beforeEach(() => {
    evmIntegration = new E2EMockIntegrationRepository({ source: IntegrationSource.EVM });
    solanaIntegration = new E2EMockIntegrationRepository({ source: IntegrationSource.SOLANA });

    evmIntegration.addAssetsForAddress(ETH_ADDR, createEVMAssets(ETH_ADDR));
    solanaIntegration.addAssetsForAddress(SOL_ADDR, createSolanaAssets(SOL_ADDR));

    const integrations = new Map<IntegrationSource, IIntegrationRepository>([
      [IntegrationSource.EVM, evmIntegration],
      [IntegrationSource.SOLANA, solanaIntegration],
    ]);

    portfolioRepo = new InMemoryPortfolioRepository();
    valuator = new E2EMockAssetValuator();
    service = new PortfolioAggregationService(integrations, portfolioRepo, valuator);

    addresses = new Map([
      ['ethereum', [ETH_ADDR]],
      ['solana', [SOL_ADDR]],
    ]);
  });

  it('creates and persists a portfolio, then force-refreshes with same data', async () => {
    const initial = await service.aggregatePortfolio({
      addresses,
      userId: 'refresh-user',
      forceRefresh: true,
    });

    const initialAssetCount = initial.assets.length;
    expect(initialAssetCount).toBeGreaterThan(0);

    // Force refresh re-fetches from integrations
    const refreshed = await service.aggregatePortfolio({
      addresses,
      userId: 'refresh-user',
      forceRefresh: true,
    });

    expect(refreshed.id).toBe(initial.id);
    expect(refreshed.assets.length).toBe(initialAssetCount);
  });

  it('throws when refreshing a non-existent portfolio', async () => {
    await expect(
      service.refreshPortfolio('nonexistent-portfolio')
    ).rejects.toThrow('Portfolio not found');
  });

  it('picks up new assets on force-refresh', async () => {
    const initial = await service.aggregatePortfolio({
      addresses,
      userId: 'refresh-user',
      forceRefresh: true,
    });

    const initialCount = initial.assets.length;

    // Add a new asset to the EVM integration
    evmIntegration.addAssetsForAddress(ETH_ADDR, [{
      id: 'new-link',
      symbol: 'LINK',
      name: 'Chainlink',
      type: 'crypto' as const,
      chain: 'ethereum',
      balance: { amount: 100, decimals: 18, formatted: '100.000000000000000000' },
      price: { value: 15, currency: 'USD', timestamp: new Date() },
      metadata: { address: ETH_ADDR, source: IntegrationSource.EVM }
    }]);

    const refreshed = await service.aggregatePortfolio({
      addresses,
      userId: 'refresh-user',
      forceRefresh: true,
    });

    expect(refreshed.assets.length).toBeGreaterThan(initialCount);
    const symbols = refreshed.assets.map(a => a.symbol);
    expect(symbols).toContain('LINK');
  });

  it('reflects updated valuator prices after force-refresh', async () => {
    await service.aggregatePortfolio({
      addresses,
      userId: 'refresh-user',
      forceRefresh: true,
    });

    // Update the valuator price
    valuator.setPrice('ETH', 4000);

    const refreshed = await service.aggregatePortfolio({
      addresses,
      userId: 'refresh-user',
      forceRefresh: true,
    });

    const refreshedEth = refreshed.assets.find(a => a.symbol === 'ETH');
    expect(refreshedEth).toBeDefined();
    expect(refreshedEth!.price!.value).toBe(4000);
  });

  it('maintains portfolio identity across multiple refreshes', async () => {
    const initial = await service.aggregatePortfolio({
      addresses,
      userId: 'refresh-user',
      forceRefresh: true,
    });

    const refresh1 = await service.aggregatePortfolio({
      addresses,
      userId: 'refresh-user',
      forceRefresh: true,
    });

    const refresh2 = await service.aggregatePortfolio({
      addresses,
      userId: 'refresh-user',
      forceRefresh: true,
    });

    expect(refresh1.id).toBe(initial.id);
    expect(refresh2.id).toBe(initial.id);
    expect(refresh2.userId).toBe(initial.userId);
  });

  it('serves cached data between refreshes', async () => {
    await service.aggregatePortfolio({
      addresses,
      userId: 'refresh-user',
      forceRefresh: true,
    });

    const fetchCountBefore = evmIntegration.fetchCallCount;

    // Non-forced call should use cache
    await service.aggregatePortfolio({
      addresses,
      userId: 'refresh-user',
    });

    expect(evmIntegration.fetchCallCount).toBe(fetchCountBefore);
  });
});
