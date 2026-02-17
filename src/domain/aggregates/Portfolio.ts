import { IntegrationSource, DeFiPositionType } from '../../shared/types';
import type { Price, DeFiPosition } from '../../shared/types';
import { AssetEntity } from '../entities/Asset';
import { Money } from '../value-objects/Money';

export class PortfolioAggregate {
  private _id: string;
  private _userId?: string;
  private _assets: Map<string, AssetEntity>;
  private _defiPositions: Map<string, DeFiPosition>;
  private _sources: Set<IntegrationSource>;
  private _lastUpdated: Date;

  constructor(params: {
    id: string;
    userId?: string;
    assets?: AssetEntity[];
    defiPositions?: DeFiPosition[];
    sources?: IntegrationSource[];
    lastUpdated?: Date;
  }) {
    this._id = params.id;
    this._userId = params.userId;
    this._assets = new Map();
    this._defiPositions = new Map();
    this._sources = new Set(params.sources || []);
    this._lastUpdated = params.lastUpdated || new Date();

    if (params.assets) {
      params.assets.forEach(asset => {
        this.addAsset(asset);
      });
    }

    if (params.defiPositions) {
      params.defiPositions.forEach(position => {
        this.addDeFiPosition(position);
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

  get defiPositions(): DeFiPosition[] {
    return Array.from(this._defiPositions.values());
  }

  addDeFiPosition(position: DeFiPosition): void {
    const existing = this._defiPositions.get(position.deduplicationKey);
    if (!existing) {
      this._defiPositions.set(position.deduplicationKey, position);
    }
    // Duplicate by deduplicationKey — first-seen wins
    this._lastUpdated = new Date();
  }

  removeDeFiPosition(deduplicationKey: string): void {
    if (this._defiPositions.delete(deduplicationKey)) {
      this._lastUpdated = new Date();
    }
  }

  filterReceiptTokens(receiptTokenAddresses: Set<string>): void {
    for (const [id, asset] of this._assets) {
      if (asset.contractAddress && receiptTokenAddresses.has(asset.contractAddress.toLowerCase())) {
        this._assets.delete(id);
      }
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
    let totalAmount = 0;

    for (const asset of this._assets.values()) {
      const value = asset.getValue();
      if (value && value.currency === currency) {
        totalAmount += value.amount;
      }
    }

    totalAmount += this.getDeFiNetValue(currency);

    return new Money(Math.max(0, totalAmount), currency);
  }

  getDeFiNetValue(currency: string = 'USD'): number {
    let net = 0;
    for (const position of this._defiPositions.values()) {
      if (!position.value || position.value.currency !== currency) continue;
      if (position.type === DeFiPositionType.LENDING_BORROW) {
        net -= position.value.value;
      } else {
        net += position.value.value;
      }
    }
    return net;
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

    for (const position of other.defiPositions) {
      this.addDeFiPosition(position);
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
    return this._assets.size === 0 && this._defiPositions.size === 0;
  }

  clear(): void {
    this._assets.clear();
    this._defiPositions.clear();
    this._sources.clear();
    this._lastUpdated = new Date();
  }

  toJSON() {
    const totalValue = this.getTotalValue();

    return {
      id: this._id,
      userId: this._userId,
      assets: this.assets.map(a => a.toJSON()),
      defiPositions: this.defiPositions,
      defiNetValue: this.getDeFiNetValue(),
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