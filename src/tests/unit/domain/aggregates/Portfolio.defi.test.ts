import { describe, it, expect, beforeEach } from 'vitest';
import { PortfolioAggregate } from '../../../../domain/aggregates/Portfolio';
import { AssetEntity } from '../../../../domain/entities/Asset';
import {
  DeFiPositionType,
  DeFiProtocol,
  AssetType
} from '../../../../shared/types';
import type { DeFiPosition } from '../../../../shared/types';

function createSupplyPosition(overrides: Partial<DeFiPosition> = {}): DeFiPosition {
  return {
    id: 'defi-aave-supply-1',
    type: DeFiPositionType.LENDING_SUPPLY,
    protocol: DeFiProtocol.AAVE,
    chain: 'ethereum',
    underlyingAssets: [{ symbol: 'USDC', amount: 10000 }],
    value: { value: 10000, currency: 'USD', timestamp: new Date() },
    deduplicationKey: 'aave:ethereum:0xabc:lending_supply',
    ...overrides
  };
}

function createBorrowPosition(overrides: Partial<DeFiPosition> = {}): DeFiPosition {
  return {
    id: 'defi-aave-borrow-1',
    type: DeFiPositionType.LENDING_BORROW,
    protocol: DeFiProtocol.AAVE,
    chain: 'ethereum',
    underlyingAssets: [{ symbol: 'ETH', amount: 2 }],
    value: { value: 5000, currency: 'USD', timestamp: new Date() },
    deduplicationKey: 'aave:ethereum:0xabc:lending_borrow',
    ...overrides
  };
}

function createVaultPosition(overrides: Partial<DeFiPosition> = {}): DeFiPosition {
  return {
    id: 'defi-beefy-vault-1',
    type: DeFiPositionType.VAULT,
    protocol: DeFiProtocol.BEEFY,
    chain: 'ethereum',
    underlyingAssets: [
      { symbol: 'ETH', amount: 5 },
      { symbol: 'USDC', amount: 5000 }
    ],
    value: { value: 17500, currency: 'USD', timestamp: new Date() },
    deduplicationKey: 'beefy:ethereum:0xvault1',
    receiptTokenAddress: '0xmooETH',
    ...overrides
  };
}

