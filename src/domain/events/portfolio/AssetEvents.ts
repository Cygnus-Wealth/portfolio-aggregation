import { BaseDomainEvent, DomainEventType } from '../DomainEvent';
import { AssetEntity } from '../../entities/Asset';

/**
 * Asset added to portfolio event
 */
export class AssetAddedToPortfolioEvent extends BaseDomainEvent {
  readonly payload: {
    portfolioId: string;
    asset: AssetEntity;
  };

  constructor(payload: {
    portfolioId: string;
    asset: AssetEntity;
  }) {
    super(DomainEventType.ASSET_ADDED_TO_PORTFOLIO, payload.portfolioId);
    this.payload = payload;
  }
}

/**
 * Asset merged event
 */
export class AssetMergedEvent extends BaseDomainEvent {
  readonly payload: {
    portfolioId: string;
    originalAsset: AssetEntity;
    mergedAsset: AssetEntity;
    resultingAsset: AssetEntity;
  };

  constructor(payload: {
    portfolioId: string;
    originalAsset: AssetEntity;
    mergedAsset: AssetEntity;
    resultingAsset: AssetEntity;
  }) {
    super(DomainEventType.ASSET_MERGED, payload.portfolioId);
    this.payload = payload;
  }
}

/**
 * Asset price updated event
 */
export class AssetPriceUpdatedEvent extends BaseDomainEvent {
  readonly payload: {
    portfolioId: string;
    assetId: string;
    symbol: string;
    oldPrice?: number;
    newPrice: number;
    currency: string;
  };

  constructor(payload: {
    portfolioId: string;
    assetId: string;
    symbol: string;
    oldPrice?: number;
    newPrice: number;
    currency: string;
  }) {
    super(DomainEventType.ASSET_PRICE_UPDATED, payload.portfolioId);
    this.payload = payload;
  }
}