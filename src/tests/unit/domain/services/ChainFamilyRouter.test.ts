import { describe, it, expect } from 'vitest';
import {
  ChainFamily,
  chainToFamily,
  CHAIN_FAMILY_CHAINS,
  ChainFamilyRouter,
} from '../../../../domain/services/ChainFamilyRouter';
import { Chain } from '../../../../shared/types';

describe('ChainFamily type', () => {
  it('defines all six chain families', () => {
    expect(ChainFamily.EVM).toBe('evm');
    expect(ChainFamily.SOLANA).toBe('solana');
    expect(ChainFamily.SUI).toBe('sui');
    expect(ChainFamily.BITCOIN).toBe('bitcoin');
    expect(ChainFamily.COSMOS).toBe('cosmos');
    expect(ChainFamily.APTOS).toBe('aptos');
  });
});

describe('chainToFamily mapping', () => {
  it('maps EVM chains to evm family', () => {
    expect(chainToFamily(Chain.ETHEREUM)).toBe(ChainFamily.EVM);
    expect(chainToFamily(Chain.POLYGON)).toBe(ChainFamily.EVM);
    expect(chainToFamily(Chain.ARBITRUM)).toBe(ChainFamily.EVM);
    expect(chainToFamily(Chain.OPTIMISM)).toBe(ChainFamily.EVM);
    expect(chainToFamily(Chain.BINANCE)).toBe(ChainFamily.EVM);
  });

  it('maps solana chain to solana family', () => {
    expect(chainToFamily(Chain.SOLANA)).toBe(ChainFamily.SOLANA);
  });

  it('maps bitcoin chain to bitcoin family', () => {
    expect(chainToFamily(Chain.BITCOIN)).toBe(ChainFamily.BITCOIN);
  });

  it('returns undefined for unknown chain', () => {
    expect(chainToFamily('unknown-chain' as Chain)).toBeUndefined();
  });
});

describe('CHAIN_FAMILY_CHAINS registry', () => {
  it('maps evm family to all EVM chains', () => {
    const evmChains = CHAIN_FAMILY_CHAINS[ChainFamily.EVM];
    expect(evmChains).toContain(Chain.ETHEREUM);
    expect(evmChains).toContain(Chain.POLYGON);
    expect(evmChains).toContain(Chain.ARBITRUM);
    expect(evmChains).toContain(Chain.OPTIMISM);
    expect(evmChains).toContain(Chain.BINANCE);
  });

  it('maps solana family to solana chain only', () => {
    expect(CHAIN_FAMILY_CHAINS[ChainFamily.SOLANA]).toEqual([Chain.SOLANA]);
  });

  it('maps bitcoin family to bitcoin chain only', () => {
    expect(CHAIN_FAMILY_CHAINS[ChainFamily.BITCOIN]).toEqual([Chain.BITCOIN]);
  });

  it('has empty arrays for chain families with no chains yet', () => {
    expect(CHAIN_FAMILY_CHAINS[ChainFamily.SUI]).toEqual([]);
    expect(CHAIN_FAMILY_CHAINS[ChainFamily.COSMOS]).toEqual([]);
    expect(CHAIN_FAMILY_CHAINS[ChainFamily.APTOS]).toEqual([]);
  });
});

