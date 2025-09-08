import { IIntegrationRepository } from '../../contracts/repositories/IIntegrationRepository';
import { IntegrationSource, Asset, AssetType, Transaction } from '../../shared/types';

/**
 * Mock integration repository for testing
 */
export class MockIntegrationRepository implements IIntegrationRepository {
  readonly source: IntegrationSource;
  private connected = false;
  private mockAssets: Asset[] = [];
  private mockTransactions: Transaction[] = [];

  constructor(source: IntegrationSource = IntegrationSource.EVM) {
    this.source = source;
    this.setupMockData();
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchAssets(addresses: string[]): Promise<Asset[]> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    // Return mock assets for testing
    return this.mockAssets.filter(asset => 
      addresses.some(addr => asset.metadata?.address === addr)
    );
  }

  async fetchTransactions(addresses: string[], limit?: number): Promise<Transaction[]> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const transactions = this.mockTransactions.filter(tx =>
      addresses.includes(tx.from) || addresses.includes(tx.to)
    );

    return limit ? transactions.slice(0, limit) : transactions;
  }

  /**
   * Set mock assets for testing
   */
  setMockAssets(assets: Asset[]): void {
    this.mockAssets = assets;
  }

  /**
   * Set mock transactions for testing
   */
  setMockTransactions(transactions: Transaction[]): void {
    this.mockTransactions = transactions;
  }

  private setupMockData(): void {
    // Default mock data
    this.mockAssets = [
      {
        id: 'mock-eth-1',
        symbol: 'ETH',
        name: 'Ethereum',
        type: AssetType.CRYPTOCURRENCY,
        chain: 'ethereum',
        balance: {
          amount: 1.5,
          decimals: 18,
          formatted: '1.500000000000000000'
        },
        price: {
          value: 2500,
          currency: 'USD'
        },
        metadata: {
          address: '0x123',
          source: this.source
        }
      },
      {
        id: 'mock-usdc-1',
        symbol: 'USDC',
        name: 'USD Coin',
        type: AssetType.CRYPTOCURRENCY,
        chain: 'ethereum',
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        balance: {
          amount: 1000,
          decimals: 6,
          formatted: '1000.000000'
        },
        price: {
          value: 1,
          currency: 'USD'
        },
        metadata: {
          address: '0x123',
          source: this.source
        }
      }
    ];
  }
}