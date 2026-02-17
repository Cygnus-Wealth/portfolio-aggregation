import { PortfolioAggregate } from '../../domain/aggregates/Portfolio';
import { PortfolioAggregationService, AggregationOptions } from './PortfolioAggregationService';
import type { IntegrationSource } from '../../shared/types';

/**
 * Represents a single wallet/mnemonic with its addresses across chains
 */
export interface WalletAccount {
  id: string;
  label?: string;
  addresses: Map<string, string[]>; // chain -> addresses
}

/**
 * Options for aggregating across multiple wallet accounts
 */
export interface MultiAccountAggregationOptions {
  accounts: WalletAccount[];
  sources?: IntegrationSource[];
  userId?: string;
  forceRefresh?: boolean;
}

/**
 * Service for aggregating portfolio data across multiple wallet accounts
 * (separate mnemonics/hardware wallets/browser wallets).
 *
 * Merges all addresses from all accounts, delegates to PortfolioAggregationService
 * for fetching and reconciliation, and returns a unified portfolio view.
 */
export class MultiAccountAggregationService {
  constructor(
    private aggregationService: PortfolioAggregationService
  ) {}

  /**
   * Aggregate assets from multiple wallet accounts into a unified portfolio.
   * Same-chain, same-token assets are merged (balances summed).
   */
  async aggregateAccounts(
    options: MultiAccountAggregationOptions
  ): Promise<PortfolioAggregate> {
    const mergedAddresses = this.mergeAccountAddresses(options.accounts);

    const aggregationOptions: AggregationOptions = {
      addresses: mergedAddresses,
      sources: options.sources,
      userId: options.userId,
      forceRefresh: options.forceRefresh,
    };

    return this.aggregationService.aggregatePortfolio(aggregationOptions);
  }

  /**
   * Merge addresses from multiple accounts, deduplicating per chain.
   */
  mergeAccountAddresses(accounts: WalletAccount[]): Map<string, string[]> {
    const merged = new Map<string, string[]>();

    for (const account of accounts) {
      for (const [chain, addrs] of account.addresses) {
        const existing = merged.get(chain) || [];
        const deduped = [...new Set([...existing, ...addrs])];
        merged.set(chain, deduped);
      }
    }

    return merged;
  }
}
