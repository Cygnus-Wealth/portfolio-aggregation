import { describe, it, expect, beforeEach } from 'vitest';
import { PortfolioAggregationService } from '../../application/services/PortfolioAggregationService';
import { InMemoryPortfolioRepository } from '../mocks/InMemoryPortfolioRepository';
import { IntegrationSource } from '../../shared/types';
import {
  E2EMockIntegrationRepository,
  E2EMockAssetValuator,
  createEVMAssets,
  createSolanaAssets,
  createRobinhoodAssets,
} from './mocks';
import type { IIntegrationRepository } from '../../contracts/repositories/IIntegrationRepository';

describe('E2E: Full Portfolio Sync with Mocked Integrations', () => {
  let evmIntegration: E2EMockIntegrationRepository;
  let solanaIntegration: E2EMockIntegrationRepository;
  let robinhoodIntegration: E2EMockIntegrationRepository;
  let portfolioRepo: InMemoryPortfolioRepository;
  let valuator: E2EMockAssetValuator;
  let service: PortfolioAggregationService;
  let addresses: Map<string, string[]>;

  const ETH_ADDR = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';
  const SOL_ADDR = '5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X';

  beforeEach(() => {
    evmIntegration = new E2EMockIntegrationRepository({ source: IntegrationSource.EVM });
    solanaIntegration = new E2EMockIntegrationRepository({ source: IntegrationSource.SOLANA });
    robinhoodIntegration = new E2EMockIntegrationRepository({ source: IntegrationSource.ROBINHOOD });

    evmIntegration.addAssetsForAddress(ETH_ADDR, createEVMAssets(ETH_ADDR));
    solanaIntegration.addAssetsForAddress(SOL_ADDR, createSolanaAssets(SOL_ADDR));
    robinhoodIntegration.addAssetsForAddress('default', createRobinhoodAssets());

    const integrations = new Map<IntegrationSource, IIntegrationRepository>([
      [IntegrationSource.EVM, evmIntegration],
      [IntegrationSource.SOLANA, solanaIntegration],
      [IntegrationSource.ROBINHOOD, robinhoodIntegration],
    ]);

    portfolioRepo = new InMemoryPortfolioRepository();
    valuator = new E2EMockAssetValuator();
    service = new PortfolioAggregationService(integrations, portfolioRepo, valuator);

    addresses = new Map([
      ['ethereum', [ETH_ADDR]],
      ['solana', [SOL_ADDR]],
    ]);
  });

  it('aggregates assets from all three integration sources', async () => {
    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    expect(portfolio).toBeDefined();
    expect(portfolio.assets.length).toBeGreaterThanOrEqual(5);
    expect(portfolio.sources).toContain(IntegrationSource.EVM);
    expect(portfolio.sources).toContain(IntegrationSource.SOLANA);
    expect(portfolio.sources).toContain(IntegrationSource.ROBINHOOD);
  });

  it('connects to each integration before fetching', async () => {
    await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    expect(evmIntegration.connectCallCount).toBeGreaterThanOrEqual(1);
    expect(solanaIntegration.connectCallCount).toBeGreaterThanOrEqual(1);
    expect(robinhoodIntegration.connectCallCount).toBeGreaterThanOrEqual(1);
  });

  it('enriches all assets with prices from the valuator', async () => {
    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    expect(valuator.getBatchPricesCallCount).toBeGreaterThanOrEqual(1);

    for (const asset of portfolio.assets) {
      expect(asset.price).toBeDefined();
      expect(asset.price!.value).toBeGreaterThan(0);
    }
  });

  it('persists the aggregated portfolio to the repository', async () => {
    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    const saved = await portfolioRepo.findById(portfolio.id);
    expect(saved).toBeDefined();
    expect(saved!.id).toBe(portfolio.id);
    expect(saved!.assets.length).toBe(portfolio.assets.length);
  });

  it('returns cached portfolio when not forcing refresh', async () => {
    const first = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    const fetchCountBefore = evmIntegration.fetchCallCount;

    const second = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: false,
    });

    expect(second.id).toBe(first.id);
    // Should not have fetched again
    expect(evmIntegration.fetchCallCount).toBe(fetchCountBefore);
  });

  it('calculates total portfolio value across all sources', async () => {
    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    const totalValue = portfolio.getTotalValue('USD');
    // ETH: 2.5 * 2500 = 6250 + some USDC merging + SOL: 50 * 100 = 5000 + Robinhood assets
    expect(totalValue.amount).toBeGreaterThan(0);
  });

  it('aggregates with a subset of sources', async () => {
    const portfolio = await service.aggregatePortfolio({
      sources: [IntegrationSource.EVM],
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    expect(portfolio.sources).toContain(IntegrationSource.EVM);
    expect(portfolio.sources).not.toContain(IntegrationSource.SOLANA);

    const symbols = portfolio.assets.map(a => a.symbol);
    expect(symbols).toContain('ETH');
    expect(symbols).not.toContain('SOL');
  });

  it('handles the full lifecycle: create, cache, refresh', async () => {
    // Step 1: Initial aggregation
    const initial = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });
    expect(initial.assets.length).toBeGreaterThan(0);

    // Step 2: Cache hit
    const cached = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
    });
    expect(cached.id).toBe(initial.id);

    // Step 3: Force refresh
    const refreshed = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });
    expect(refreshed.id).toBe(initial.id);
    expect(refreshed.assets.length).toBeGreaterThan(0);
  });
});
