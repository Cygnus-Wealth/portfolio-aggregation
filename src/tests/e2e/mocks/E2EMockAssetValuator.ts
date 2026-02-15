import { IAssetValuatorRepository, Price } from '../../../contracts/repositories/IAssetValuatorRepository';

export interface ValuatorConfig {
  shouldFail?: boolean;
  errorMessage?: string;
  delay?: number;
}

/**
 * E2E mock asset valuator with configurable behavior
 */
export class E2EMockAssetValuator implements IAssetValuatorRepository {
  private prices: Map<string, Price> = new Map();
  private config: ValuatorConfig;
  getBatchPricesCallCount = 0;

  constructor(config: ValuatorConfig = {}) {
    this.config = config;
    this.setupDefaultPrices();
  }

  async getPrice(symbol: string, currency: string = 'USD'): Promise<Price> {
    if (this.config.shouldFail) {
      throw new Error(this.config.errorMessage || 'Valuator unavailable');
    }

    if (this.config.delay) {
      await new Promise(r => setTimeout(r, this.config.delay));
    }

    return this.prices.get(`${symbol}:${currency}`) || {
      value: 0,
      currency,
      timestamp: new Date(),
      source: 'mock-e2e'
    };
  }

  async getBatchPrices(symbols: string[], currency: string = 'USD'): Promise<Map<string, Price>> {
    this.getBatchPricesCallCount++;

    if (this.config.shouldFail) {
      throw new Error(this.config.errorMessage || 'Valuator unavailable');
    }

    const result = new Map<string, Price>();
    for (const symbol of symbols) {
      result.set(symbol, await this.getPrice(symbol, currency));
    }
    return result;
  }

  async convertValue(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    const fromPrice = await this.getPrice(from, 'USD');
    const toPrice = await this.getPrice(to, 'USD');
    if (fromPrice.value === 0 || toPrice.value === 0) return 0;
    return (amount * fromPrice.value) / toPrice.value;
  }

  invalidateCache(_symbols?: string[]): void {
    // no-op for mock
  }

  // -- Test helpers --

  setPrice(symbol: string, value: number, currency: string = 'USD'): void {
    this.prices.set(`${symbol}:${currency}`, {
      value,
      currency,
      timestamp: new Date(),
      source: 'mock-e2e'
    });
  }

  setFailure(shouldFail: boolean, errorMessage?: string): void {
    this.config.shouldFail = shouldFail;
    this.config.errorMessage = errorMessage;
  }

  private setupDefaultPrices(): void {
    const defaults: Record<string, number> = {
      ETH: 2500,
      BTC: 45000,
      SOL: 100,
      USDC: 1,
      USDT: 1,
      AAPL: 175,
      DAI: 1,
      LINK: 15,
      UNI: 8,
      AAVE: 90
    };

    for (const [symbol, value] of Object.entries(defaults)) {
      this.prices.set(`${symbol}:USD`, {
        value,
        currency: 'USD',
        timestamp: new Date(),
        source: 'mock-e2e'
      });
    }
  }
}
