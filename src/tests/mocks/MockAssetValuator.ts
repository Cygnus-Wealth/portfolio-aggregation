import { 
  IAssetValuatorRepository, 
  Price, 
  MarketData 
} from '../../contracts/repositories/IAssetValuatorRepository';

/**
 * Mock asset valuator for testing
 */
export class MockAssetValuator implements IAssetValuatorRepository {
  private prices: Map<string, Price> = new Map();
  private marketData: Map<string, MarketData> = new Map();

  constructor() {
    this.setupDefaultPrices();
  }

  async getPrice(symbol: string, currency: string = 'USD'): Promise<Price> {
    const price = this.prices.get(`${symbol}:${currency}`);
    if (!price) {
      // Return a default price for unknown assets
      return {
        value: 0,
        currency,
        timestamp: new Date(),
        source: 'mock'
      };
    }
    return price;
  }

  async getBatchPrices(
    symbols: string[], 
    currency: string = 'USD'
  ): Promise<Map<string, Price>> {
    const result = new Map<string, Price>();
    
    for (const symbol of symbols) {
      const price = await this.getPrice(symbol, currency);
      result.set(symbol, price);
    }
    
    return result;
  }

  async getMarketData(symbol: string): Promise<MarketData> {
    const data = this.marketData.get(symbol);
    if (!data) {
      // Return default market data
      return {
        symbol,
        price: await this.getPrice(symbol),
        marketCap: 0,
        volume24h: 0,
        change24h: 0,
        changePercentage24h: 0,
        high24h: 0,
        low24h: 0,
        circulatingSupply: 0,
        totalSupply: 0,
        lastUpdated: new Date()
      };
    }
    return data;
  }

  async convertValue(amount: number, from: string, to: string): Promise<number> {
    if (from === to) {
      return amount;
    }

    // Get prices in USD
    const fromPrice = await this.getPrice(from, 'USD');
    const toPrice = await this.getPrice(to, 'USD');

    if (fromPrice.value === 0 || toPrice.value === 0) {
      return 0;
    }

    // Convert through USD
    const usdValue = amount * fromPrice.value;
    return usdValue / toPrice.value;
  }

  /**
   * Set mock price for testing
   */
  setPrice(symbol: string, price: Price): void {
    this.prices.set(`${symbol}:${price.currency}`, price);
  }

  /**
   * Set mock market data for testing
   */
  setMarketData(symbol: string, data: MarketData): void {
    this.marketData.set(symbol, data);
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.prices.clear();
    this.marketData.clear();
    this.setupDefaultPrices();
  }

  private setupDefaultPrices(): void {
    // Default prices for common assets
    this.prices.set('ETH:USD', {
      value: 2500,
      currency: 'USD',
      timestamp: new Date(),
      source: 'mock'
    });

    this.prices.set('BTC:USD', {
      value: 45000,
      currency: 'USD',
      timestamp: new Date(),
      source: 'mock'
    });

    this.prices.set('USDC:USD', {
      value: 1,
      currency: 'USD',
      timestamp: new Date(),
      source: 'mock'
    });

    this.prices.set('USDT:USD', {
      value: 1,
      currency: 'USD',
      timestamp: new Date(),
      source: 'mock'
    });

    // Setup default market data
    this.marketData.set('ETH', {
      symbol: 'ETH',
      price: this.prices.get('ETH:USD')!,
      marketCap: 300000000000,
      volume24h: 15000000000,
      change24h: 50,
      changePercentage24h: 2.0,
      high24h: 2550,
      low24h: 2400,
      circulatingSupply: 120000000,
      totalSupply: 120000000,
      lastUpdated: new Date()
    });

    this.marketData.set('BTC', {
      symbol: 'BTC',
      price: this.prices.get('BTC:USD')!,
      marketCap: 880000000000,
      volume24h: 25000000000,
      change24h: 500,
      changePercentage24h: 1.12,
      high24h: 45500,
      low24h: 44000,
      circulatingSupply: 19500000,
      totalSupply: 21000000,
      lastUpdated: new Date()
    });
  }
}