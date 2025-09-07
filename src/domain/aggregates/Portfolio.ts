import { IntegrationSource } from '../../shared/types';
import type { Price } from '../../shared/types';
import { AssetEntity } from '../entities/Asset';
import { Money } from '../value-objects/Money';

export class PortfolioAggregate {
  private _id: string;
  private _userId?: string;
  private _assets: Map<string, AssetEntity>;
  private _sources: Set<IntegrationSource>;
  private _lastUpdated: Date;

  constructor(params: {
    id: string;
    userId?: string;
    assets?: AssetEntity[];
    sources?: IntegrationSource[];
    lastUpdated?: Date;
  }) {
    this._id = params.id;
    this._userId = params.userId;
    this._assets = new Map();
    this._sources = new Set(params.sources || []);
    this._lastUpdated = params.lastUpdated || new Date();

    if (params.assets) {
      params.assets.forEach(asset => {
        this.addAsset(asset);
      });
    }
  }

  get id(): string {
    return this._id;
  }

  get userId(): string | undefined {
    return this._userId;
  }

  get assets(): AssetEntity[] {
    return Array.from(this._assets.values());
  }

  get sources(): IntegrationSource[] {
    return Array.from(this._sources);
  }

  get lastUpdated(): Date {
    return this._lastUpdated;
  }

  addAsset(asset: AssetEntity): void {
    const existingAsset = this.findSimilarAsset(asset);
    
    if (existingAsset) {
      const merged = existingAsset.merge(asset);
      this._assets.set(merged.id, merged);
    } else {
      this._assets.set(asset.id, asset);
    }
    
    this._lastUpdated = new Date();
  }

  removeAsset(assetId: string): void {
    if (this._assets.delete(assetId)) {
      this._lastUpdated = new Date();
    }
  }

  addSource(source: IntegrationSource): void {
    this._sources.add(source);
    this._lastUpdated = new Date();
  }

  private findSimilarAsset(asset: AssetEntity): AssetEntity | undefined {
    for (const existing of this._assets.values()) {
      if (existing.isSameAsset(asset)) {
        return existing;
      }
    }
    return undefined;
  }

  getTotalValue(currency: string = 'USD'): Money {
    let total = new Money(0, currency);
    
    for (const asset of this._assets.values()) {
      const value = asset.getValue();
      if (value && value.currency === currency) {
        total = total.add(value);
      }
    }
    
    return total;
  }

  getAssetsByChain(chain: string): AssetEntity[] {
    return this.assets.filter(asset => asset.chain === chain);
  }

  getAssetsByType(type: string): AssetEntity[] {
    return this.assets.filter(asset => asset.type === type);
  }

  mergePortfolio(other: PortfolioAggregate): void {
    for (const asset of other.assets) {
      this.addAsset(asset);
    }
    
    for (const source of other.sources) {
      this.addSource(source);
    }
    
    this._lastUpdated = new Date();
  }

  reconcile(): void {
    const reconciledAssets = new Map<string, AssetEntity>();
    
    for (const asset of this._assets.values()) {
      const key = this.getAssetKey(asset);
      const existing = reconciledAssets.get(key);
      
      if (existing) {
        reconciledAssets.set(key, existing.merge(asset));
      } else {
        reconciledAssets.set(key, asset);
      }
    }
    
    this._assets = reconciledAssets;
    this._lastUpdated = new Date();
  }

  private getAssetKey(asset: AssetEntity): string {
    if (asset.contractAddress && asset.chain) {
      return `${asset.chain}:${asset.contractAddress}`;
    }
    return `${asset.chain || 'global'}:${asset.symbol}:${asset.type}`;
  }

  isEmpty(): boolean {
    return this._assets.size === 0;
  }

  clear(): void {
    this._assets.clear();
    this._sources.clear();
    this._lastUpdated = new Date();
  }

  toJSON() {
    const totalValue = this.getTotalValue();
    
    return {
      id: this._id,
      userId: this._userId,
      assets: this.assets.map(a => a.toJSON()),
      totalValue: {
        value: totalValue.amount,
        currency: totalValue.currency,
        timestamp: this._lastUpdated
      } as Price,
      lastUpdated: this._lastUpdated,
      sources: this.sources
    };
  }
}