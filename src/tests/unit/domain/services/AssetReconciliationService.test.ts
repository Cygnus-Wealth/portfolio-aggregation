import { describe, it, expect, beforeEach } from 'vitest';
import { AssetReconciliationService } from '../../../../domain/services/AssetReconciliationService';
import { AssetEntity } from '../../../../domain/entities/Asset';
import { AssetType } from '../../../../shared/types';

describe('AssetReconciliationService', () => {
  let service: AssetReconciliationService;

  beforeEach(() => {
    service = new AssetReconciliationService();
  });

  const createAsset = (overrides: Partial<AssetEntity> = {}): AssetEntity => {
    return new AssetEntity({
      id: 'asset-1',
      symbol: 'ETH',
      name: 'Ethereum',
      type: AssetType.CRYPTOCURRENCY,
      chain: 'ethereum',
      balance: {
        amount: 1.0,
        decimals: 18,
        formatted: '1.000000000000000000'
      },
      ...overrides
    });
  };

  describe('isSameAsset', () => {
    it('should identify same native tokens', () => {
      const asset1 = createAsset({ symbol: 'ETH', chain: 'ethereum' });
      const asset2 = createAsset({ symbol: 'ETH', chain: 'ethereum' });
      
      expect(service.isSameAsset(asset1, asset2)).toBe(true);
    });

    it('should identify same tokens with contract address', () => {
      const asset1 = createAsset({ 
        symbol: 'USDC', 
        chain: 'ethereum',
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      });
      const asset2 = createAsset({ 
        symbol: 'USDC', 
        chain: 'ethereum',
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' // lowercase
      });
      
      expect(service.isSameAsset(asset1, asset2)).toBe(true);
    });

    it('should differentiate tokens on different chains', () => {
      const asset1 = createAsset({ symbol: 'USDC', chain: 'ethereum' });
      const asset2 = createAsset({ symbol: 'USDC', chain: 'polygon' });
      
      expect(service.isSameAsset(asset1, asset2)).toBe(false);
    });

    it('should differentiate tokens with different contract addresses', () => {
      const asset1 = createAsset({ 
        symbol: 'TOKEN', 
        chain: 'ethereum',
        contractAddress: '0x111'
      });
      const asset2 = createAsset({ 
        symbol: 'TOKEN', 
        chain: 'ethereum',
        contractAddress: '0x222'
      });
      
      expect(service.isSameAsset(asset1, asset2)).toBe(false);
    });
  });

  describe('mergeAssets', () => {
    it('should merge balances of same assets', () => {
      const asset1 = createAsset({ 
        balance: { amount: 1.5, decimals: 18, formatted: '1.5' }
      });
      const asset2 = createAsset({ 
        balance: { amount: 2.5, decimals: 18, formatted: '2.5' }
      });
      
      const merged = service.mergeAssets(asset1, asset2);
      
      expect(merged.balance.amount).toBe(4.0);
      expect(merged.balance.formatted).toBe('4.000000000000000000');
    });

    it('should use most recent price', () => {
      const asset1 = createAsset({ 
        price: { value: 2000, currency: 'USD' },
        metadata: { fetchedAt: '2024-01-01T00:00:00Z' }
      });
      const asset2 = createAsset({ 
        price: { value: 2100, currency: 'USD' },
        metadata: { fetchedAt: '2024-01-02T00:00:00Z' }
      });
      
      const merged = service.mergeAssets(asset1, asset2);
      
      expect(merged.price?.value).toBe(2100);
    });

    it('should throw error when merging different assets', () => {
      const asset1 = createAsset({ symbol: 'ETH' });
      const asset2 = createAsset({ symbol: 'BTC' });
      
      expect(() => service.mergeAssets(asset1, asset2)).toThrow('Cannot merge different assets');
    });

    it('should track merged sources in metadata', () => {
      const asset1 = createAsset({ 
        metadata: { source: 'source1' }
      });
      const asset2 = createAsset({ 
        metadata: { source: 'source2' }
      });
      
      const merged = service.mergeAssets(asset1, asset2);
      
      expect(merged.metadata?.mergedFrom).toContain('source2');
    });
  });

  describe('reconcile', () => {
    it('should return single asset unchanged', () => {
      const asset = createAsset();
      const result = service.reconcile([asset]);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(asset);
    });

    it('should merge duplicate assets', () => {
      const asset1 = createAsset({ 
        id: 'asset-1',
        balance: { amount: 1.0, decimals: 18, formatted: '1.0' }
      });
      const asset2 = createAsset({ 
        id: 'asset-2',
        balance: { amount: 2.0, decimals: 18, formatted: '2.0' }
      });
      
      const result = service.reconcile([asset1, asset2]);
      
      expect(result).toHaveLength(1);
      expect(result[0].balance.amount).toBe(3.0);
    });

    it('should keep different assets separate', () => {
      const eth = createAsset({ symbol: 'ETH', chain: 'ethereum' });
      const btc = createAsset({ symbol: 'BTC', chain: 'bitcoin' });
      
      const result = service.reconcile([eth, btc]);
      
      expect(result).toHaveLength(2);
    });

    it('should handle multiple duplicates', () => {
      const asset1 = createAsset({ 
        id: '1',
        balance: { amount: 1.0, decimals: 18, formatted: '1.0' }
      });
      const asset2 = createAsset({ 
        id: '2',
        balance: { amount: 2.0, decimals: 18, formatted: '2.0' }
      });
      const asset3 = createAsset({ 
        id: '3',
        balance: { amount: 3.0, decimals: 18, formatted: '3.0' }
      });
      
      const result = service.reconcile([asset1, asset2, asset3]);
      
      expect(result).toHaveLength(1);
      expect(result[0].balance.amount).toBe(6.0);
    });

    it('should handle tokens with different contract addresses separately', () => {
      const usdc1 = createAsset({ 
        symbol: 'USDC',
        chain: 'ethereum',
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      });
      const usdc2 = createAsset({ 
        symbol: 'USDC',
        chain: 'ethereum',
        contractAddress: '0xdifferent'
      });
      
      const result = service.reconcile([usdc1, usdc2]);
      
      expect(result).toHaveLength(2);
    });
  });
});