describe('PortfolioAggregate DeFi', () => {
  let portfolio: PortfolioAggregate;

  beforeEach(() => {
    portfolio = new PortfolioAggregate({
      id: 'test-portfolio',
      userId: 'test-user'
    });
  });

  describe('addDeFiPosition', () => {
    it('adds a DeFi position to the portfolio', () => {
      const position = createSupplyPosition();
      portfolio.addDeFiPosition(position);

      expect(portfolio.defiPositions).toHaveLength(1);
      expect(portfolio.defiPositions[0].id).toBe('defi-aave-supply-1');
    });

    it('deduplicates positions by deduplicationKey', () => {
      const pos1 = createSupplyPosition();
      const pos2 = createSupplyPosition({
        id: 'defi-aave-supply-2',
        value: { value: 20000, currency: 'USD', timestamp: new Date() }
      });

      portfolio.addDeFiPosition(pos1);
      portfolio.addDeFiPosition(pos2);

      expect(portfolio.defiPositions).toHaveLength(1);
      // First-seen wins
      expect(portfolio.defiPositions[0].value!.value).toBe(10000);
    });

    it('allows positions with different deduplicationKeys', () => {
      const pos1 = createSupplyPosition();
      const pos2 = createSupplyPosition({
        id: 'defi-aave-supply-arb',
        deduplicationKey: 'aave:arbitrum:0xdef:lending_supply',
        chain: 'arbitrum'
      });

      portfolio.addDeFiPosition(pos1);
      portfolio.addDeFiPosition(pos2);

      expect(portfolio.defiPositions).toHaveLength(2);
    });
  });

  describe('getDeFiNetValue', () => {
    it('returns 0 when no DeFi positions', () => {
      expect(portfolio.getDeFiNetValue()).toBe(0);
    });

    it('adds supply position values', () => {
      portfolio.addDeFiPosition(createSupplyPosition());
      expect(portfolio.getDeFiNetValue()).toBe(10000);
    });

    it('subtracts borrow position values', () => {
      portfolio.addDeFiPosition(createBorrowPosition());
      expect(portfolio.getDeFiNetValue()).toBe(-5000);
    });

    it('computes net value: supply - borrow', () => {
      portfolio.addDeFiPosition(createSupplyPosition()); // +10000
      portfolio.addDeFiPosition(createBorrowPosition()); // -5000

      expect(portfolio.getDeFiNetValue()).toBe(5000);
    });

    it('adds vault positions as positive value', () => {
      portfolio.addDeFiPosition(createVaultPosition()); // +17500
      expect(portfolio.getDeFiNetValue()).toBe(17500);
    });

    it('handles mixed position types', () => {
      portfolio.addDeFiPosition(createSupplyPosition());  // +10000
      portfolio.addDeFiPosition(createBorrowPosition());  // -5000
      portfolio.addDeFiPosition(createVaultPosition());    // +17500

      expect(portfolio.getDeFiNetValue()).toBe(22500);
    });
  });

  describe('getTotalValue with DeFi', () => {
    it('includes DeFi net value in portfolio total', () => {
      // Add a regular asset: 1 ETH at $2500
      portfolio.addAsset(new AssetEntity({
        id: 'eth-1',
        symbol: 'ETH',
        type: AssetType.TOKEN,
        chain: 'ethereum',
        balance: { amount: 1, decimals: 18, formatted: '1.0' },
        price: { value: 2500, currency: 'USD', timestamp: new Date() }
      }));

      // Add DeFi supply: $10000
      portfolio.addDeFiPosition(createSupplyPosition());

      const total = portfolio.getTotalValue();
      expect(total.amount).toBe(12500); // 2500 + 10000
    });

    it('subtracts borrow from total', () => {
      portfolio.addAsset(new AssetEntity({
        id: 'eth-1',
        symbol: 'ETH',
        type: AssetType.TOKEN,
        chain: 'ethereum',
        balance: { amount: 1, decimals: 18, formatted: '1.0' },
        price: { value: 2500, currency: 'USD', timestamp: new Date() }
      }));

      portfolio.addDeFiPosition(createSupplyPosition());  // +10000
      portfolio.addDeFiPosition(createBorrowPosition());   // -5000

      const total = portfolio.getTotalValue();
      expect(total.amount).toBe(7500); // 2500 + 10000 - 5000
    });

    it('clamps total to zero if borrow exceeds supply + assets', () => {
      portfolio.addDeFiPosition(createBorrowPosition({
        value: { value: 999999, currency: 'USD', timestamp: new Date() }
      }));

      const total = portfolio.getTotalValue();
      expect(total.amount).toBe(0);
    });
  });

  describe('filterReceiptTokens', () => {
    it('removes assets matching receipt token addresses', () => {
      const receiptAsset = new AssetEntity({
        id: 'receipt-1',
        symbol: 'mooETH',
        type: AssetType.TOKEN,
        chain: 'ethereum',
        balance: { amount: 5, decimals: 18, formatted: '5.0' },
        contractAddress: '0xmooETH'
      });
      const normalAsset = new AssetEntity({
        id: 'eth-1',
        symbol: 'ETH',
        type: AssetType.TOKEN,
        chain: 'ethereum',
        balance: { amount: 1, decimals: 18, formatted: '1.0' }
      });

      portfolio.addAsset(receiptAsset);
      portfolio.addAsset(normalAsset);

      expect(portfolio.assets).toHaveLength(2);

      portfolio.filterReceiptTokens(new Set(['0xmooeth'])); // lowercase

      expect(portfolio.assets).toHaveLength(1);
      expect(portfolio.assets[0].symbol).toBe('ETH');
    });

    it('does nothing when no receipt tokens match', () => {
      portfolio.addAsset(new AssetEntity({
        id: 'eth-1',
        symbol: 'ETH',
        type: AssetType.TOKEN,
        chain: 'ethereum',
        balance: { amount: 1, decimals: 18, formatted: '1.0' }
      }));

      portfolio.filterReceiptTokens(new Set(['0xunknown']));
      expect(portfolio.assets).toHaveLength(1);
    });
  });

  describe('removeDeFiPosition', () => {
    it('removes a position by deduplicationKey', () => {
      const pos = createSupplyPosition();
      portfolio.addDeFiPosition(pos);
      expect(portfolio.defiPositions).toHaveLength(1);

      portfolio.removeDeFiPosition(pos.deduplicationKey);
      expect(portfolio.defiPositions).toHaveLength(0);
    });
  });

  describe('isEmpty', () => {
    it('returns true when no assets and no DeFi positions', () => {
      expect(portfolio.isEmpty()).toBe(true);
    });

    it('returns false when DeFi positions exist but no assets', () => {
      portfolio.addDeFiPosition(createSupplyPosition());
      expect(portfolio.isEmpty()).toBe(false);
    });
  });

  describe('clear', () => {
    it('clears DeFi positions along with assets', () => {
      portfolio.addDeFiPosition(createSupplyPosition());
      portfolio.addAsset(new AssetEntity({
        id: 'eth-1',
        symbol: 'ETH',
        type: AssetType.TOKEN,
        chain: 'ethereum',
        balance: { amount: 1, decimals: 18, formatted: '1.0' }
      }));

      portfolio.clear();
      expect(portfolio.defiPositions).toHaveLength(0);
      expect(portfolio.assets).toHaveLength(0);
      expect(portfolio.isEmpty()).toBe(true);
    });
  });

  describe('mergePortfolio with DeFi', () => {
    it('merges DeFi positions from another portfolio', () => {
      const other = new PortfolioAggregate({ id: 'other' });
      other.addDeFiPosition(createSupplyPosition());
      other.addDeFiPosition(createVaultPosition());

      portfolio.mergePortfolio(other);
      expect(portfolio.defiPositions).toHaveLength(2);
    });

    it('deduplicates when merging', () => {
      portfolio.addDeFiPosition(createSupplyPosition());

      const other = new PortfolioAggregate({ id: 'other' });
      other.addDeFiPosition(createSupplyPosition()); // Same dedup key

      portfolio.mergePortfolio(other);
      expect(portfolio.defiPositions).toHaveLength(1);
    });
  });

  describe('toJSON with DeFi', () => {
    it('includes defiPositions and defiNetValue', () => {
      portfolio.addDeFiPosition(createSupplyPosition());

      const json = portfolio.toJSON();
      expect(json.defiPositions).toHaveLength(1);
      expect(json.defiNetValue).toBe(10000);
    });
  });

  describe('constructor with DeFi positions', () => {
    it('accepts initial DeFi positions', () => {
      const positions = [createSupplyPosition(), createVaultPosition()];
      const p = new PortfolioAggregate({
        id: 'test',
        defiPositions: positions
      });

      expect(p.defiPositions).toHaveLength(2);
    });
  });
});
