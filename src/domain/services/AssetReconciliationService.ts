import { AssetEntity } from '../entities/Asset';

/**
 * Domain service for asset reconciliation and deduplication
 */
export class AssetReconciliationService {
  /**
   * Reconcile a list of assets, merging duplicates
   */
  reconcile(assets: AssetEntity[]): AssetEntity[] {
    const reconciled = new Map<string, AssetEntity>();
    
    for (const asset of assets) {
      const key = this.generateAssetKey(asset);
      const existing = reconciled.get(key);
      
      if (existing) {
        // Merge with existing asset
        const merged = this.mergeAssets(existing, asset);
        reconciled.set(key, merged);
      } else {
        // Add new asset
        reconciled.set(key, asset);
      }
    }
    
    return Array.from(reconciled.values());
  }
  
  /**
   * Check if two assets are the same
   */
  isSameAsset(asset1: AssetEntity, asset2: AssetEntity): boolean {
    // Same symbol and chain
    if (asset1.symbol === asset2.symbol && asset1.chain === asset2.chain) {
      // If both have contract addresses, they must match
      if (asset1.contractAddress && asset2.contractAddress) {
        return asset1.contractAddress.toLowerCase() === asset2.contractAddress.toLowerCase();
      }
      // If neither has contract address (native tokens), they're the same
      if (!asset1.contractAddress && !asset2.contractAddress) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Merge two assets according to reconciliation rules
   */
  mergeAssets(asset1: AssetEntity, asset2: AssetEntity): AssetEntity {
    if (!this.isSameAsset(asset1, asset2)) {
      throw new Error('Cannot merge different assets');
    }
    
    // Reconciliation rules from architecture:
    // 1. Prefer on-chain data over CEX data
    // 2. Use most recently updated source for pricing
    // 3. Sum quantities across sources for total holdings
    
    const preferredAsset = this.selectPreferredSource(asset1, asset2);
    const otherAsset = preferredAsset === asset1 ? asset2 : asset1;
    
    // Sum balances
    const totalBalance = {
      amount: asset1.balance.amount + asset2.balance.amount,
      decimals: preferredAsset.balance.decimals,
      formatted: this.formatBalance(
        asset1.balance.amount + asset2.balance.amount,
        preferredAsset.balance.decimals
      )
    };
    
    // Use most recent price
    const price = this.selectMostRecentPrice(asset1, asset2);
    
    // Create merged asset with all required properties
    return new AssetEntity({
      id: preferredAsset.id,
      symbol: preferredAsset.symbol,
      name: preferredAsset.name,
      type: preferredAsset.type,
      chain: preferredAsset.chain,
      balance: totalBalance,
      price: price,
      contractAddress: preferredAsset.contractAddress,
      imageUrl: preferredAsset.imageUrl,
      metadata: {
        ...preferredAsset.metadata,
        mergedFrom: [
          ...(preferredAsset.metadata?.mergedFrom || []),
          ...(otherAsset.metadata?.mergedFrom || []),
          otherAsset.metadata?.source
        ].filter(Boolean)
      }
    });
  }
  
  /**
   * Select preferred asset based on source priority
   */
  private selectPreferredSource(asset1: AssetEntity, asset2: AssetEntity): AssetEntity {
    const sourcePriority = {
      'on-chain': 1,
      'blockchain': 1,
      'dex': 2,
      'cex': 3,
      'manual': 4
    };
    
    const priority1 = sourcePriority[asset1.metadata?.sourceType || 'manual'] || 999;
    const priority2 = sourcePriority[asset2.metadata?.sourceType || 'manual'] || 999;
    
    return priority1 <= priority2 ? asset1 : asset2;
  }
  
  /**
   * Select most recent price
   */
  private selectMostRecentPrice(asset1: AssetEntity, asset2: AssetEntity): AssetEntity['price'] {
    if (!asset1.price && !asset2.price) return undefined;
    if (!asset1.price) return asset2.price;
    if (!asset2.price) return asset1.price;
    
    const time1 = asset1.metadata?.fetchedAt ? new Date(asset1.metadata.fetchedAt).getTime() : 0;
    const time2 = asset2.metadata?.fetchedAt ? new Date(asset2.metadata.fetchedAt).getTime() : 0;
    
    return time1 >= time2 ? asset1.price : asset2.price;
  }
  
  /**
   * Generate unique key for asset identification
   */
  private generateAssetKey(asset: AssetEntity): string {
    const chain = asset.chain || 'unknown';
    const symbol = asset.symbol.toUpperCase();
    const contract = asset.contractAddress?.toLowerCase() || 'native';
    
    return `${chain}:${symbol}:${contract}`;
  }
  
  /**
   * Format balance with proper decimals
   */
  private formatBalance(amount: number, decimals: number): string {
    return amount.toFixed(decimals);
  }
}