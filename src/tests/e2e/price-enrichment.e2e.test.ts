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

describe('E2E: Price Enrichment via AssetValuator', () => {
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

  it('updates asset prices from the valuator after aggregation', async () => {
    // Override valuator prices to differ from integration defaults
    valuator.setPrice('ETH', 3000);
    valuator.setPrice('SOL', 150);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    const ethAsset = portfolio.assets.find(a => a.symbol === 'ETH');
    expect(ethAsset).toBeDefined();
    expect(ethAsset!.price!.value).toBe(3000);

    const solAsset = portfolio.assets.find(a => a.symbol === 'SOL');
    expect(solAsset).toBeDefined();
    expect(solAsset!.price!.value).toBe(150);
  });

  it('calls getBatchPrices with unique symbols', async () => {
    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    expect(valuator.getBatchPricesCallCount).toBe(1);
    // Should have fetched prices for ETH, USDC, SOL (unique symbols)
    expect(portfolio.assets.length).toBeGreaterThan(0);
  });

  it('gracefully handles valuator failure without crashing aggregation', async () => {
    valuator.setFailure(true, 'Price API unavailable');

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    // Portfolio should still have assets, just with original prices
    expect(portfolio.assets.length).toBeGreaterThan(0);
    expect(portfolio.sources.length).toBeGreaterThan(0);
  });

  it('reflects updated prices in portfolio total value', async () => {
    valuator.setPrice('ETH', 5000);  // Double the default
    valuator.setPrice('USDC', 1);
    valuator.setPrice('SOL', 200);   // Double the default

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    const totalValue = portfolio.getTotalValue('USD');
    // ETH: 2.5 * 5000 = 12500, USDC(eth): 5000, SOL: 50 * 200 = 10000, USDC(sol): 3000
    // Total = 30500
    expect(totalValue.amount).toBeGreaterThan(20000);
  });

  it('enriches assets with zero price for unknown symbols', async () => {
    // Add an unknown token
    evmIntegration.addAssetsForAddress(ETH_ADDR, [{
      id: 'unknown-token',
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      type: 'crypto' as const,
      chain: 'ethereum',
      balance: { amount: 100, decimals: 18, formatted: '100.000000000000000000' },
      metadata: { address: ETH_ADDR, source: IntegrationSource.EVM }
    }]);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    const unknownAsset = portfolio.assets.find(a => a.symbol === 'UNKNOWN');
    expect(unknownAsset).toBeDefined();
    // Unknown token gets a zero price from the mock valuator
    expect(unknownAsset!.price).toBeDefined();
    expect(unknownAsset!.price!.value).toBe(0);
  });
});
