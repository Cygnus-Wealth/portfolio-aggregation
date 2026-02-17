import { describe, it, expect, vi } from 'vitest';
import { PortfolioAggregationService, AggregationOptions } from '../../../../application/services/PortfolioAggregationService';
import { IIntegrationRepository } from '../../../../contracts/repositories/IIntegrationRepository';
import { InMemoryPortfolioRepository } from '../../../mocks/InMemoryPortfolioRepository';
import { MockAssetValuator } from '../../../mocks/MockAssetValuator';
import {
  IntegrationSource,
  DeFiPositionType,
  DeFiProtocol,
  AssetType,
  Chain
} from '../../../../shared/types';
import type { DeFiPosition, Asset } from '../../../../shared/types';

// -- Helpers --

function createMockIntegration(
  source: IntegrationSource,
  options: {
    assets?: Asset[];
    defiPositions?: DeFiPosition[];
    shouldFailDeFi?: boolean;
    shouldFailAssets?: boolean;
  } = {}
): IIntegrationRepository {
  let connected = false;
  return {
    source,
    connect: vi.fn(async () => { connected = true; }),
    disconnect: vi.fn(async () => { connected = false; }),
    isConnected: vi.fn(() => connected),
    fetchPortfolio: vi.fn(async () => ({
      id: 'p', assets: [], totalValue: { value: 0, currency: 'USD', timestamp: new Date() },
      lastUpdated: new Date(), sources: [source]
    })),
    fetchAssets: vi.fn(async () => {
      if (options.shouldFailAssets) throw new Error(`${source} assets failed`);
      return options.assets || [];
    }),
    fetchTransactions: vi.fn(async () => []),
    getDeFiPositions: vi.fn(async () => {
      if (options.shouldFailDeFi) throw new Error(`${source} DeFi failed`);
      return options.defiPositions || [];
    })
  };
}

function createTestDeFiPosition(overrides: Partial<DeFiPosition> = {}): DeFiPosition {
  return {
    id: 'defi-1',
    type: DeFiPositionType.LENDING_SUPPLY,
    protocol: DeFiProtocol.AAVE,
    chain: 'ethereum' as Chain,
    underlyingAssets: [{ symbol: 'USDC', amount: 10000 }],
    value: { value: 10000, currency: 'USD', timestamp: new Date() },
    deduplicationKey: 'aave:ethereum:0xabc:lending_supply',
    ...overrides
  };
}

function createTestAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-eth-1',
    symbol: 'ETH',
    name: 'Ethereum',
    type: AssetType.TOKEN,
    chain: 'ethereum',
    balance: { amount: 1, decimals: 18, formatted: '1.0' },
    price: { value: 2500, currency: 'USD', timestamp: new Date() },
    metadata: { address: '0x123', source: IntegrationSource.EVM },
    ...overrides
  };
}

