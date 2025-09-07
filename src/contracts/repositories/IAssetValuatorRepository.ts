import type { Price } from '../../shared/types';

export interface IAssetValuatorRepository {
  getPrice(symbol: string, currency?: string): Promise<Price>;
  getBatchPrices(symbols: string[], currency?: string): Promise<Map<string, Price>>;
  convertValue(amount: number, from: string, to: string): Promise<number>;
  invalidateCache(symbols?: string[]): void;
}