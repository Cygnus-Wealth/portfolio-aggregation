import { describe, it, expect, beforeEach } from 'vitest';
import { PortfolioAggregationService } from '../../application/services/PortfolioAggregationService';
import { InMemoryPortfolioRepository } from '../mocks/InMemoryPortfolioRepository';
import { IntegrationSource, AssetType } from '../../shared/types';
import {
  E2EMockIntegrationRepository,
  E2EMockAssetValuator,
  createEVMAssets,
  createDuplicateEVMAssets,
  createSolanaAssets,
} from './mocks';
import type { IIntegrationRepository } from '../../contracts/repositories/IIntegrationRepository';

describe('E2E: Asset Reconciliation and Deduplication Across Sources', () => {
  let evmIntegration: E2EMockIntegrationRepository;
  let solanaIntegration: E2EMockIntegrationRepository;
  let portfolioRepo: InMemoryPortfolioRepository;
  let valuator: E2EMockAssetValuator;
  let service: PortfolioAggregationService;

  const ETH_ADDR_1 = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';
  const ETH_ADDR_2 = '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed';
  const SOL_ADDR = '5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X';

  beforeEach(() => {
    evmIntegration = new E2EMockIntegrationRepository({ source: IntegrationSource.EVM });
    solanaIntegration = new E2EMockIntegrationRepository({ source: IntegrationSource.SOLANA });

    portfolioRepo = new InMemoryPortfolioRepository();
    valuator = new E2EMockAssetValuator();
  });

  function createService() {
    const integrations = new Map<IntegrationSource, IIntegrationRepository>([
      [IntegrationSource.EVM, evmIntegration],
      [IntegrationSource.SOLANA, solanaIntegration],
    ]);
    return new PortfolioAggregationService(integrations, portfolioRepo, valuator);
  }

  it('merges duplicate ETH assets from the same chain across addresses', async () => {
    // Two addresses both holding ETH on Ethereum
    evmIntegration.addAssetsForAddress(ETH_ADDR_1, createEVMAssets(ETH_ADDR_1));
    evmIntegration.addAssetsForAddress(ETH_ADDR_2, createDuplicateEVMAssets(ETH_ADDR_2));
    service = createService();

    const addresses = new Map([
      ['ethereum', [ETH_ADDR_1, ETH_ADDR_2]],
    ]);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'recon-user',
      forceRefresh: true,
    });

    // ETH should be merged: 2.5 + 1.0 = 3.5
    const ethAssets = portfolio.assets.filter(a => a.symbol === 'ETH' && a.chain === 'ethereum');
    expect(ethAssets.length).toBe(1);
    expect(ethAssets[0].balance.amount).toBeCloseTo(3.5);
  });

  it('keeps USDC on different chains as separate assets', async () => {
    evmIntegration.addAssetsForAddress(ETH_ADDR_1, createEVMAssets(ETH_ADDR_1));
    solanaIntegration.addAssetsForAddress(SOL_ADDR, createSolanaAssets(SOL_ADDR));
    service = createService();

    const addresses = new Map([
      ['ethereum', [ETH_ADDR_1]],
      ['solana', [SOL_ADDR]],
    ]);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'recon-user',
      forceRefresh: true,
    });

    // USDC on Ethereum and USDC on Solana have different contract addresses/chains,
    // so they should remain separate
    const usdcAssets = portfolio.assets.filter(a => a.symbol === 'USDC');
    expect(usdcAssets.length).toBe(2);

    const chains = usdcAssets.map(a => a.chain).sort();
    expect(chains).toEqual(['ethereum', 'solana']);
  });

  it('preserves unique assets from different sources without merging', async () => {
    evmIntegration.addAssetsForAddress(ETH_ADDR_1, createEVMAssets(ETH_ADDR_1));
    solanaIntegration.addAssetsForAddress(SOL_ADDR, createSolanaAssets(SOL_ADDR));
    service = createService();

    const addresses = new Map([
      ['ethereum', [ETH_ADDR_1]],
      ['solana', [SOL_ADDR]],
    ]);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'recon-user',
      forceRefresh: true,
    });

    // ETH (ethereum), USDC (ethereum), SOL (solana), USDC (solana) = 4 distinct assets
    expect(portfolio.assets.length).toBe(4);

    const symbols = portfolio.assets.map(a => a.symbol).sort();
    expect(symbols).toEqual(['ETH', 'SOL', 'USDC', 'USDC']);
  });

  it('reconciles assets and calculates correct total value', async () => {
    evmIntegration.addAssetsForAddress(ETH_ADDR_1, createEVMAssets(ETH_ADDR_1));
    evmIntegration.addAssetsForAddress(ETH_ADDR_2, createDuplicateEVMAssets(ETH_ADDR_2));
    service = createService();

    const addresses = new Map([
      ['ethereum', [ETH_ADDR_1, ETH_ADDR_2]],
    ]);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'recon-user',
      forceRefresh: true,
    });

    // Merged ETH: 3.5 * 2500 = 8750
    // USDC: 5000 * 1 = 5000
    // Total = 13750
    const totalValue = portfolio.getTotalValue('USD');
    expect(totalValue.amount).toBeCloseTo(13750);
  });

  it('handles identical contract addresses across same chain as duplicates', async () => {
    const contractAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

    evmIntegration.addAssetsForAddress(ETH_ADDR_1, [{
      id: 'usdc-1',
      symbol: 'USDC',
      name: 'USD Coin',
      type: AssetType.CRYPTOCURRENCY,
      chain: 'ethereum',
      contractAddress: contractAddr,
      balance: { amount: 1000, decimals: 6, formatted: '1000.000000' },
      price: { value: 1, currency: 'USD', timestamp: new Date() },
      metadata: { address: ETH_ADDR_1, source: IntegrationSource.EVM }
    }]);

    evmIntegration.addAssetsForAddress(ETH_ADDR_2, [{
      id: 'usdc-2',
      symbol: 'USDC',
      name: 'USD Coin',
      type: AssetType.CRYPTOCURRENCY,
      chain: 'ethereum',
      contractAddress: contractAddr,
      balance: { amount: 2000, decimals: 6, formatted: '2000.000000' },
      price: { value: 1, currency: 'USD', timestamp: new Date() },
      metadata: { address: ETH_ADDR_2, source: IntegrationSource.EVM }
    }]);

    service = createService();

    const addresses = new Map([
      ['ethereum', [ETH_ADDR_1, ETH_ADDR_2]],
    ]);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'recon-user',
      forceRefresh: true,
    });

    const usdcAssets = portfolio.assets.filter(a => a.symbol === 'USDC');
    expect(usdcAssets.length).toBe(1);
    expect(usdcAssets[0].balance.amount).toBeCloseTo(3000);
  });

  it('handles empty address lists without errors', async () => {
    service = createService();

    const addresses = new Map<string, string[]>();

    const portfolio = await service.aggregatePortfolio({
      addresses,
      userId: 'recon-user',
      forceRefresh: true,
    });

    expect(portfolio.assets.length).toBe(0);
  });
});
