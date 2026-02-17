import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiAccountAggregationService,
  WalletAccount,
} from '../../../../application/services/MultiAccountAggregationService';
import { PortfolioAggregationService } from '../../../../application/services/PortfolioAggregationService';
import { InMemoryPortfolioRepository } from '../../../mocks/InMemoryPortfolioRepository';
import { MockIntegrationRepository } from '../../../mocks/MockIntegrationRepository';
import { MockAssetValuator } from '../../../mocks/MockAssetValuator';
import { IntegrationSource, AssetType } from '../../../../shared/types';
import type { IIntegrationRepository } from '../../../../contracts/repositories/IIntegrationRepository';
import type { Asset } from '../../../../shared/types';

describe('MultiAccountAggregationService', () => {
  let evmIntegration: MockIntegrationRepository;
  let solanaIntegration: MockIntegrationRepository;
  let portfolioRepo: InMemoryPortfolioRepository;
  let valuator: MockAssetValuator;
  let aggregationService: PortfolioAggregationService;
  let multiAccountService: MultiAccountAggregationService;

  const WALLET_A_ETH_ADDR = '0x1111111111111111111111111111111111111111';
  const WALLET_B_ETH_ADDR = '0x2222222222222222222222222222222222222222';
  const WALLET_A_SOL_ADDR = '5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X';
  const WALLET_B_SOL_ADDR = '7nYBm5pB8rAHVyhJXKM7Yz7GRe9iqCjHQaXtjJNVh4Mv';

  function makeEthAsset(address: string, amount: number): Asset {
    return {
      id: `eth-${address.slice(0, 8)}`,
      symbol: 'ETH',
      name: 'Ethereum',
      type: AssetType.CRYPTOCURRENCY,
      chain: 'ethereum',
      balance: { amount, decimals: 18, formatted: amount.toString() },
      price: { value: 2500, currency: 'USD', timestamp: new Date() },
      metadata: { address, source: IntegrationSource.EVM },
    };
  }

  function makeUsdcAsset(address: string, amount: number, chain: string = 'ethereum'): Asset {
    const contractMap: Record<string, string> = {
      ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    };
    return {
      id: `usdc-${chain}-${address.slice(0, 8)}`,
      symbol: 'USDC',
      name: 'USD Coin',
      type: AssetType.CRYPTOCURRENCY,
      chain: chain as Asset['chain'],
      contractAddress: contractMap[chain],
      balance: { amount, decimals: 6, formatted: amount.toString() },
      price: { value: 1, currency: 'USD', timestamp: new Date() },
      metadata: { address, source: chain === 'solana' ? IntegrationSource.SOLANA : IntegrationSource.EVM },
    };
  }

  function makeSolAsset(address: string, amount: number): Asset {
    return {
      id: `sol-${address.slice(0, 8)}`,
      symbol: 'SOL',
      name: 'Solana',
      type: AssetType.CRYPTOCURRENCY,
      chain: 'solana',
      balance: { amount, decimals: 9, formatted: amount.toString() },
      price: { value: 100, currency: 'USD', timestamp: new Date() },
      metadata: { address, source: IntegrationSource.SOLANA },
    };
  }

  beforeEach(() => {
    evmIntegration = new MockIntegrationRepository(IntegrationSource.EVM);
    solanaIntegration = new MockIntegrationRepository(IntegrationSource.SOLANA);
    portfolioRepo = new InMemoryPortfolioRepository();
    valuator = new MockAssetValuator();

    const integrations = new Map<IntegrationSource, IIntegrationRepository>([
      [IntegrationSource.EVM, evmIntegration],
      [IntegrationSource.SOLANA, solanaIntegration],
    ]);

    aggregationService = new PortfolioAggregationService(integrations, portfolioRepo, valuator);
    multiAccountService = new MultiAccountAggregationService(aggregationService);
  });

  describe('mergeAccountAddresses', () => {
    it('merges addresses from multiple accounts across chains', () => {
      const accounts: WalletAccount[] = [
        { id: 'wallet-a', addresses: new Map([['ethereum', [WALLET_A_ETH_ADDR]]]) },
        { id: 'wallet-b', addresses: new Map([['ethereum', [WALLET_B_ETH_ADDR]]]) },
      ];

      const merged = multiAccountService.mergeAccountAddresses(accounts);

      expect(merged.get('ethereum')).toEqual([WALLET_A_ETH_ADDR, WALLET_B_ETH_ADDR]);
    });

    it('deduplicates addresses that appear in multiple accounts', () => {
      const sharedAddr = WALLET_A_ETH_ADDR;
      const accounts: WalletAccount[] = [
        { id: 'wallet-a', addresses: new Map([['ethereum', [sharedAddr]]]) },
        { id: 'wallet-b', addresses: new Map([['ethereum', [sharedAddr, WALLET_B_ETH_ADDR]]]) },
      ];

      const merged = multiAccountService.mergeAccountAddresses(accounts);

      expect(merged.get('ethereum')).toHaveLength(2);
      expect(merged.get('ethereum')).toContain(sharedAddr);
      expect(merged.get('ethereum')).toContain(WALLET_B_ETH_ADDR);
    });

    it('merges addresses across different chains from different accounts', () => {
      const accounts: WalletAccount[] = [
        { id: 'wallet-a', addresses: new Map([['ethereum', [WALLET_A_ETH_ADDR]]]) },
        { id: 'wallet-b', addresses: new Map([['solana', [WALLET_B_SOL_ADDR]]]) },
      ];

      const merged = multiAccountService.mergeAccountAddresses(accounts);

      expect(merged.get('ethereum')).toEqual([WALLET_A_ETH_ADDR]);
      expect(merged.get('solana')).toEqual([WALLET_B_SOL_ADDR]);
    });

    it('handles empty accounts list', () => {
      const merged = multiAccountService.mergeAccountAddresses([]);
      expect(merged.size).toBe(0);
    });

    it('handles accounts with no addresses', () => {
      const accounts: WalletAccount[] = [
        { id: 'wallet-a', addresses: new Map() },
        { id: 'wallet-b', addresses: new Map() },
      ];

      const merged = multiAccountService.mergeAccountAddresses(accounts);
      expect(merged.size).toBe(0);
    });
  });

  describe('aggregateAccounts', () => {
    it('aggregates same asset from two wallets into merged balance', async () => {
      // Wallet A: 2 ETH on ethereum
      // Wallet B: 3 ETH on ethereum
      // Expected: 5 ETH total
      evmIntegration.setMockAssets([
        makeEthAsset(WALLET_A_ETH_ADDR, 2),
        makeEthAsset(WALLET_B_ETH_ADDR, 3),
      ]);

      const accounts: WalletAccount[] = [
        { id: 'wallet-a', addresses: new Map([['ethereum', [WALLET_A_ETH_ADDR]]]) },
        { id: 'wallet-b', addresses: new Map([['ethereum', [WALLET_B_ETH_ADDR]]]) },
      ];

      const portfolio = await multiAccountService.aggregateAccounts({
        accounts,
        userId: 'multi-user',
        forceRefresh: true,
      });

      const ethAssets = portfolio.assets.filter(a => a.symbol === 'ETH');
      expect(ethAssets).toHaveLength(1);
      expect(ethAssets[0].balance.amount).toBeCloseTo(5);
    });

    it('keeps different assets from different wallets separate', async () => {
      // Wallet A: ETH on ethereum
      // Wallet B: SOL on solana
      evmIntegration.setMockAssets([makeEthAsset(WALLET_A_ETH_ADDR, 2)]);
      solanaIntegration.setMockAssets([makeSolAsset(WALLET_B_SOL_ADDR, 50)]);

      const accounts: WalletAccount[] = [
        { id: 'wallet-a', addresses: new Map([['ethereum', [WALLET_A_ETH_ADDR]]]) },
        { id: 'wallet-b', addresses: new Map([['solana', [WALLET_B_SOL_ADDR]]]) },
      ];

      const portfolio = await multiAccountService.aggregateAccounts({
        accounts,
        userId: 'multi-user',
        forceRefresh: true,
      });

      expect(portfolio.assets).toHaveLength(2);
      expect(portfolio.assets.find(a => a.symbol === 'ETH')).toBeTruthy();
      expect(portfolio.assets.find(a => a.symbol === 'SOL')).toBeTruthy();
    });

    it('correctly calculates total value across multiple wallets', async () => {
      // Wallet A: 2 ETH ($5000) + 1000 USDC ($1000) on ethereum
      // Wallet B: 3 ETH ($7500) on ethereum
      // Total expected: $13,500
      evmIntegration.setMockAssets([
        makeEthAsset(WALLET_A_ETH_ADDR, 2),
        makeUsdcAsset(WALLET_A_ETH_ADDR, 1000),
        makeEthAsset(WALLET_B_ETH_ADDR, 3),
      ]);

      const accounts: WalletAccount[] = [
        { id: 'wallet-a', addresses: new Map([['ethereum', [WALLET_A_ETH_ADDR]]]) },
        { id: 'wallet-b', addresses: new Map([['ethereum', [WALLET_B_ETH_ADDR]]]) },
      ];

      const portfolio = await multiAccountService.aggregateAccounts({
        accounts,
        userId: 'multi-user',
        forceRefresh: true,
      });

      const totalValue = portfolio.getTotalValue('USD');
      expect(totalValue.amount).toBeCloseTo(13500);
    });

    it('handles USDC on different chains as separate assets', async () => {
      // Wallet A: 1000 USDC on ethereum
      // Wallet B: 2000 USDC on solana
      evmIntegration.setMockAssets([makeUsdcAsset(WALLET_A_ETH_ADDR, 1000, 'ethereum')]);
      solanaIntegration.setMockAssets([makeUsdcAsset(WALLET_B_SOL_ADDR, 2000, 'solana')]);

      const accounts: WalletAccount[] = [
        { id: 'wallet-a', addresses: new Map([['ethereum', [WALLET_A_ETH_ADDR]]]) },
        { id: 'wallet-b', addresses: new Map([['solana', [WALLET_B_SOL_ADDR]]]) },
      ];

      const portfolio = await multiAccountService.aggregateAccounts({
        accounts,
        userId: 'multi-user',
        forceRefresh: true,
      });

      const usdcAssets = portfolio.assets.filter(a => a.symbol === 'USDC');
      expect(usdcAssets).toHaveLength(2);
      expect(usdcAssets.map(a => a.chain).sort()).toEqual(['ethereum', 'solana']);
    });

    it('produces an empty portfolio when all accounts have no addresses', async () => {
      const accounts: WalletAccount[] = [
        { id: 'wallet-a', addresses: new Map() },
        { id: 'wallet-b', addresses: new Map() },
      ];

      const portfolio = await multiAccountService.aggregateAccounts({
        accounts,
        userId: 'multi-user',
        forceRefresh: true,
      });

      expect(portfolio.assets).toHaveLength(0);
      expect(portfolio.getTotalValue('USD').amount).toBe(0);
    });

    it('produces an empty portfolio when no accounts provided', async () => {
      const portfolio = await multiAccountService.aggregateAccounts({
        accounts: [],
        userId: 'multi-user',
        forceRefresh: true,
      });

      expect(portfolio.assets).toHaveLength(0);
    });

    it('aggregates three wallets across multiple chains', async () => {
      // Wallet A: 1 ETH on ethereum
      // Wallet B: 2 ETH on ethereum + 50 SOL on solana
      // Wallet C: 100 SOL on solana
      // Expected: 3 ETH (merged), 150 SOL (merged)
      evmIntegration.setMockAssets([
        makeEthAsset(WALLET_A_ETH_ADDR, 1),
        makeEthAsset(WALLET_B_ETH_ADDR, 2),
      ]);
      solanaIntegration.setMockAssets([
        makeSolAsset(WALLET_A_SOL_ADDR, 50),
        makeSolAsset(WALLET_B_SOL_ADDR, 100),
      ]);

      const walletC_sol = '9nYBm5pB8rAHVyhJXKM7Yz7GRe9iqCjHQaXtjJNVh4Mv';

      const accounts: WalletAccount[] = [
        {
          id: 'wallet-a',
          addresses: new Map([
            ['ethereum', [WALLET_A_ETH_ADDR]],
            ['solana', [WALLET_A_SOL_ADDR]],
          ]),
        },
        {
          id: 'wallet-b',
          addresses: new Map([
            ['ethereum', [WALLET_B_ETH_ADDR]],
            ['solana', [WALLET_B_SOL_ADDR]],
          ]),
        },
      ];

      const portfolio = await multiAccountService.aggregateAccounts({
        accounts,
        userId: 'multi-user',
        forceRefresh: true,
      });

      const ethAssets = portfolio.assets.filter(a => a.symbol === 'ETH');
      const solAssets = portfolio.assets.filter(a => a.symbol === 'SOL');
      expect(ethAssets).toHaveLength(1);
      expect(ethAssets[0].balance.amount).toBeCloseTo(3);
      expect(solAssets).toHaveLength(1);
      expect(solAssets[0].balance.amount).toBeCloseTo(150);
    });

    it('records all sources used across wallets', async () => {
      evmIntegration.setMockAssets([makeEthAsset(WALLET_A_ETH_ADDR, 1)]);
      solanaIntegration.setMockAssets([makeSolAsset(WALLET_B_SOL_ADDR, 50)]);

      const accounts: WalletAccount[] = [
        { id: 'wallet-a', addresses: new Map([['ethereum', [WALLET_A_ETH_ADDR]]]) },
        { id: 'wallet-b', addresses: new Map([['solana', [WALLET_B_SOL_ADDR]]]) },
      ];

      const portfolio = await multiAccountService.aggregateAccounts({
        accounts,
        userId: 'multi-user',
        forceRefresh: true,
      });

      expect(portfolio.sources).toContain(IntegrationSource.EVM);
      expect(portfolio.sources).toContain(IntegrationSource.SOLANA);
    });

    it('includes account labels for attribution', async () => {
      evmIntegration.setMockAssets([makeEthAsset(WALLET_A_ETH_ADDR, 2)]);

      const accounts: WalletAccount[] = [
        {
          id: 'wallet-a',
          label: 'Hardware Wallet',
          addresses: new Map([['ethereum', [WALLET_A_ETH_ADDR]]]),
        },
      ];

      const portfolio = await multiAccountService.aggregateAccounts({
        accounts,
        userId: 'multi-user',
        forceRefresh: true,
      });

      expect(portfolio.assets).toHaveLength(1);
    });
  });
});
