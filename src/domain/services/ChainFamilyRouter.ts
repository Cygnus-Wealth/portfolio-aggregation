import { Chain, IntegrationSource } from '../../shared/types';

/**
 * Chain family classification per enterprise directive en-o8w.
 * A closed enum — adding new families requires Enterprise Arch approval.
 */
export const ChainFamily = {
  EVM: 'evm',
  SOLANA: 'solana',
  SUI: 'sui',
  BITCOIN: 'bitcoin',
  COSMOS: 'cosmos',
  APTOS: 'aptos',
} as const;

export type ChainFamily = (typeof ChainFamily)[keyof typeof ChainFamily];

/**
 * Maps individual chains to their chain family.
 */
const CHAIN_TO_FAMILY: Record<string, ChainFamily> = {
  [Chain.ETHEREUM]: ChainFamily.EVM,
  [Chain.POLYGON]: ChainFamily.EVM,
  [Chain.ARBITRUM]: ChainFamily.EVM,
  [Chain.OPTIMISM]: ChainFamily.EVM,
  [Chain.BINANCE]: ChainFamily.EVM,
  [Chain.SOLANA]: ChainFamily.SOLANA,
  [Chain.BITCOIN]: ChainFamily.BITCOIN,
};

/**
 * Reverse mapping: chain family → chains belonging to it.
 */
export const CHAIN_FAMILY_CHAINS: Record<ChainFamily, Chain[]> = {
  [ChainFamily.EVM]: [
    Chain.ETHEREUM,
    Chain.POLYGON,
    Chain.ARBITRUM,
    Chain.OPTIMISM,
    Chain.BINANCE,
  ],
  [ChainFamily.SOLANA]: [Chain.SOLANA],
  [ChainFamily.BITCOIN]: [Chain.BITCOIN],
  [ChainFamily.SUI]: [],
  [ChainFamily.COSMOS]: [],
  [ChainFamily.APTOS]: [],
};

/**
 * Maps chain families to their integration source.
 * Undefined means no integration bounded context exists yet.
 */
const FAMILY_TO_INTEGRATION: Partial<Record<ChainFamily, IntegrationSource>> = {
  [ChainFamily.EVM]: IntegrationSource.EVM,
  [ChainFamily.SOLANA]: IntegrationSource.SOLANA,
};

/**
 * Single-chain families where one address = one chain (mainnet only).
 * EVM and Cosmos are multi-chain; the rest are single-chain per en-o8w.
 */
const MULTI_CHAIN_FAMILIES: Set<ChainFamily> = new Set([
  ChainFamily.EVM,
  ChainFamily.COSMOS,
]);

/**
 * Resolve a chain to its chain family.
 */
export function chainToFamily(chain: Chain): ChainFamily | undefined {
  return CHAIN_TO_FAMILY[chain];
}

/**
 * Domain service for routing addresses by chain family.
 *
 * Per en-o8w: PortfolioAggregation groups TrackedAddress[] by chainFamily
 * and dispatches to the correct integration bounded context.
 */
export class ChainFamilyRouter {
  /**
   * Group addresses by their chain family.
   * Deduplicates addresses within the same family.
   * Skips chains with no known family mapping.
   */
  static groupAddressesByFamily(
    addresses: Map<string, string[]>
  ): Map<ChainFamily, string[]> {
    const grouped = new Map<ChainFamily, Set<string>>();

    for (const [chain, addrs] of addresses) {
      const family = chainToFamily(chain as Chain);
      if (!family) continue;

      if (!grouped.has(family)) {
        grouped.set(family, new Set());
      }
      const familySet = grouped.get(family)!;
      for (const addr of addrs) {
        familySet.add(addr);
      }
    }

    const result = new Map<ChainFamily, string[]>();
    for (const [family, addrSet] of grouped) {
      result.set(family, Array.from(addrSet));
    }
    return result;
  }

  /**
   * Get addresses relevant to a specific chain family.
   * Collects addresses from all chains belonging to the family and deduplicates.
   */
  static getRelevantAddressesForFamily(
    family: ChainFamily,
    addresses: Map<string, string[]>
  ): string[] {
    const chains = CHAIN_FAMILY_CHAINS[family];
    if (!chains || chains.length === 0) return [];

    const result = new Set<string>();
    for (const chain of chains) {
      const addrs = addresses.get(chain);
      if (addrs) {
        for (const addr of addrs) {
          result.add(addr);
        }
      }
    }
    return Array.from(result);
  }

  /**
   * Whether a chain family is single-chain (one address = one mainnet chain).
   * EVM and Cosmos are multi-chain; everything else is single-chain per en-o8w.
   */
  static isSingleChainFamily(family: ChainFamily): boolean {
    return !MULTI_CHAIN_FAMILIES.has(family);
  }

  /**
   * Map a chain family to its integration source.
   * Returns undefined if no integration BC exists for that family yet.
   */
  static familyToIntegrationSource(
    family: ChainFamily
  ): IntegrationSource | undefined {
    return FAMILY_TO_INTEGRATION[family];
  }
}
