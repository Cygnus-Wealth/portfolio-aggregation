import { IIntegrationRepository } from '../../../contracts/repositories/IIntegrationRepository';
import { IntegrationSource, Asset, AssetType, Portfolio, Transaction } from '../../../shared/types';

export interface E2EMockConfig {
  source: IntegrationSource;
  shouldFail?: boolean;
  failAfterConnect?: boolean;
  connectDelay?: number;
  fetchDelay?: number;
  errorMessage?: string;
}

/**
 * E2E mock integration repository with configurable failure modes
 */
export class E2EMockIntegrationRepository implements IIntegrationRepository {
  readonly source: IntegrationSource;
  private connected = false;
  private assets: Map<string, Asset[]> = new Map();
  private transactions: Transaction[] = [];
  private config: E2EMockConfig;

  connectCallCount = 0;
  fetchCallCount = 0;

  constructor(config: E2EMockConfig) {
    this.config = config;
    this.source = config.source;
  }

  async connect(): Promise<void> {
    this.connectCallCount++;

    if (this.config.connectDelay) {
      await new Promise(r => setTimeout(r, this.config.connectDelay));
    }

    if (this.config.shouldFail) {
      throw new Error(this.config.errorMessage || `${this.source} connection failed`);
    }

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchPortfolio(addresses: string[]): Promise<Portfolio> {
    const assets = await this.fetchAssets(addresses);
    const totalValue = assets.reduce((sum, a) => sum + ((a.price?.value || 0) * a.balance.amount), 0);

    return {
      id: `portfolio-${this.source}-${Date.now()}`,
      assets,
      totalValue: { value: totalValue, currency: 'USD', timestamp: new Date() },
      lastUpdated: new Date(),
      sources: [this.source]
    };
  }

  async fetchAssets(addresses: string[]): Promise<Asset[]> {
    this.fetchCallCount++;

    if (this.config.fetchDelay) {
      await new Promise(r => setTimeout(r, this.config.fetchDelay));
    }

    if (this.config.shouldFail) {
      throw new Error(this.config.errorMessage || `${this.source} fetch failed`);
    }

    if (!this.connected) {
      throw new Error('Not connected');
    }

    const result: Asset[] = [];
    for (const addr of addresses) {
      const addrAssets = this.assets.get(addr);
      if (addrAssets) {
        result.push(...addrAssets);
      }
    }
    return result;
  }

  async fetchTransactions(addresses: string[], limit?: number): Promise<Transaction[]> {
    if (!this.connected) throw new Error('Not connected');
    const txs = this.transactions.filter(tx =>
      addresses.includes(tx.from) || addresses.includes(tx.to)
    );
    return limit ? txs.slice(0, limit) : txs;
  }

  // -- Test helpers --

  addAssetsForAddress(address: string, assets: Asset[]): void {
    const existing = this.assets.get(address) || [];
    this.assets.set(address, [...existing, ...assets]);
  }

  setTransactions(transactions: Transaction[]): void {
    this.transactions = transactions;
  }

  setFailure(shouldFail: boolean, errorMessage?: string): void {
    this.config.shouldFail = shouldFail;
    this.config.errorMessage = errorMessage;
  }

  reset(): void {
    this.connected = false;
    this.connectCallCount = 0;
    this.fetchCallCount = 0;
  }
}

// -- Factory helpers for common test data --

export function createEVMAssets(address: string): Asset[] {
  return [
    {
      id: `evm-eth-${address.slice(0, 8)}`,
      symbol: 'ETH',
      name: 'Ethereum',
      type: AssetType.CRYPTOCURRENCY,
      chain: 'ethereum',
      balance: { amount: 2.5, decimals: 18, formatted: '2.500000000000000000' },
      price: { value: 2500, currency: 'USD', timestamp: new Date() },
      metadata: { address, source: IntegrationSource.EVM }
    },
    {
      id: `evm-usdc-${address.slice(0, 8)}`,
      symbol: 'USDC',
      name: 'USD Coin',
      type: AssetType.CRYPTOCURRENCY,
      chain: 'ethereum',
      contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      balance: { amount: 5000, decimals: 6, formatted: '5000.000000' },
      price: { value: 1, currency: 'USD', timestamp: new Date() },
      metadata: { address, source: IntegrationSource.EVM }
    }
  ];
}

export function createSolanaAssets(address: string): Asset[] {
  return [
    {
      id: `sol-sol-${address.slice(0, 8)}`,
      symbol: 'SOL',
      name: 'Solana',
      type: AssetType.CRYPTOCURRENCY,
      chain: 'solana',
      balance: { amount: 50, decimals: 9, formatted: '50.000000000' },
      price: { value: 100, currency: 'USD', timestamp: new Date() },
      metadata: { address, source: IntegrationSource.SOLANA }
    },
    {
      id: `sol-usdc-${address.slice(0, 8)}`,
      symbol: 'USDC',
      name: 'USD Coin',
      type: AssetType.CRYPTOCURRENCY,
      chain: 'solana',
      contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      balance: { amount: 3000, decimals: 6, formatted: '3000.000000' },
      price: { value: 1, currency: 'USD', timestamp: new Date() },
      metadata: { address, source: IntegrationSource.SOLANA }
    }
  ];
}

export function createRobinhoodAssets(): Asset[] {
  return [
    {
      id: 'rh-aapl',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      type: AssetType.STOCK,
      balance: { amount: 10, decimals: 2, formatted: '10.00' },
      price: { value: 175, currency: 'USD', timestamp: new Date() },
      metadata: { source: IntegrationSource.ROBINHOOD }
    },
    {
      id: 'rh-btc',
      symbol: 'BTC',
      name: 'Bitcoin',
      type: AssetType.CRYPTOCURRENCY,
      balance: { amount: 0.5, decimals: 8, formatted: '0.50000000' },
      price: { value: 45000, currency: 'USD', timestamp: new Date() },
      metadata: { source: IntegrationSource.ROBINHOOD }
    }
  ];
}

export function createDuplicateEVMAssets(address: string): Asset[] {
  return [
    {
      id: `evm-eth-polygon-${address.slice(0, 8)}`,
      symbol: 'ETH',
      name: 'Ethereum',
      type: AssetType.CRYPTOCURRENCY,
      chain: 'ethereum',
      balance: { amount: 1.0, decimals: 18, formatted: '1.000000000000000000' },
      price: { value: 2500, currency: 'USD', timestamp: new Date() },
      metadata: { address, source: IntegrationSource.EVM }
    }
  ];
}
