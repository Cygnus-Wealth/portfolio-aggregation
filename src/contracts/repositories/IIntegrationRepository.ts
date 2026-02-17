import type { Asset, Portfolio, Transaction, DeFiPosition } from '../../shared/types';
import { IntegrationSource } from '../../shared/types';

export interface IIntegrationRepository {
  source: IntegrationSource;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  fetchPortfolio(addresses: string[]): Promise<Portfolio>;
  fetchAssets(addresses: string[]): Promise<Asset[]>;
  fetchTransactions(addresses: string[], limit?: number): Promise<Transaction[]>;
  getDeFiPositions?(addresses: string[]): Promise<DeFiPosition[]>;

  subscribeToUpdates?(addresses: string[], callback: (update: Portfolio) => void): () => void;
}