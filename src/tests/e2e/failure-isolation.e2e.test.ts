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

describe('E2E: Single Integration Failure Isolation', () => {
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

  it('returns partial results when EVM integration fails', async () => {
    evmIntegration.setFailure(true, 'EVM RPC timeout');

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    // Should still have Solana and Robinhood assets
    expect(portfolio.assets.length).toBeGreaterThan(0);
    expect(portfolio.sources).toContain(IntegrationSource.SOLANA);
    expect(portfolio.sources).toContain(IntegrationSource.ROBINHOOD);
    expect(portfolio.sources).not.toContain(IntegrationSource.EVM);

    const symbols = portfolio.assets.map(a => a.symbol);
    expect(symbols).toContain('SOL');
    expect(symbols).not.toContain('ETH');
  });

  it('returns partial results when Solana integration fails', async () => {
    solanaIntegration.setFailure(true, 'Solana RPC unreachable');

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    expect(portfolio.assets.length).toBeGreaterThan(0);
    expect(portfolio.sources).toContain(IntegrationSource.EVM);
    expect(portfolio.sources).toContain(IntegrationSource.ROBINHOOD);
    expect(portfolio.sources).not.toContain(IntegrationSource.SOLANA);
  });

  it('returns partial results when Robinhood integration fails', async () => {
    robinhoodIntegration.setFailure(true, 'Robinhood API rate limit');

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    expect(portfolio.assets.length).toBeGreaterThan(0);
    expect(portfolio.sources).toContain(IntegrationSource.EVM);
    expect(portfolio.sources).toContain(IntegrationSource.SOLANA);

    const symbols = portfolio.assets.map(a => a.symbol);
    expect(symbols).not.toContain('AAPL');
  });

  it('isolates failure to the failing source without affecting others', async () => {
    solanaIntegration.setFailure(true, 'Network error');

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    // EVM assets should be fully intact
    const ethAsset = portfolio.assets.find(a => a.symbol === 'ETH');
    expect(ethAsset).toBeDefined();
    expect(ethAsset!.balance.amount).toBeCloseTo(2.5);

    // Robinhood assets should be fully intact
    const aaplAsset = portfolio.assets.find(a => a.symbol === 'AAPL');
    expect(aaplAsset).toBeDefined();
    expect(aaplAsset!.balance.amount).toBe(10);
  });

  it('still enriches remaining assets with prices after partial failure', async () => {
    evmIntegration.setFailure(true);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    // Remaining assets should still have enriched prices
    for (const asset of portfolio.assets) {
      expect(asset.price).toBeDefined();
      expect(asset.price!.value).toBeGreaterThan(0);
    }
  });
});

describe('E2E: All Integrations Fail Gracefully', () => {
  it('returns an empty portfolio when all integrations fail', async () => {
    const evmIntegration = new E2EMockIntegrationRepository({
      source: IntegrationSource.EVM,
      shouldFail: true,
      errorMessage: 'EVM down',
    });
    const solanaIntegration = new E2EMockIntegrationRepository({
      source: IntegrationSource.SOLANA,
      shouldFail: true,
      errorMessage: 'Solana down',
    });
    const robinhoodIntegration = new E2EMockIntegrationRepository({
      source: IntegrationSource.ROBINHOOD,
      shouldFail: true,
      errorMessage: 'Robinhood down',
    });

    const integrations = new Map<IntegrationSource, IIntegrationRepository>([
      [IntegrationSource.EVM, evmIntegration],
      [IntegrationSource.SOLANA, solanaIntegration],
      [IntegrationSource.ROBINHOOD, robinhoodIntegration],
    ]);

    const portfolioRepo = new InMemoryPortfolioRepository();
    const valuator = new E2EMockAssetValuator();
    const service = new PortfolioAggregationService(integrations, portfolioRepo, valuator);

    const addresses = new Map([
      ['ethereum', ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4']],
      ['solana', ['5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X']],
    ]);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'e2e-user',
      forceRefresh: true,
    });

    expect(portfolio).toBeDefined();
    expect(portfolio.assets.length).toBe(0);
    expect(portfolio.sources.length).toBe(0);
  });

  it('does not throw when all integrations fail', async () => {
    const evmIntegration = new E2EMockIntegrationRepository({
      source: IntegrationSource.EVM,
      shouldFail: true,
    });
    const solanaIntegration = new E2EMockIntegrationRepository({
      source: IntegrationSource.SOLANA,
      shouldFail: true,
    });

    const integrations = new Map<IntegrationSource, IIntegrationRepository>([
      [IntegrationSource.EVM, evmIntegration],
      [IntegrationSource.SOLANA, solanaIntegration],
    ]);

    const portfolioRepo = new InMemoryPortfolioRepository();
    const valuator = new E2EMockAssetValuator();
    const service = new PortfolioAggregationService(integrations, portfolioRepo, valuator);

    const addresses = new Map([['ethereum', ['0xabc']]]);

    await expect(
      service.aggregatePortfolio({
        addresses,
        userId: 'e2e-user',
        forceRefresh: true,
      })
    ).resolves.toBeDefined();
  });

  it('persists empty portfolio when all integrations fail', async () => {
    const evmIntegration = new E2EMockIntegrationRepository({
      source: IntegrationSource.EVM,
      shouldFail: true,
    });

    const integrations = new Map<IntegrationSource, IIntegrationRepository>([
      [IntegrationSource.EVM, evmIntegration],
    ]);

    const portfolioRepo = new InMemoryPortfolioRepository();
    const valuator = new E2EMockAssetValuator();
    const service = new PortfolioAggregationService(integrations, portfolioRepo, valuator);

    const addresses = new Map([['ethereum', ['0xabc']]]);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'fail-user',
      forceRefresh: true,
    });

    const saved = await portfolioRepo.findById(portfolio.id);
    expect(saved).toBeDefined();
    expect(saved!.assets.length).toBe(0);
  });
});
