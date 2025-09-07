import type { IAssetValuatorRepository } from '@contracts/repositories/IAssetValuatorRepository';
import type { Price } from '@shared/types';

/**
 * Domain errors for asset valuation operations
 */
export class AssetNotFoundError extends Error {
  constructor(symbol: string) {
    super(`Asset ${symbol} not found in pricing database`);
    this.name = 'AssetNotFoundError';
  }
}

export class CurrencyConversionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot convert from ${from} to ${to}: conversion rate not available`);
    this.name = 'CurrencyConversionError';
  }
}

export class PricingServiceError extends Error {
  constructor(message: string, cause?: Error) {
    super(`Pricing service error: ${message}`);
    this.name = 'PricingServiceError';
    this.cause = cause;
  }
}

/**
 * Mock implementation of IAssetValuatorRepository for development and testing.
 * Provides realistic demo prices for common crypto assets with caching and error simulation.
 * 
 * Features:
 * - Realistic price data for 20+ major cryptocurrencies
 * - In-memory caching with TTL (5-minute default)
 * - Currency conversion between major fiat currencies
 * - Error simulation for testing edge cases
 * - Batch price fetching with optimized performance
 */
export class MockAssetValuatorRepository implements IAssetValuatorRepository {
  private readonly cache = new Map<string, { price: Price; expiry: number }>();
  private readonly cacheTtlMs: number;
  private readonly networkLatencyMs: number;

  // Realistic base prices in USD (as of recent market data)
  private readonly basePrices: Record<string, number> = {
    // Major Cryptocurrencies
    BTC: 43250.00,
    ETH: 2650.00,
    BNB: 315.50,
    SOL: 98.75,
    ADA: 0.52,
    AVAX: 38.20,
    DOT: 7.15,
    MATIC: 0.89,
    LINK: 14.35,
    UNI: 6.85,
    
    // Stablecoins
    USDT: 1.00,
    USDC: 1.00,
    BUSD: 1.00,
    DAI: 1.00,
    FRAX: 1.00,
    
    // DeFi Tokens
    AAVE: 98.50,
    COMP: 52.30,
    MKR: 1450.00,
    SNX: 2.85,
    CRV: 0.95,
    
    // Layer 2 & Alt L1s
    ARB: 1.25,
    OP: 2.15,
    ATOM: 10.45,
    NEAR: 3.20,
    FTM: 0.35,
    
    // Meme/Community Coins
    DOGE: 0.085,
    SHIB: 0.0000095,
    PEPE: 0.0000012,
    
    // Other Notable Assets
    LTC: 72.50,
    BCH: 245.00,
    XRP: 0.58,
    TRX: 0.105,
    ETC: 20.25
  };

  // Exchange rates for major fiat currencies (relative to USD)
  private readonly exchangeRates: Record<string, number> = {
    USD: 1.00,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.50,
    CAD: 1.35,
    AUD: 1.52,
    CHF: 0.88,
    CNY: 7.25,
    KRW: 1325.00,
    INR: 83.20
  };

  constructor(options: {
    cacheTtlMs?: number;
    networkLatencyMs?: number;
  } = {}) {
    this.cacheTtlMs = options.cacheTtlMs ?? 300_000; // 5 minutes default
    this.networkLatencyMs = options.networkLatencyMs ?? 150; // 150ms default
  }

  /**
   * Retrieves the current price for a single asset
   */
  async getPrice(symbol: string, currency = 'USD'): Promise<Price> {
    // Simulate network latency
    await this.simulateNetworkDelay();
    
    const normalizedSymbol = symbol.toUpperCase();
    const normalizedCurrency = currency.toUpperCase();
    const cacheKey = `${normalizedSymbol}_${normalizedCurrency}`;
    
    // Check cache first
    const cached = this.getCachedPrice(cacheKey);
    if (cached) {
      return cached;
    }

    // Generate price with realistic market volatility
    const price = this.generatePrice(normalizedSymbol, normalizedCurrency);
    
    // Cache the result
    this.setCachedPrice(cacheKey, price);
    
    return price;
  }

  /**
   * Retrieves prices for multiple assets in a single batch operation
   * Optimized for performance with parallel processing simulation
   */
  async getBatchPrices(symbols: string[], currency = 'USD'): Promise<Map<string, Price>> {
    // Simulate batch API call latency (less than individual calls)
    await this.simulateNetworkDelay(Math.max(100, this.networkLatencyMs * 0.3));
    
    const normalizedCurrency = currency.toUpperCase();
    const results = new Map<string, Price>();
    const uncachedSymbols: string[] = [];
    
    // Check cache for all symbols first
    for (const symbol of symbols) {
      const normalizedSymbol = symbol.toUpperCase();
      const cacheKey = `${normalizedSymbol}_${normalizedCurrency}`;
      const cached = this.getCachedPrice(cacheKey);
      
      if (cached) {
        results.set(normalizedSymbol, cached);
      } else {
        uncachedSymbols.push(normalizedSymbol);
      }
    }
    
    // Fetch uncached prices in parallel (simulated)
    const uncachedPromises = uncachedSymbols.map(async (symbol) => {
      try {
        const price = this.generatePrice(symbol, normalizedCurrency);
        const cacheKey = `${symbol}_${normalizedCurrency}`;
        this.setCachedPrice(cacheKey, price);
        return { symbol, price };
      } catch (error) {
        // Log error but continue with other symbols
        console.warn(`Failed to fetch price for ${symbol}:`, error);
        return { symbol, price: null };
      }
    });
    
    const uncachedResults = await Promise.all(uncachedPromises);
    
    // Add uncached results to the final map
    for (const result of uncachedResults) {
      if (result.price) {
        results.set(result.symbol, result.price);
      }
    }
    
    return results;
  }

  /**
   * Converts a value from one currency to another
   */
  async convertValue(amount: number, from: string, to: string): Promise<number> {
    const normalizedFrom = from.toUpperCase();
    const normalizedTo = to.toUpperCase();
    
    if (normalizedFrom === normalizedTo) {
      return amount;
    }
    
    // Handle crypto-to-crypto conversions
    if (this.basePrices[normalizedFrom] && this.basePrices[normalizedTo]) {
      const fromUsdRate = this.basePrices[normalizedFrom];
      const toUsdRate = this.basePrices[normalizedTo];
      return (amount * fromUsdRate) / toUsdRate;
    }
    
    // Handle crypto-to-fiat conversions
    if (this.basePrices[normalizedFrom] && this.exchangeRates[normalizedTo]) {
      const usdValue = amount * this.basePrices[normalizedFrom];
      return usdValue / this.exchangeRates[normalizedTo];
    }
    
    // Handle fiat-to-crypto conversions
    if (this.exchangeRates[normalizedFrom] && this.basePrices[normalizedTo]) {
      const usdValue = amount * this.exchangeRates[normalizedFrom];
      return usdValue / this.basePrices[normalizedTo];
    }
    
    // Handle fiat-to-fiat conversions
    if (this.exchangeRates[normalizedFrom] && this.exchangeRates[normalizedTo]) {
      const usdValue = amount * this.exchangeRates[normalizedFrom];
      return usdValue / this.exchangeRates[normalizedTo];
    }
    
    throw new CurrencyConversionError(normalizedFrom, normalizedTo);
  }

  /**
   * Invalidates cached prices for specific symbols or all cached data
   */
  invalidateCache(symbols?: string[]): void {
    if (!symbols) {
      // Clear entire cache
      this.cache.clear();
      return;
    }
    
    // Clear specific symbols for all currencies
    for (const symbol of symbols) {
      const normalizedSymbol = symbol.toUpperCase();
      const keysToDelete: string[] = [];
      
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${normalizedSymbol}_`)) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  /**
   * Generates a realistic price with market volatility simulation
   */
  private generatePrice(symbol: string, currency: string): Price {
    const basePrice = this.basePrices[symbol];
    if (!basePrice) {
      throw new AssetNotFoundError(symbol);
    }
    
    const exchangeRate = this.exchangeRates[currency];
    if (!exchangeRate) {
      throw new CurrencyConversionError('USD', currency);
    }
    
    // Add realistic market volatility - less for stablecoins
    let volatility = 1;
    const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'FRAX'];
    
    if (stablecoins.includes(symbol)) {
      // Minimal volatility for stablecoins (±0.1%)
      volatility = 1 + (Math.random() - 0.5) * 0.002;
    } else {
      // Normal volatility for other assets (±2.5%)
      volatility = 1 + (Math.random() - 0.5) * 0.05;
    }
    
    const usdPrice = basePrice * volatility;
    const finalPrice = usdPrice / exchangeRate;
    
    return {
      value: Math.round(finalPrice * 100000000) / 100000000, // 8 decimal precision
      currency,
      timestamp: new Date(),
      source: 'MockAssetValuatorRepository'
    };
  }

  /**
   * Retrieves cached price if valid and not expired
   */
  private getCachedPrice(cacheKey: string): Price | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }
    
    if (Date.now() > cached.expiry) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return cached.price;
  }

  /**
   * Stores price in cache with expiry
   */
  private setCachedPrice(cacheKey: string, price: Price): void {
    this.cache.set(cacheKey, {
      price,
      expiry: Date.now() + this.cacheTtlMs
    });
  }

  /**
   * Simulates network latency for realistic testing
   */
  private async simulateNetworkDelay(delayMs?: number): Promise<void> {
    const delay = delayMs ?? this.networkLatencyMs;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Gets cache statistics for monitoring and debugging
   */
  getCacheStats(): {
    size: number;
    hitRate?: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const entries = Array.from(this.cache.values());
    
    return {
      size: this.cache.size,
      oldestEntry: entries.length > 0 
        ? new Date(Math.min(...entries.map(e => e.price.timestamp.getTime())))
        : undefined,
      newestEntry: entries.length > 0
        ? new Date(Math.max(...entries.map(e => e.price.timestamp.getTime())))
        : undefined
    };
  }

  /**
   * Lists all supported asset symbols
   */
  getSupportedAssets(): string[] {
    return Object.keys(this.basePrices).sort();
  }

  /**
   * Lists all supported currencies
   */
  getSupportedCurrencies(): string[] {
    return Object.keys(this.exchangeRates).sort();
  }
}