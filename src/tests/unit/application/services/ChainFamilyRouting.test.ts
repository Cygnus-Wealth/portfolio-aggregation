import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortfolioAggregationService } from '../../../../application/services/PortfolioAggregationService';
import { InMemoryPortfolioRepository } from '../../../mocks/InMemoryPortfolioRepository';
import { MockAssetValuator } from '../../../mocks/MockAssetValuator';
import type { IIntegrationRepository } from '../../../../contracts/repositories/IIntegrationRepository';
import { IntegrationSource, AssetType, Chain } from '../../../../shared/types';
import type { Asset } from '../../../../shared/types';

function createMockIntegration(
  source: IntegrationSource,
  assetsFactory?: (addresses: string[]) => Asset[]
): IIntegrationRepository {
  let connected = false;
  return {
    source,
    connect: vi.fn(async () => { connected = true; }),
    disconnect: vi.fn(async () => { connected = false; }),
    isConnected: vi.fn(() => connected),
    fetchPortfolio: vi.fn(async () => ({
      id: 'p1', assets: [], totalValue: { value: 0, currency: 'USD', timestamp: new Date() },
      lastUpdated: new Date(), sources: [source],
    })),
    fetchAssets: vi.fn(async (addresses: string[]) => {
      if (assetsFactory) return assetsFactory(addresses);
      return [];
    }),
    fetchTransactions: vi.fn(async () => [] as never[]),
  };
}