describe('DeFi Aggregation in PortfolioAggregationService', () => {
  let service: PortfolioAggregationService;
  let portfolioRepo: InMemoryPortfolioRepository;
  let assetValuator: MockAssetValuator;
  let integrations: Map<IntegrationSource, IIntegrationRepository>;

  const defaultOptions: AggregationOptions = {
    addresses: new Map([['ethereum', ['0x123']]]),
    forceRefresh: true
  };

  describe('scatter-gather getDeFiPositions', () => {
    it('calls getDeFiPositions on all integrations in parallel', async () => {
      const evmIntegration = createMockIntegration(IntegrationSource.EVM, {
        defiPositions: [createTestDeFiPosition()]
      });
      const solIntegration = createMockIntegration(IntegrationSource.SOLANA, {
        defiPositions: [createTestDeFiPosition({
          id: 'defi-marinade-1',
          protocol: DeFiProtocol.MARINADE,
          chain: 'solana',
          deduplicationKey: 'marinade:solana:0xabc:staking'
        })]
      });

      integrations = new Map([
        [IntegrationSource.EVM, evmIntegration],
        [IntegrationSource.SOLANA, solIntegration]
      ]);
      portfolioRepo = new InMemoryPortfolioRepository();
      assetValuator = new MockAssetValuator();
      service = new PortfolioAggregationService(integrations, portfolioRepo, assetValuator);

      const portfolio = await service.aggregatePortfolio({
        ...defaultOptions,
        addresses: new Map([
          ['ethereum', ['0x123']],
          ['solana', ['sol123']]
        ])
      });

      expect(evmIntegration.getDeFiPositions).toHaveBeenCalled();
      expect(solIntegration.getDeFiPositions).toHaveBeenCalled();
      expect(portfolio.defiPositions).toHaveLength(2);
    });

    it('handles integrations without getDeFiPositions gracefully', async () => {
      const integration: IIntegrationRepository = {
        source: IntegrationSource.ROBINHOOD,
        connect: vi.fn(async () => {}),
        disconnect: vi.fn(async () => {}),
        isConnected: vi.fn(() => true),
        fetchPortfolio: vi.fn(async () => ({
          id: 'p', assets: [], totalValue: { value: 0, currency: 'USD', timestamp: new Date() },
          lastUpdated: new Date(), sources: [IntegrationSource.ROBINHOOD]
        })),
        fetchAssets: vi.fn(async () => []),
        fetchTransactions: vi.fn(async () => [])
        // No getDeFiPositions
      };

      integrations = new Map([[IntegrationSource.ROBINHOOD, integration]]);
      portfolioRepo = new InMemoryPortfolioRepository();
      assetValuator = new MockAssetValuator();
      service = new PortfolioAggregationService(integrations, portfolioRepo, assetValuator);

      const portfolio = await service.aggregatePortfolio(defaultOptions);
      expect(portfolio.defiPositions).toHaveLength(0);
    });
  });

  describe('deduplication by deduplicationKey', () => {
    it('deduplicates positions with the same deduplicationKey across sources', async () => {
      const sameKey = 'aave:ethereum:0xabc:lending_supply';
      const evmIntegration = createMockIntegration(IntegrationSource.EVM, {
        defiPositions: [createTestDeFiPosition({ deduplicationKey: sameKey, id: 'evm-pos' })]
      });
      const solIntegration = createMockIntegration(IntegrationSource.SOLANA, {
        defiPositions: [createTestDeFiPosition({ deduplicationKey: sameKey, id: 'sol-pos' })]
      });

      integrations = new Map([
        [IntegrationSource.EVM, evmIntegration],
        [IntegrationSource.SOLANA, solIntegration]
      ]);
      portfolioRepo = new InMemoryPortfolioRepository();
      assetValuator = new MockAssetValuator();
      service = new PortfolioAggregationService(integrations, portfolioRepo, assetValuator);

      const portfolio = await service.aggregatePortfolio({
        ...defaultOptions,
        addresses: new Map([
          ['ethereum', ['0x123']],
          ['solana', ['sol123']]
        ])
      });

      expect(portfolio.defiPositions).toHaveLength(1);
    });

    it('keeps positions with different deduplicationKeys', async () => {
      const evmIntegration = createMockIntegration(IntegrationSource.EVM, {
        defiPositions: [
          createTestDeFiPosition({ deduplicationKey: 'aave:ethereum:0xabc:supply' }),
          createTestDeFiPosition({ deduplicationKey: 'beefy:ethereum:0xvault:vault', id: 'v1' })
        ]
      });

      integrations = new Map([[IntegrationSource.EVM, evmIntegration]]);
      portfolioRepo = new InMemoryPortfolioRepository();
      assetValuator = new MockAssetValuator();
      service = new PortfolioAggregationService(integrations, portfolioRepo, assetValuator);

      const portfolio = await service.aggregatePortfolio(defaultOptions);
      expect(portfolio.defiPositions).toHaveLength(2);
    });
  });

  describe('partial failure strategy', () => {
    it('returns DeFi from healthy sources when one source fails', async () => {
      const evmIntegration = createMockIntegration(IntegrationSource.EVM, {
        defiPositions: [createTestDeFiPosition()]
      });
      const solIntegration = createMockIntegration(IntegrationSource.SOLANA, {
        shouldFailDeFi: true
      });

      integrations = new Map([
        [IntegrationSource.EVM, evmIntegration],
        [IntegrationSource.SOLANA, solIntegration]
      ]);
      portfolioRepo = new InMemoryPortfolioRepository();
      assetValuator = new MockAssetValuator();
      service = new PortfolioAggregationService(integrations, portfolioRepo, assetValuator);

      const portfolio = await service.aggregatePortfolio({
        ...defaultOptions,
        addresses: new Map([
          ['ethereum', ['0x123']],
          ['solana', ['sol123']]
        ])
      });

      // EVM DeFi positions still present despite Solana failure
      expect(portfolio.defiPositions).toHaveLength(1);
      expect(portfolio.defiPositions[0].protocol).toBe(DeFiProtocol.AAVE);
    });

    it('assets still work when DeFi fails for a source', async () => {
      const evmIntegration = createMockIntegration(IntegrationSource.EVM, {
        assets: [createTestAsset()],
        shouldFailDeFi: true
      });

      integrations = new Map([[IntegrationSource.EVM, evmIntegration]]);
      portfolioRepo = new InMemoryPortfolioRepository();
      assetValuator = new MockAssetValuator();
      service = new PortfolioAggregationService(integrations, portfolioRepo, assetValuator);

      const portfolio = await service.aggregatePortfolio(defaultOptions);

      expect(portfolio.assets.length).toBeGreaterThan(0);
      expect(portfolio.defiPositions).toHaveLength(0);
    });
  });

  describe('receipt token coordination', () => {
    it('filters out receipt tokens from assets to prevent double-counting', async () => {
      const receiptTokenAddress = '0xReceiptToken';
      const evmIntegration = createMockIntegration(IntegrationSource.EVM, {
        assets: [
          createTestAsset(),
          createTestAsset({
            id: 'receipt-token',
            symbol: 'aUSDC',
            contractAddress: receiptTokenAddress,
            balance: { amount: 10000, decimals: 6, formatted: '10000.0' }
          })
        ],
        defiPositions: [
          createTestDeFiPosition({
            receiptTokenAddress: receiptTokenAddress
          })
        ]
      });

      integrations = new Map([[IntegrationSource.EVM, evmIntegration]]);
      portfolioRepo = new InMemoryPortfolioRepository();
      assetValuator = new MockAssetValuator();
      service = new PortfolioAggregationService(integrations, portfolioRepo, assetValuator);

      const portfolio = await service.aggregatePortfolio(defaultOptions);

      // The receipt token (aUSDC) should be filtered out
      const symbols = portfolio.assets.map(a => a.symbol);
      expect(symbols).not.toContain('aUSDC');
      expect(symbols).toContain('ETH');

      // DeFi position should remain
      expect(portfolio.defiPositions).toHaveLength(1);
    });
  });

  describe('DeFi value aggregation', () => {
    it('supply positions add to portfolio total', async () => {
      const evmIntegration = createMockIntegration(IntegrationSource.EVM, {
        assets: [createTestAsset()], // ETH at $2500
        defiPositions: [createTestDeFiPosition({
          value: { value: 10000, currency: 'USD', timestamp: new Date() }
        })]
      });

      integrations = new Map([[IntegrationSource.EVM, evmIntegration]]);
      portfolioRepo = new InMemoryPortfolioRepository();
      assetValuator = new MockAssetValuator();
      service = new PortfolioAggregationService(integrations, portfolioRepo, assetValuator);

      const portfolio = await service.aggregatePortfolio(defaultOptions);
      const total = portfolio.getTotalValue();

      // ETH ($2500) + DeFi supply ($10000) = $12500
      expect(total.amount).toBe(12500);
    });

    it('borrow positions subtract from portfolio total', async () => {
      const evmIntegration = createMockIntegration(IntegrationSource.EVM, {
        assets: [createTestAsset()], // ETH at $2500
        defiPositions: [
          createTestDeFiPosition({
            value: { value: 10000, currency: 'USD', timestamp: new Date() }
          }),
          createTestDeFiPosition({
            id: 'borrow-1',
            type: DeFiPositionType.LENDING_BORROW,
            deduplicationKey: 'aave:ethereum:0xabc:lending_borrow',
            value: { value: 3000, currency: 'USD', timestamp: new Date() }
          })
        ]
      });

      integrations = new Map([[IntegrationSource.EVM, evmIntegration]]);
      portfolioRepo = new InMemoryPortfolioRepository();
      assetValuator = new MockAssetValuator();
      service = new PortfolioAggregationService(integrations, portfolioRepo, assetValuator);

      const portfolio = await service.aggregatePortfolio(defaultOptions);
      const total = portfolio.getTotalValue();

      // ETH ($2500) + DeFi supply ($10000) - DeFi borrow ($3000) = $9500
      expect(total.amount).toBe(9500);
    });
  });

  describe('DeFi price enrichment', () => {
    it('prices unpriced DeFi positions from underlying assets', async () => {
      const evmIntegration = createMockIntegration(IntegrationSource.EVM, {
        defiPositions: [createTestDeFiPosition({
          value: undefined, // Not priced yet
          underlyingAssets: [
            { symbol: 'ETH', amount: 2 },
            { symbol: 'USDC', amount: 5000 }
          ]
        })]
      });

      integrations = new Map([[IntegrationSource.EVM, evmIntegration]]);
      portfolioRepo = new InMemoryPortfolioRepository();
      assetValuator = new MockAssetValuator();
      // MockAssetValuator has ETH=$2500 and USDC=$1 by default
      service = new PortfolioAggregationService(integrations, portfolioRepo, assetValuator);

      const portfolio = await service.aggregatePortfolio(defaultOptions);

      expect(portfolio.defiPositions).toHaveLength(1);
      const pos = portfolio.defiPositions[0];
      // 2 ETH * $2500 + 5000 USDC * $1 = $10000
      expect(pos.value).toBeDefined();
      expect(pos.value!.value).toBe(10000);
    });

    it('does not overwrite existing price on DeFi positions', async () => {
      const evmIntegration = createMockIntegration(IntegrationSource.EVM, {
        defiPositions: [createTestDeFiPosition({
          value: { value: 99999, currency: 'USD', timestamp: new Date() },
          underlyingAssets: [{ symbol: 'ETH', amount: 2 }]
        })]
      });

      integrations = new Map([[IntegrationSource.EVM, evmIntegration]]);
      portfolioRepo = new InMemoryPortfolioRepository();
      assetValuator = new MockAssetValuator();
      service = new PortfolioAggregationService(integrations, portfolioRepo, assetValuator);

      const portfolio = await service.aggregatePortfolio(defaultOptions);
      expect(portfolio.defiPositions[0].value!.value).toBe(99999);
    });
  });
});
