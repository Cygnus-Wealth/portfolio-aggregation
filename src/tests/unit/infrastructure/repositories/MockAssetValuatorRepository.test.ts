import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  MockAssetValuatorRepository, 
  AssetNotFoundError, 
  CurrencyConversionError,
  PricingServiceError 
} from '../../../../infrastructure/repositories/MockAssetValuatorRepository';

describe('MockAssetValuatorRepository', () => {
  let repository: MockAssetValuatorRepository;

  beforeEach(() => {
    // Use real timers for most tests to avoid setTimeout issues
    repository = new MockAssetValuatorRepository({
      cacheTtlMs: 300000, // 5 minutes
      networkLatencyMs: 0 // Disable for tests
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const defaultRepo = new MockAssetValuatorRepository();
      expect(defaultRepo).toBeInstanceOf(MockAssetValuatorRepository);
    });

    it('should create instance with custom options', () => {
      const customRepo = new MockAssetValuatorRepository({
        cacheTtlMs: 600000,
        networkLatencyMs: 200
      });
      expect(customRepo).toBeInstanceOf(MockAssetValuatorRepository);
    });
  });

  describe('getPrice', () => {
    it('should return price for supported cryptocurrency', async () => {
      const price = await repository.getPrice('BTC');
      
      expect(price).toMatchObject({
        value: expect.any(Number),
        currency: 'USD',
        timestamp: expect.any(Date),
        source: 'MockAssetValuatorRepository'
      });
      expect(price.value).toBeGreaterThan(0);
    });

    it('should return price in different currency', async () => {
      const price = await repository.getPrice('ETH', 'EUR');
      
      expect(price.currency).toBe('EUR');
      expect(price.value).toBeGreaterThan(0);
    });

    it('should handle lowercase symbol', async () => {
      const price = await repository.getPrice('btc');
      
      expect(price.currency).toBe('USD');
      expect(price.value).toBeGreaterThan(0);
    });

    it('should handle lowercase currency', async () => {
      const price = await repository.getPrice('BTC', 'eur');
      
      expect(price.currency).toBe('EUR');
      expect(price.value).toBeGreaterThan(0);
    });

    it('should throw AssetNotFoundError for unsupported asset', async () => {
      await expect(repository.getPrice('INVALID')).rejects.toThrow(AssetNotFoundError);
      await expect(repository.getPrice('INVALID')).rejects.toThrow(
        'Asset INVALID not found in pricing database'
      );
    });

    it('should throw CurrencyConversionError for unsupported currency', async () => {
      await expect(repository.getPrice('BTC', 'INVALID')).rejects.toThrow(CurrencyConversionError);
      await expect(repository.getPrice('BTC', 'INVALID')).rejects.toThrow(
        'Cannot convert from USD to INVALID: conversion rate not available'
      );
    });

    it('should return consistent price for stablecoins', async () => {
      const usdtPrice = await repository.getPrice('USDT');
      const usdcPrice = await repository.getPrice('USDC');
      
      expect(usdtPrice.value).toBeCloseTo(1.0, 2);
      expect(usdcPrice.value).toBeCloseTo(1.0, 2);
    });

    it('should generate different prices due to volatility', async () => {
      const prices: number[] = [];
      
      // Generate multiple prices for the same asset
      for (let i = 0; i < 10; i++) {
        repository.invalidateCache(['BTC']); // Clear cache to get fresh price
        const price = await repository.getPrice('BTC');
        prices.push(price.value);
      }
      
      // Prices should vary due to volatility simulation
      const uniquePrices = new Set(prices);
      expect(uniquePrices.size).toBeGreaterThan(1);
    });

    it('should have reasonable precision (8 decimal places max)', async () => {
      const price = await repository.getPrice('BTC');
      const decimalPlaces = (price.value.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(8);
    });
  });

  describe('getBatchPrices', () => {
    it('should return prices for multiple supported assets', async () => {
      const symbols = ['BTC', 'ETH', 'SOL'];
      const prices = await repository.getBatchPrices(symbols);
      
      expect(prices.size).toBe(3);
      
      for (const symbol of symbols) {
        const price = prices.get(symbol);
        expect(price).toMatchObject({
          value: expect.any(Number),
          currency: 'USD',
          timestamp: expect.any(Date),
          source: 'MockAssetValuatorRepository'
        });
        expect(price!.value).toBeGreaterThan(0);
      }
    });

    it('should return prices in different currency', async () => {
      const symbols = ['BTC', 'ETH'];
      const prices = await repository.getBatchPrices(symbols, 'EUR');
      
      expect(prices.size).toBe(2);
      
      for (const [, price] of prices) {
        expect(price.currency).toBe('EUR');
        expect(price.value).toBeGreaterThan(0);
      }
    });

    it('should handle empty symbol array', async () => {
      const prices = await repository.getBatchPrices([]);
      expect(prices.size).toBe(0);
    });

    it('should handle duplicate symbols', async () => {
      const symbols = ['BTC', 'BTC', 'ETH'];
      const prices = await repository.getBatchPrices(symbols);
      
      // Should return unique symbols only
      expect(prices.size).toBe(2);
      expect(prices.has('BTC')).toBe(true);
      expect(prices.has('ETH')).toBe(true);
    });

    it('should handle mix of valid and invalid symbols gracefully', async () => {
      const symbols = ['BTC', 'INVALID1', 'ETH', 'INVALID2'];
      const prices = await repository.getBatchPrices(symbols);
      
      // Should return prices only for valid symbols
      expect(prices.size).toBe(2);
      expect(prices.has('BTC')).toBe(true);
      expect(prices.has('ETH')).toBe(true);
      expect(prices.has('INVALID1')).toBe(false);
      expect(prices.has('INVALID2')).toBe(false);
    });

    it('should handle lowercase symbols', async () => {
      const symbols = ['btc', 'eth'];
      const prices = await repository.getBatchPrices(symbols);
      
      expect(prices.size).toBe(2);
      expect(prices.has('BTC')).toBe(true);
      expect(prices.has('ETH')).toBe(true);
    });

    it('should process batch requests correctly', async () => {
      const symbols = ['BTC', 'ETH', 'SOL'];
      
      // Test batch processing
      const batchPrices = await repository.getBatchPrices(symbols);
      
      expect(batchPrices.size).toBe(3);
      expect(batchPrices.has('BTC')).toBe(true);
      expect(batchPrices.has('ETH')).toBe(true);
      expect(batchPrices.has('SOL')).toBe(true);
      
      // Each price should be valid
      for (const [, price] of batchPrices) {
        expect(price.value).toBeGreaterThan(0);
        expect(price.currency).toBe('USD');
        expect(price.timestamp).toBeInstanceOf(Date);
      }
    });
  });

  describe('convertValue', () => {
    it('should convert between crypto currencies', async () => {
      const result = await repository.convertValue(1, 'BTC', 'ETH');
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('should convert crypto to fiat', async () => {
      const result = await repository.convertValue(1, 'BTC', 'USD');
      expect(result).toBeGreaterThan(40000); // BTC should be worth more than $40k
    });

    it('should convert fiat to crypto', async () => {
      const result = await repository.convertValue(50000, 'USD', 'BTC');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(2); // $50k should be less than 2 BTC
    });

    it('should convert between fiat currencies', async () => {
      const result = await repository.convertValue(100, 'USD', 'EUR');
      expect(result).toBeGreaterThan(80); // Should be around 92 EUR
      expect(result).toBeLessThan(120);
    });

    it('should return same value for same currency', async () => {
      const amount = 1000;
      const result = await repository.convertValue(amount, 'USD', 'USD');
      expect(result).toBe(amount);
    });

    it('should handle case insensitive currencies', async () => {
      const result = await repository.convertValue(100, 'usd', 'eur');
      expect(result).toBeGreaterThan(0);
    });

    it('should throw CurrencyConversionError for invalid from currency', async () => {
      await expect(repository.convertValue(100, 'INVALID', 'USD'))
        .rejects.toThrow(CurrencyConversionError);
    });

    it('should throw CurrencyConversionError for invalid to currency', async () => {
      await expect(repository.convertValue(100, 'USD', 'INVALID'))
        .rejects.toThrow(CurrencyConversionError);
    });

    it('should maintain mathematical consistency', async () => {
      // Convert USD to BTC and back
      const usdAmount = 10000;
      const btcAmount = await repository.convertValue(usdAmount, 'USD', 'BTC');
      const backToUsd = await repository.convertValue(btcAmount, 'BTC', 'USD');
      
      // Should be approximately equal (within 0.1% due to rounding)
      expect(backToUsd).toBeCloseTo(usdAmount, -1);
    });
  });

  describe('caching', () => {
    it('should cache prices and return same value on second call', async () => {
      const price1 = await repository.getPrice('BTC');
      const price2 = await repository.getPrice('BTC');
      
      expect(price1.value).toBe(price2.value);
      expect(price1.timestamp).toEqual(price2.timestamp);
    });

    it('should cache batch prices', async () => {
      const symbols = ['BTC', 'ETH'];
      const prices1 = await repository.getBatchPrices(symbols);
      const prices2 = await repository.getBatchPrices(symbols);
      
      expect(prices1.get('BTC')!.value).toBe(prices2.get('BTC')!.value);
      expect(prices1.get('ETH')!.value).toBe(prices2.get('ETH')!.value);
    });

    it('should use cache for individual calls after batch call', async () => {
      const symbols = ['BTC', 'ETH'];
      const batchPrices = await repository.getBatchPrices(symbols);
      
      const btcPrice = await repository.getPrice('BTC');
      const ethPrice = await repository.getPrice('ETH');
      
      expect(btcPrice.value).toBe(batchPrices.get('BTC')!.value);
      expect(ethPrice.value).toBe(batchPrices.get('ETH')!.value);
    });

    it('should expire cached prices after TTL', async () => {
      vi.useFakeTimers();
      
      const price1 = await repository.getPrice('BTC');
      
      // Advance time past cache TTL
      vi.advanceTimersByTime(300001); // 5 minutes + 1ms
      
      const price2 = await repository.getPrice('BTC');
      
      // Prices should be different due to cache expiry and volatility
      expect(price1.value).not.toBe(price2.value);
      
      vi.useRealTimers();
    });

    it('should respect currency-specific caching', async () => {
      const usdPrice = await repository.getPrice('BTC', 'USD');
      const eurPrice = await repository.getPrice('BTC', 'EUR');
      
      expect(usdPrice.currency).toBe('USD');
      expect(eurPrice.currency).toBe('EUR');
      expect(usdPrice.value).not.toBe(eurPrice.value);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate cache for all symbols when no arguments provided', async () => {
      const price1 = await repository.getPrice('BTC');
      repository.invalidateCache();
      const price2 = await repository.getPrice('BTC');
      
      // Should get new price due to volatility
      expect(price1.value).not.toBe(price2.value);
    });

    it('should invalidate cache for specific symbols', async () => {
      const btcPrice1 = await repository.getPrice('BTC');
      const ethPrice1 = await repository.getPrice('ETH');
      
      repository.invalidateCache(['BTC']);
      
      const btcPrice2 = await repository.getPrice('BTC');
      const ethPrice2 = await repository.getPrice('ETH');
      
      // BTC should be different, ETH should be same (cached)
      expect(btcPrice1.value).not.toBe(btcPrice2.value);
      expect(ethPrice1.value).toBe(ethPrice2.value);
    });

    it('should invalidate cache for specific symbol across all currencies', async () => {
      const btcUsdPrice1 = await repository.getPrice('BTC', 'USD');
      const btcEurPrice1 = await repository.getPrice('BTC', 'EUR');
      
      repository.invalidateCache(['BTC']);
      
      const btcUsdPrice2 = await repository.getPrice('BTC', 'USD');
      const btcEurPrice2 = await repository.getPrice('BTC', 'EUR');
      
      expect(btcUsdPrice1.value).not.toBe(btcUsdPrice2.value);
      expect(btcEurPrice1.value).not.toBe(btcEurPrice2.value);
    });

    it('should handle case insensitive symbol invalidation', async () => {
      const price1 = await repository.getPrice('BTC');
      repository.invalidateCache(['btc']);
      const price2 = await repository.getPrice('BTC');
      
      expect(price1.value).not.toBe(price2.value);
    });
  });

  describe('utility methods', () => {
    describe('getCacheStats', () => {
      it('should return empty stats for empty cache', () => {
        const stats = repository.getCacheStats();
        expect(stats.size).toBe(0);
        expect(stats.oldestEntry).toBeUndefined();
        expect(stats.newestEntry).toBeUndefined();
      });

      it('should return cache statistics', async () => {
        await repository.getPrice('BTC');
        await repository.getPrice('ETH');
        
        const stats = repository.getCacheStats();
        expect(stats.size).toBe(2);
        expect(stats.oldestEntry).toBeInstanceOf(Date);
        expect(stats.newestEntry).toBeInstanceOf(Date);
      });
    });

    describe('getSupportedAssets', () => {
      it('should return sorted list of supported assets', () => {
        const assets = repository.getSupportedAssets();
        expect(assets).toBeInstanceOf(Array);
        expect(assets.length).toBeGreaterThan(20);
        expect(assets).toContain('BTC');
        expect(assets).toContain('ETH');
        expect(assets).toContain('SOL');
        
        // Should be sorted
        const sorted = [...assets].sort();
        expect(assets).toEqual(sorted);
      });
    });

    describe('getSupportedCurrencies', () => {
      it('should return sorted list of supported currencies', () => {
        const currencies = repository.getSupportedCurrencies();
        expect(currencies).toBeInstanceOf(Array);
        expect(currencies.length).toBeGreaterThan(5);
        expect(currencies).toContain('USD');
        expect(currencies).toContain('EUR');
        expect(currencies).toContain('GBP');
        
        // Should be sorted
        const sorted = [...currencies].sort();
        expect(currencies).toEqual(sorted);
      });
    });
  });

  describe('error handling', () => {
    describe('AssetNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new AssetNotFoundError('INVALID');
        expect(error.name).toBe('AssetNotFoundError');
        expect(error.message).toBe('Asset INVALID not found in pricing database');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('CurrencyConversionError', () => {
      it('should have correct name and message', () => {
        const error = new CurrencyConversionError('USD', 'INVALID');
        expect(error.name).toBe('CurrencyConversionError');
        expect(error.message).toBe('Cannot convert from USD to INVALID: conversion rate not available');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('PricingServiceError', () => {
      it('should have correct name and message', () => {
        const error = new PricingServiceError('Service unavailable');
        expect(error.name).toBe('PricingServiceError');
        expect(error.message).toBe('Pricing service error: Service unavailable');
        expect(error).toBeInstanceOf(Error);
      });

      it('should support cause chaining', () => {
        const cause = new Error('Network timeout');
        const error = new PricingServiceError('Service unavailable', cause);
        expect(error.cause).toBe(cause);
      });
    });
  });

  describe('realistic price behavior', () => {
    it('should have reasonable price ranges for major cryptocurrencies', async () => {
      const btcPrice = await repository.getPrice('BTC');
      const ethPrice = await repository.getPrice('ETH');
      const solPrice = await repository.getPrice('SOL');
      
      // BTC should be significantly more expensive than ETH and SOL
      expect(btcPrice.value).toBeGreaterThan(ethPrice.value);
      expect(ethPrice.value).toBeGreaterThan(solPrice.value);
      
      // Reasonable price ranges (with volatility buffer)
      expect(btcPrice.value).toBeGreaterThan(35000);
      expect(btcPrice.value).toBeLessThan(60000);
      expect(ethPrice.value).toBeGreaterThan(2000);
      expect(ethPrice.value).toBeLessThan(4000);
    });

    it('should maintain currency conversion accuracy', async () => {
      const btcUsdPrice = await repository.getPrice('BTC', 'USD');
      const btcEurPrice = await repository.getPrice('BTC', 'EUR');
      
      // EUR price should be higher than USD (since EUR rate < 1)
      expect(btcEurPrice.value).toBeGreaterThan(btcUsdPrice.value);
      
      // Ratio should be approximately correct (within volatility bounds)
      const ratio = btcEurPrice.value / btcUsdPrice.value;
      expect(ratio).toBeGreaterThan(1.0);
      expect(ratio).toBeLessThan(1.2); // EUR conversion rate should be reasonable
    });
  });
});