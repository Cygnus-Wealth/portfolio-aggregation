import { describe, it, expect, beforeEach } from 'vitest';
import { PortfolioAggregationService } from '../../application/services/PortfolioAggregationService';
import {
  MultiAccountAggregationService,
  WalletAccount,
} from '../../application/services/MultiAccountAggregationService';
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
import type { Asset } from '../../shared/types';

describe('E2E: Multi-Account Aggregation Across Multiple Mnemonics', () => {
  let evmIntegration: E2EMockIntegrationRepository;
  let solanaIntegration: E2EMockIntegrationRepository;
  let portfolioRepo: InMemoryPortfolioRepository;
  let valuator: E2EMockAssetValuator;
  let multiAccountService: MultiAccountAggregationService;

  const WALLET_A_ETH = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';
  const WALLET_B_ETH = '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed';
  const WALLET_A_SOL = '5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X';
  const WALLET_B_SOL = '7nYBm5pB8rAHVyhJXKM7Yz7GRe9iqCjHQaXtjJNVh4Mv';

  beforeEach(() => {
    evmIntegration = new E2EMockIntegrationRepository({ source: IntegrationSource.EVM });
    solanaIntegration = new E2EMockIntegrationRepository({ source: IntegrationSource.SOLANA });
    portfolioRepo = new InMemoryPortfolioRepository();
    valuator = new E2EMockAssetValuator();

    const integrations = new Map<IntegrationSource, IIntegrationRepository>([
      [IntegrationSource.EVM, evmIntegration],
      [IntegrationSource.SOLANA, solanaIntegration],
    ]);

    const aggregationService = new PortfolioAggregationService(
      integrations,
      portfolioRepo,
      valuator
    );
    multiAccountService = new MultiAccountAggregationService(aggregationService);
  });

  it('aggregates two EVM wallets with overlapping tokens into unified portfolio', async () => {
    // Wallet A: 2.5 ETH + 5000 USDC on ethereum
    evmIntegration.addAssetsForAddress(WALLET_A_ETH, createEVMAssets(WALLET_A_ETH));
    // Wallet B: 1.0 ETH on ethereum (duplicate token)
    evmIntegration.addAssetsForAddress(WALLET_B_ETH, createDuplicateEVMAssets(WALLET_B_ETH));

    const accounts: WalletAccount[] = [
      {
        id: 'mnemonic-1',
        label: 'Ledger Hardware Wallet',
        addresses: new Map([['ethereum', [WALLET_A_ETH]]]),
      },
      {
        id: 'mnemonic-2',
        label: 'MetaMask Hot Wallet',
        addresses: new Map([['ethereum', [WALLET_B_ETH]]]),
      },
    ];

    const portfolio = await multiAccountService.aggregateAccounts({
      accounts,
      userId: 'multi-mnemonic-user',
      forceRefresh: true,
    });

    // ETH should be merged: 2.5 + 1.0 = 3.5
    const ethAssets = portfolio.assets.filter(a => a.symbol === 'ETH');
    expect(ethAssets).toHaveLength(1);
    expect(ethAssets[0].balance.amount).toBeCloseTo(3.5);

    // USDC stays at 5000 (only in wallet A)
    const usdcAssets = portfolio.assets.filter(a => a.symbol === 'USDC');
    expect(usdcAssets).toHaveLength(1);
    expect(usdcAssets[0].balance.amount).toBeCloseTo(5000);

    // Total: 3.5 * 2500 + 5000 * 1 = 13750
    const total = portfolio.getTotalValue('USD');
    expect(total.amount).toBeCloseTo(13750);
  });

  it('aggregates wallets across EVM and Solana chains', async () => {
    // Wallet A: EVM assets on ethereum
    evmIntegration.addAssetsForAddress(WALLET_A_ETH, createEVMAssets(WALLET_A_ETH));
    // Wallet B: Solana assets
    solanaIntegration.addAssetsForAddress(WALLET_B_SOL, createSolanaAssets(WALLET_B_SOL));

    const accounts: WalletAccount[] = [
      {
        id: 'seed-phrase-1',
        label: 'EVM Wallet',
        addresses: new Map([['ethereum', [WALLET_A_ETH]]]),
      },
      {
        id: 'seed-phrase-2',
        label: 'Solana Wallet',
        addresses: new Map([['solana', [WALLET_B_SOL]]]),
      },
    ];

    const portfolio = await multiAccountService.aggregateAccounts({
      accounts,
      userId: 'cross-chain-user',
      forceRefresh: true,
    });

    // Should have: ETH (ethereum), USDC (ethereum), SOL (solana), USDC (solana) = 4
    expect(portfolio.assets).toHaveLength(4);
    expect(portfolio.sources).toContain(IntegrationSource.EVM);
    expect(portfolio.sources).toContain(IntegrationSource.SOLANA);

    // USDC on different chains must remain separate
    const usdcAssets = portfolio.assets.filter(a => a.symbol === 'USDC');
    expect(usdcAssets).toHaveLength(2);
    expect(usdcAssets.map(a => a.chain).sort()).toEqual(['ethereum', 'solana']);
  });

  it('handles three wallets with a mix of shared and unique assets', async () => {
    // Wallet A: 2.5 ETH + 5000 USDC on ethereum
    evmIntegration.addAssetsForAddress(WALLET_A_ETH, createEVMAssets(WALLET_A_ETH));
    // Wallet B: 1.0 ETH on ethereum (merges with A)
    evmIntegration.addAssetsForAddress(WALLET_B_ETH, createDuplicateEVMAssets(WALLET_B_ETH));
    // Wallet C (Solana): 50 SOL + 3000 USDC on solana
    solanaIntegration.addAssetsForAddress(WALLET_A_SOL, createSolanaAssets(WALLET_A_SOL));

    const accounts: WalletAccount[] = [
      {
        id: 'hw-wallet',
        label: 'Hardware Wallet',
        addresses: new Map([['ethereum', [WALLET_A_ETH]]]),
      },
      {
        id: 'hot-wallet',
        label: 'Browser Wallet',
        addresses: new Map([['ethereum', [WALLET_B_ETH]]]),
      },
      {
        id: 'solana-wallet',
        label: 'Phantom Wallet',
        addresses: new Map([['solana', [WALLET_A_SOL]]]),
      },
    ];

    const portfolio = await multiAccountService.aggregateAccounts({
      accounts,
      userId: 'three-wallet-user',
      forceRefresh: true,
    });

    // ETH merged: 2.5 + 1.0 = 3.5
    const eth = portfolio.assets.filter(a => a.symbol === 'ETH');
    expect(eth).toHaveLength(1);
    expect(eth[0].balance.amount).toBeCloseTo(3.5);

    // SOL: 50
    const sol = portfolio.assets.filter(a => a.symbol === 'SOL');
    expect(sol).toHaveLength(1);
    expect(sol[0].balance.amount).toBeCloseTo(50);

    // USDC separate by chain: 5000 (ethereum) + 3000 (solana)
    const usdc = portfolio.assets.filter(a => a.symbol === 'USDC');
    expect(usdc).toHaveLength(2);

    // Total: 3.5*2500 + 5000*1 + 50*100 + 3000*1 = 8750 + 5000 + 5000 + 3000 = 21750
    const total = portfolio.getTotalValue('USD');
    expect(total.amount).toBeCloseTo(21750);
  });

  it('gracefully handles one integration source failing', async () => {
    // Wallet A: EVM assets (succeeds)
    evmIntegration.addAssetsForAddress(WALLET_A_ETH, createEVMAssets(WALLET_A_ETH));
    // Wallet B: Solana (will fail)
    solanaIntegration.setFailure(true, 'Solana RPC unavailable');

    const accounts: WalletAccount[] = [
      {
        id: 'evm-wallet',
        addresses: new Map([['ethereum', [WALLET_A_ETH]]]),
      },
      {
        id: 'sol-wallet',
        addresses: new Map([['solana', [WALLET_B_SOL]]]),
      },
    ];

    const portfolio = await multiAccountService.aggregateAccounts({
      accounts,
      userId: 'partial-fail-user',
      forceRefresh: true,
    });

    // Should still have EVM assets
    expect(portfolio.assets.length).toBeGreaterThan(0);
    expect(portfolio.sources).toContain(IntegrationSource.EVM);

    // Solana source should not be present
    expect(portfolio.sources).not.toContain(IntegrationSource.SOLANA);
  });

  it('single wallet with multiple addresses on same chain aggregates correctly', async () => {
    // One mnemonic producing two ethereum addresses
    evmIntegration.addAssetsForAddress(WALLET_A_ETH, createEVMAssets(WALLET_A_ETH));
    evmIntegration.addAssetsForAddress(WALLET_B_ETH, createDuplicateEVMAssets(WALLET_B_ETH));

    const accounts: WalletAccount[] = [
      {
        id: 'single-mnemonic',
        label: 'My Main Wallet',
        addresses: new Map([['ethereum', [WALLET_A_ETH, WALLET_B_ETH]]]),
      },
    ];

    const portfolio = await multiAccountService.aggregateAccounts({
      accounts,
      userId: 'single-mnemonic-user',
      forceRefresh: true,
    });

    // ETH merged from both addresses: 2.5 + 1.0 = 3.5
    const ethAssets = portfolio.assets.filter(a => a.symbol === 'ETH');
    expect(ethAssets).toHaveLength(1);
    expect(ethAssets[0].balance.amount).toBeCloseTo(3.5);
  });

  it('wallet with both EVM and Solana addresses aggregates across chains', async () => {
    evmIntegration.addAssetsForAddress(WALLET_A_ETH, createEVMAssets(WALLET_A_ETH));
    solanaIntegration.addAssetsForAddress(WALLET_A_SOL, createSolanaAssets(WALLET_A_SOL));

    const accounts: WalletAccount[] = [
      {
        id: 'multi-chain-wallet',
        label: 'Cross-chain Wallet',
        addresses: new Map([
          ['ethereum', [WALLET_A_ETH]],
          ['solana', [WALLET_A_SOL]],
        ]),
      },
    ];

    const portfolio = await multiAccountService.aggregateAccounts({
      accounts,
      userId: 'multi-chain-user',
      forceRefresh: true,
    });

    // ETH, USDC-eth, SOL, USDC-sol = 4 assets
    expect(portfolio.assets).toHaveLength(4);
    expect(portfolio.sources).toContain(IntegrationSource.EVM);
    expect(portfolio.sources).toContain(IntegrationSource.SOLANA);
  });

  it('portfolio is saved to repository and can be found by user id', async () => {
    evmIntegration.addAssetsForAddress(WALLET_A_ETH, createEVMAssets(WALLET_A_ETH));

    const accounts: WalletAccount[] = [
      {
        id: 'persist-wallet',
        addresses: new Map([['ethereum', [WALLET_A_ETH]]]),
      },
    ];

    const portfolio = await multiAccountService.aggregateAccounts({
      accounts,
      userId: 'persist-user',
      forceRefresh: true,
    });

    // Portfolio should be persisted
    const saved = await portfolioRepo.findById(portfolio.id);
    expect(saved).not.toBeNull();
    expect(saved!.assets.length).toBe(portfolio.assets.length);
  });
});
