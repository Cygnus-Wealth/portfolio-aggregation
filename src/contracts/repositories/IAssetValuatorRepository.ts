import type { Price } from '../../shared/types';

export type { Price };

export interface MarketData {
  symbol: string;
  price: Price;
  volume24h?: number;
  marketCap?: number;
  change24h?: number;
  changePercentage24h?: number;
  high24h?: number;
  low24h?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  lastUpdated?: Date;
}

export interface IAssetValuatorRepository {
  getPrice(symbol: string, currency?: string): Promise<Price>;
  getBatchPrices(symbols: string[], currency?: string): Promise<Map<string, Price>>;
  convertValue(amount: number, from: string, to: string): Promise<number>;
  invalidateCache(symbols?: string[]): void;
}