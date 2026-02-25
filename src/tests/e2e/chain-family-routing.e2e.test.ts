import { describe, it, expect, beforeEach } from 'vitest';
import { PortfolioAggregationService } from '../../application/services/PortfolioAggregationService';
import { IntegrationSource, AssetType, Chain } from '../../shared/types';
import {
  E2EMockIntegrationRepository,
  createEVMAssets,
  createSolanaAssets,
} from './mocks/E2EMockIntegrationRepository';
import { E2EMockAssetValuator } from './mocks/E2EMockAssetValuator';
import { InMemoryPortfolioRepository } from '../mocks/InMemoryPortfolioRepository';
import { ChainFamily } from '../../domain/services/ChainFamilyRouter';

describe('E2E: Chain-Family Routing', () => {
  let evmIntegration: E2EMockIntegrationRepository;
  let solanaIntegration: E2EMockIntegrationRepository;
  let portfolioRepo: InMemoryPortfolioRepository;
  let valuator: E2EMockAssetValuator;
  let service: PortfolioAggregationService;

  beforeEach(() => {
    evmIntegration = new E2EMockIntegrationRepository({
      source: IntegrationSource.EVM,
    });
    solanaIntegration = new E2EMockIntegrationRepository({
      source: IntegrationSource.SOLANA,
    });
    portfolioRepo = new InMemoryPortfolioRepository();
    valuator = new E2EMockAssetValuator();

    const integrations = new Map();
    integrations.set(IntegrationSource.EVM, evmIntegration);
    integrations.set(IntegrationSource.SOLANA, solanaIntegration);

    service = new PortfolioAggregationService(
      integrations,
      portfolioRepo,
      valuator
    );
  });

  it('routes multi-chain EVM addresses to EVM integration only', async () => {
    const ethAddr = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';
    const polyAddr = '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed';

    evmIntegration.addAssetsForAddress(ethAddr, createEVMAssets(ethAddr));
    evmIntegration.addAssetsForAddress(polyAddr, createEVMAssets(polyAddr));

    const addresses = new Map<string, string[]>();
    addresses.set('ethereum', [ethAddr]);
    addresses.set('polygon', [polyAddr]);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      forceRefresh: true,
    });

    // EVM integration should have been called
    expect(evmIntegration.fetchCallCount).toBe(1);
    // Solana integration should NOT have been called (no solana addresses)
    expect(solanaIntegration.fetchCallCount).toBe(0);
    // Portfolio should have assets
    expect(portfolio.assets.length).toBeGreaterThan(0);
  });

  it('routes addresses to correct chain-family integration in parallel', async () => {
    const ethAddr = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';
    const solAddr = '5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X';

    evmIntegration.addAssetsForAddress(ethAddr, createEVMAssets(ethAddr));
    solanaIntegration.addAssetsForAddress(solAddr, createSolanaAssets(solAddr));

    const addresses = new Map<string, string[]>();
    addresses.set('ethereum', [ethAddr]);
    addresses.set('solana', [solAddr]);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      forceRefresh: true,
    });

    // Both integrations should have been called
    expect(evmIntegration.fetchCallCount).toBe(1);
    expect(solanaIntegration.fetchCallCount).toBe(1);

    // Portfolio should contain assets from both chains
    const ethAssets = portfolio.assets.filter(a => a.chain === Chain.ETHEREUM);
    const solAssets = portfolio.assets.filter(a => a.chain === Chain.SOLANA);
    expect(ethAssets.length).toBeGreaterThan(0);
    expect(solAssets.length).toBeGreaterThan(0);
  });

  it('preserves cross-chain-family USDC as separate assets', async () => {
    const ethAddr = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';
    const solAddr = '5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X';

    evmIntegration.addAssetsForAddress(ethAddr, createEVMAssets(ethAddr));
    solanaIntegration.addAssetsForAddress(solAddr, createSolanaAssets(solAddr));

    const addresses = new Map<string, string[]>();
    addresses.set('ethereum', [ethAddr]);
    addresses.set('solana', [solAddr]);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      forceRefresh: true,
    });

    // USDC on Ethereum and USDC on Solana must remain separate
    const usdcAssets = portfolio.assets.filter(a => a.symbol === 'USDC');
    expect(usdcAssets.length).toBe(2);

    const usdcChains = usdcAssets.map(a => a.chain);
    expect(usdcChains).toContain(Chain.ETHEREUM);
    expect(usdcChains).toContain(Chain.SOLANA);

    // Balances should NOT be merged
    const ethUsdc = usdcAssets.find(a => a.chain === Chain.ETHEREUM)!;
    const solUsdc = usdcAssets.find(a => a.chain === Chain.SOLANA)!;
    expect(ethUsdc.balance.amount).toBe(5000);
    expect(solUsdc.balance.amount).toBe(3000);
  });

  it('handles addresses with no matching integration gracefully', async () => {
    const addresses = new Map<string, string[]>();
    // Bitcoin has no integration yet
    addresses.set('bitcoin', ['bc1qtest']);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      forceRefresh: true,
    });

    // Should return empty portfolio without error
    expect(portfolio.assets.length).toBe(0);
  });
});