describe('Chain-family routing in PortfolioAggregationService', () => {
  let evmIntegration: IIntegrationRepository;
  let solanaIntegration: IIntegrationRepository;
  let portfolioRepo: InMemoryPortfolioRepository;
  let valuator: MockAssetValuator;

  beforeEach(() => {
    evmIntegration = createMockIntegration(IntegrationSource.EVM, (addrs) =>
      addrs.map((_addr, i) => ({
        id: `evm-asset-${i}`,
        symbol: 'ETH',
        type: AssetType.TOKEN,
        chain: Chain.ETHEREUM,
        balance: { amount: 1, decimals: 18, formatted: '1.0' },
      }))
    );

    solanaIntegration = createMockIntegration(IntegrationSource.SOLANA, (addrs) =>
      addrs.map((_addr, i) => ({
        id: `sol-asset-${i}`,
        symbol: 'SOL',
        type: AssetType.TOKEN,
        chain: Chain.SOLANA,
        balance: { amount: 10, decimals: 9, formatted: '10.0' },
      }))
    );

    portfolioRepo = new InMemoryPortfolioRepository();
    valuator = new MockAssetValuator();
  });

  it('routes EVM chain addresses only to EVM integration', async () => {
    const integrations = new Map<IntegrationSource, IIntegrationRepository>();
    integrations.set(IntegrationSource.EVM, evmIntegration);
    integrations.set(IntegrationSource.SOLANA, solanaIntegration);

    const service = new PortfolioAggregationService(
      integrations,
      portfolioRepo,
      valuator
    );

    const addresses = new Map<string, string[]>();
    addresses.set('ethereum', ['0xAAA']);
    addresses.set('polygon', ['0xBBB']);

    await service.aggregatePortfolio({
      addresses,
      forceRefresh: true,
    });

    // EVM integration should have been called with EVM addresses
    expect(evmIntegration.fetchAssets).toHaveBeenCalled();
    const evmCallArgs = (evmIntegration.fetchAssets as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(evmCallArgs).toContain('0xAAA');
    expect(evmCallArgs).toContain('0xBBB');

    // Solana integration should NOT have been called with EVM addresses
    // (it should only get solana addresses, which are empty here)
    const solCalls = (solanaIntegration.fetchAssets as ReturnType<typeof vi.fn>).mock.calls;
    if (solCalls.length > 0) {
      expect(solCalls[0][0]).not.toContain('0xAAA');
      expect(solCalls[0][0]).not.toContain('0xBBB');
    }
  });

  it('routes solana addresses only to Solana integration', async () => {
    const integrations = new Map<IntegrationSource, IIntegrationRepository>();
    integrations.set(IntegrationSource.EVM, evmIntegration);
    integrations.set(IntegrationSource.SOLANA, solanaIntegration);

    const service = new PortfolioAggregationService(
      integrations,
      portfolioRepo,
      valuator
    );

    const addresses = new Map<string, string[]>();
    addresses.set('solana', ['SolAddr1']);

    await service.aggregatePortfolio({
      addresses,
      forceRefresh: true,
    });

    // Solana integration should get solana addresses
    expect(solanaIntegration.fetchAssets).toHaveBeenCalled();
    const solCallArgs = (solanaIntegration.fetchAssets as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(solCallArgs).toContain('SolAddr1');

    // EVM integration should not get solana addresses
    const evmCalls = (evmIntegration.fetchAssets as ReturnType<typeof vi.fn>).mock.calls;
    if (evmCalls.length > 0) {
      expect(evmCalls[0][0]).not.toContain('SolAddr1');
    }
  });

  it('never deduplicates assets across different chain families', async () => {
    // Same USDC symbol on EVM and Solana — must NOT be merged
    const evmWithUsdc = createMockIntegration(IntegrationSource.EVM, () => [{
      id: 'evm-usdc',
      symbol: 'USDC',
      type: AssetType.TOKEN,
      chain: Chain.ETHEREUM,
      contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      balance: { amount: 1000, decimals: 6, formatted: '1000.0' },
    }]);

    const solWithUsdc = createMockIntegration(IntegrationSource.SOLANA, () => [{
      id: 'sol-usdc',
      symbol: 'USDC',
      type: AssetType.TOKEN,
      chain: Chain.SOLANA,
      contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      balance: { amount: 500, decimals: 6, formatted: '500.0' },
    }]);

    const integrations = new Map<IntegrationSource, IIntegrationRepository>();
    integrations.set(IntegrationSource.EVM, evmWithUsdc);
    integrations.set(IntegrationSource.SOLANA, solWithUsdc);

    const service = new PortfolioAggregationService(
      integrations,
      portfolioRepo,
      valuator
    );

    const addresses = new Map<string, string[]>();
    addresses.set('ethereum', ['0xAAA']);
    addresses.set('solana', ['SolAddr1']);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      forceRefresh: true,
    });

    // Both USDC instances should exist as separate assets (different chains/families)
    const usdcAssets = portfolio.assets.filter(a => a.symbol === 'USDC');
    expect(usdcAssets.length).toBe(2);

    // Verify they have different chains
    const chains = usdcAssets.map(a => a.chain);
    expect(chains).toContain(Chain.ETHEREUM);
    expect(chains).toContain(Chain.SOLANA);
  });

  it('deduplicates assets within same chain family', async () => {
    // Same address on ethereum and polygon — same EVM family, same USDC contract
    const evmIntWithDups = createMockIntegration(IntegrationSource.EVM, () => [
      {
        id: 'eth-usdc',
        symbol: 'USDC',
        type: AssetType.TOKEN,
        chain: Chain.ETHEREUM,
        contractAddress: '0xA0b86991',
        balance: { amount: 1000, decimals: 6, formatted: '1000.0' },
      },
      {
        id: 'eth-usdc-dup',
        symbol: 'USDC',
        type: AssetType.TOKEN,
        chain: Chain.ETHEREUM,
        contractAddress: '0xA0b86991',
        balance: { amount: 500, decimals: 6, formatted: '500.0' },
      },
    ]);

    const integrations = new Map<IntegrationSource, IIntegrationRepository>();
    integrations.set(IntegrationSource.EVM, evmIntWithDups);

    const service = new PortfolioAggregationService(
      integrations,
      portfolioRepo,
      valuator
    );

    const addresses = new Map<string, string[]>();
    addresses.set('ethereum', ['0xAAA']);

    const portfolio = await service.aggregatePortfolio({
      addresses,
      forceRefresh: true,
    });

    // Same chain + same contract = merged (balance summed)
    const usdcAssets = portfolio.assets.filter(a => a.symbol === 'USDC');
    expect(usdcAssets.length).toBe(1);
    expect(usdcAssets[0].balance.amount).toBe(1500);
  });
});
