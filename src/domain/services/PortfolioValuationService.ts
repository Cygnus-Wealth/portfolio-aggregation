import { PortfolioAggregate } from '../aggregates/Portfolio';
import { AssetEntity } from '../entities/Asset';
import { Money } from '../value-objects/Money';

/**
 * Domain service for portfolio valuation calculations
 */
export class PortfolioValuationService {
  /**
   * Calculate total portfolio value
   */
  calculateTotalValue(portfolio: PortfolioAggregate, currency: string = 'USD'): Money {
    let totalValue = 0;
    
    for (const asset of portfolio.assets) {
      const assetValue = this.calculateAssetValue(asset, currency);
      totalValue += assetValue.amount;
    }
    
    return new Money(totalValue, currency);
  }
  
  /**
   * Calculate value of a single asset
   */
  calculateAssetValue(asset: AssetEntity, currency: string = 'USD'): Money {
    if (!asset.price) {
      return new Money(0, currency);
    }
    
    // Check if price is in requested currency
    if (asset.price.currency !== currency) {
      // In a real implementation, this would convert currencies
      console.warn(`Currency conversion needed from ${asset.price.currency} to ${currency}`);
    }
    
    const value = asset.balance.amount * asset.price.value;
    return new Money(value, currency);
  }
  
  /**
   * Calculate portfolio allocation percentages
   */
  calculateAllocations(portfolio: PortfolioAggregate): Map<string, number> {
    const totalValue = this.calculateTotalValue(portfolio);
    const allocations = new Map<string, number>();
    
    if (totalValue.amount === 0) {
      return allocations;
    }
    
    for (const asset of portfolio.assets) {
      const assetValue = this.calculateAssetValue(asset, totalValue.currency);
      const percentage = (assetValue.amount / totalValue.amount) * 100;
      allocations.set(asset.symbol, percentage);
    }
    
    return allocations;
  }
  
  /**
   * Calculate portfolio performance metrics
   */
  calculatePerformanceMetrics(
    portfolio: PortfolioAggregate,
    historicalData?: Map<string, number>
  ): PortfolioMetrics {
    const currentValue = this.calculateTotalValue(portfolio);
    const assetCount = portfolio.assets.length;
    const uniqueChains = new Set(portfolio.assets.map(a => a.chain).filter(Boolean)).size;
    
    // Calculate 24h change if historical data provided
    let change24h = 0;
    let changePercentage24h = 0;
    
    if (historicalData) {
      for (const asset of portfolio.assets) {
        const historicalPrice = historicalData.get(asset.symbol);
        if (historicalPrice && asset.price) {
          const oldValue = asset.balance.amount * historicalPrice;
          const newValue = asset.balance.amount * asset.price.value;
          change24h += (newValue - oldValue);
        }
      }
      
      if (currentValue.amount > 0) {
        changePercentage24h = (change24h / (currentValue.amount - change24h)) * 100;
      }
    }
    
    return {
      totalValue: currentValue,
      assetCount,
      uniqueChains,
      change24h: new Money(change24h, currentValue.currency),
      changePercentage24h,
      lastUpdated: portfolio.lastUpdated
    };
  }
  
  /**
   * Identify top holdings by value
   */
  getTopHoldings(portfolio: PortfolioAggregate, limit: number = 10): AssetEntity[] {
    const assetsWithValue = portfolio.assets.map(asset => ({
      asset,
      value: this.calculateAssetValue(asset).amount
    }));
    
    assetsWithValue.sort((a, b) => b.value - a.value);
    
    return assetsWithValue
      .slice(0, limit)
      .map(item => item.asset);
  }
  
  /**
   * Group assets by chain
   */
  groupByChain(portfolio: PortfolioAggregate): Map<string, AssetEntity[]> {
    const grouped = new Map<string, AssetEntity[]>();
    
    for (const asset of portfolio.assets) {
      const chain = asset.chain || 'unknown';
      const chainAssets = grouped.get(chain) || [];
      chainAssets.push(asset);
      grouped.set(chain, chainAssets);
    }
    
    return grouped;
  }
  
  /**
   * Calculate chain-specific values
   */
  calculateChainValues(portfolio: PortfolioAggregate): Map<string, Money> {
    const chainValues = new Map<string, Money>();
    const grouped = this.groupByChain(portfolio);
    
    for (const [chain, assets] of grouped) {
      let chainTotal = 0;
      for (const asset of assets) {
        const value = this.calculateAssetValue(asset);
        chainTotal += value.amount;
      }
      chainValues.set(chain, new Money(chainTotal, 'USD'));
    }
    
    return chainValues;
  }
}

/**
 * Portfolio performance metrics
 */
export interface PortfolioMetrics {
  totalValue: Money;
  assetCount: number;
  uniqueChains: number;
  change24h: Money;
  changePercentage24h: number;
  lastUpdated: Date;
}