describe('ChainFamilyRouter', () => {
  describe('groupAddressesByFamily', () => {
    it('groups EVM chain addresses under evm family', () => {
      const addresses = new Map<string, string[]>();
      addresses.set('ethereum', ['0xAAA']);
      addresses.set('polygon', ['0xBBB']);
      addresses.set('arbitrum', ['0xCCC']);

      const grouped = ChainFamilyRouter.groupAddressesByFamily(addresses);

      expect(grouped.has(ChainFamily.EVM)).toBe(true);
      const evmAddrs = grouped.get(ChainFamily.EVM)!;
      expect(evmAddrs).toContain('0xAAA');
      expect(evmAddrs).toContain('0xBBB');
      expect(evmAddrs).toContain('0xCCC');
    });

    it('groups solana addresses under solana family', () => {
      const addresses = new Map<string, string[]>();
      addresses.set('solana', ['SolAddr1']);

      const grouped = ChainFamilyRouter.groupAddressesByFamily(addresses);

      expect(grouped.has(ChainFamily.SOLANA)).toBe(true);
      expect(grouped.get(ChainFamily.SOLANA)).toEqual(['SolAddr1']);
    });

    it('separates EVM and Solana into different families', () => {
      const addresses = new Map<string, string[]>();
      addresses.set('ethereum', ['0xAAA']);
      addresses.set('solana', ['SolAddr1']);

      const grouped = ChainFamilyRouter.groupAddressesByFamily(addresses);

      expect(grouped.size).toBe(2);
      expect(grouped.has(ChainFamily.EVM)).toBe(true);
      expect(grouped.has(ChainFamily.SOLANA)).toBe(true);
    });

    it('deduplicates addresses within same chain family', () => {
      const addresses = new Map<string, string[]>();
      // Same address on ethereum and polygon (both EVM)
      addresses.set('ethereum', ['0xAAA']);
      addresses.set('polygon', ['0xAAA']);

      const grouped = ChainFamilyRouter.groupAddressesByFamily(addresses);

      const evmAddrs = grouped.get(ChainFamily.EVM)!;
      expect(evmAddrs).toEqual(['0xAAA']);
    });

    it('does NOT deduplicate same address across different chain families', () => {
      const addresses = new Map<string, string[]>();
      // Same hex string on ethereum and bitcoin — different families
      addresses.set('ethereum', ['0xAAA']);
      addresses.set('bitcoin', ['0xAAA']);

      const grouped = ChainFamilyRouter.groupAddressesByFamily(addresses);

      expect(grouped.get(ChainFamily.EVM)).toEqual(['0xAAA']);
      expect(grouped.get(ChainFamily.BITCOIN)).toEqual(['0xAAA']);
    });

    it('handles empty addresses map', () => {
      const addresses = new Map<string, string[]>();
      const grouped = ChainFamilyRouter.groupAddressesByFamily(addresses);
      expect(grouped.size).toBe(0);
    });

    it('skips unknown chains gracefully', () => {
      const addresses = new Map<string, string[]>();
      addresses.set('unknown-chain', ['addr1']);
      addresses.set('ethereum', ['0xAAA']);

      const grouped = ChainFamilyRouter.groupAddressesByFamily(addresses);

      expect(grouped.size).toBe(1);
      expect(grouped.has(ChainFamily.EVM)).toBe(true);
    });
  });

  describe('getRelevantAddressesForFamily', () => {
    const addresses = new Map<string, string[]>();
    addresses.set('ethereum', ['0xAAA', '0xBBB']);
    addresses.set('polygon', ['0xCCC']);
    addresses.set('solana', ['SolAddr1']);
    addresses.set('bitcoin', ['bc1addr']);

    it('returns all EVM chain addresses for evm family', () => {
      const result = ChainFamilyRouter.getRelevantAddressesForFamily(
        ChainFamily.EVM,
        addresses
      );
      expect(result).toContain('0xAAA');
      expect(result).toContain('0xBBB');
      expect(result).toContain('0xCCC');
      expect(result).not.toContain('SolAddr1');
    });

    it('returns only solana addresses for solana family', () => {
      const result = ChainFamilyRouter.getRelevantAddressesForFamily(
        ChainFamily.SOLANA,
        addresses
      );
      expect(result).toEqual(['SolAddr1']);
    });

    it('returns only bitcoin addresses for bitcoin family', () => {
      const result = ChainFamilyRouter.getRelevantAddressesForFamily(
        ChainFamily.BITCOIN,
        addresses
      );
      expect(result).toEqual(['bc1addr']);
    });

    it('returns empty array for family with no matching chains', () => {
      const result = ChainFamilyRouter.getRelevantAddressesForFamily(
        ChainFamily.SUI,
        addresses
      );
      expect(result).toEqual([]);
    });

    it('deduplicates within the family', () => {
      const addrs = new Map<string, string[]>();
      addrs.set('ethereum', ['0xAAA']);
      addrs.set('polygon', ['0xAAA']);

      const result = ChainFamilyRouter.getRelevantAddressesForFamily(
        ChainFamily.EVM,
        addrs
      );
      expect(result).toEqual(['0xAAA']);
    });
  });

  describe('isSingleChainFamily', () => {
    it('returns false for EVM (multi-chain)', () => {
      expect(ChainFamilyRouter.isSingleChainFamily(ChainFamily.EVM)).toBe(false);
    });

    it('returns true for Solana (single-chain)', () => {
      expect(ChainFamilyRouter.isSingleChainFamily(ChainFamily.SOLANA)).toBe(true);
    });

    it('returns true for Bitcoin (single-chain)', () => {
      expect(ChainFamilyRouter.isSingleChainFamily(ChainFamily.BITCOIN)).toBe(true);
    });

    it('returns true for Sui (single-chain)', () => {
      expect(ChainFamilyRouter.isSingleChainFamily(ChainFamily.SUI)).toBe(true);
    });

    it('returns true for Aptos (single-chain)', () => {
      expect(ChainFamilyRouter.isSingleChainFamily(ChainFamily.APTOS)).toBe(true);
    });

    it('returns false for Cosmos (user-selectable, treated as multi-chain)', () => {
      expect(ChainFamilyRouter.isSingleChainFamily(ChainFamily.COSMOS)).toBe(false);
    });
  });

  describe('familyToIntegrationSource', () => {
    it('maps evm family to EVM integration source', () => {
      expect(ChainFamilyRouter.familyToIntegrationSource(ChainFamily.EVM)).toBe('evm');
    });

    it('maps solana family to SOLANA integration source', () => {
      expect(ChainFamilyRouter.familyToIntegrationSource(ChainFamily.SOLANA)).toBe('solana');
    });

    it('returns undefined for chain families without integration yet', () => {
      expect(ChainFamilyRouter.familyToIntegrationSource(ChainFamily.SUI)).toBeUndefined();
      expect(ChainFamilyRouter.familyToIntegrationSource(ChainFamily.BITCOIN)).toBeUndefined();
      expect(ChainFamilyRouter.familyToIntegrationSource(ChainFamily.COSMOS)).toBeUndefined();
      expect(ChainFamilyRouter.familyToIntegrationSource(ChainFamily.APTOS)).toBeUndefined();
    });
  });
});
