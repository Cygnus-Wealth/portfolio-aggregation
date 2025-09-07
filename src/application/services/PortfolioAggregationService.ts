import { PortfolioAggregate } from '../../domain/aggregates/Portfolio';
import { AssetEntity } from '../../domain/entities/Asset';
import type { IIntegrationRepository } from '../../contracts/repositories/IIntegrationRepository';
import type { IPortfolioRepository } from '../../contracts/repositories/IPortfolioRepository';
import type { IAssetValuatorRepository } from '../../contracts/repositories/IAssetValuatorRepository';
import { IntegrationSource } from '../../shared/types';

export interface AggregationOptions {
  sources?: IntegrationSource[];
  addresses: Map<string, string[]>; // chain -> addresses
  userId?: string;
  forceRefresh?: boolean;
}

export class PortfolioAggregationService {
  private integrations: Map<IntegrationSource, IIntegrationRepository>;
  private portfolioRepository: IPortfolioRepository;
  private assetValuator: IAssetValuatorRepository;

  constructor(
    integrations: Map<IntegrationSource, IIntegrationRepository>,
    portfolioRepository: IPortfolioRepository,
    assetValuator: IAssetValuatorRepository
  ) {
    this.integrations = integrations;
    this.portfolioRepository = portfolioRepository;
    this.assetValuator = assetValuator;
  }

  async aggregatePortfolio(options: AggregationOptions): Promise<PortfolioAggregate> {
    const portfolioId = this.generatePortfolioId(options.userId);
    
    // Check cache if not forcing refresh
    if (!options.forceRefresh) {
      const cached = await this.portfolioRepository.findById(portfolioId);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }
    }

    // Create new portfolio aggregate
    const portfolio = new PortfolioAggregate({
      id: portfolioId,
      userId: options.userId
    });

    // Determine which sources to use
    const sourcesToFetch = options.sources || Array.from(this.integrations.keys());

    // Fetch from all sources in parallel
    const fetchPromises = sourcesToFetch.map(source => 
      this.fetchFromSource(source, options.addresses)
    );

    try {
      const results = await Promise.allSettled(fetchPromises);
      
      // Process successful fetches
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const source = sourcesToFetch[i];
        
        if (result.status === 'fulfilled' && result.value) {
          const assets = result.value;
          portfolio.addSource(source);
          
          for (const asset of assets) {
            portfolio.addAsset(asset);
          }
        } else if (result.status === 'rejected') {
          console.error(`Failed to fetch from ${source}:`, result.reason);
        }
      }

      // Reconcile duplicates
      portfolio.reconcile();

      // Enrich with prices
      await this.enrichWithPrices(portfolio);

      // Save to repository
      await this.portfolioRepository.save(portfolio);

      return portfolio;
    } catch (error) {
      console.error('Portfolio aggregation failed:', error);
      throw error;
    }
  }

  private async fetchFromSource(
    source: IntegrationSource,
    addresses: Map<string, string[]>
  ): Promise<AssetEntity[]> {
    const integration = this.integrations.get(source);
    if (!integration) {
      throw new Error(`Integration not found: ${source}`);
    }

    if (!integration.isConnected()) {
      await integration.connect();
    }

    // Get relevant addresses for this source
    const relevantAddresses = this.getRelevantAddresses(source, addresses);
    
    if (relevantAddresses.length === 0) {
      return [];
    }

    const assets = await integration.fetchAssets(relevantAddresses);
    
    return assets.map(a => new AssetEntity({
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      type: a.type,
      chain: a.chain,
      balance: a.balance,
      price: a.price,
      contractAddress: a.contractAddress,
      imageUrl: a.imageUrl,
      metadata: a.metadata
    }));
  }

  private getRelevantAddresses(
    source: IntegrationSource,
    addresses: Map<string, string[]>
  ): string[] {
    const result: string[] = [];
    
    switch (source) {
      case IntegrationSource.EVM:
        // Get all EVM-compatible chain addresses
        for (const [chain, addrs] of addresses) {
          if (['ethereum', 'polygon', 'arbitrum', 'optimism', 'binance'].includes(chain)) {
            result.push(...addrs);
          }
        }
        break;
      case IntegrationSource.SOLANA:
        result.push(...(addresses.get('solana') || []));
        break;
      case IntegrationSource.ROBINHOOD:
        // Robinhood doesn't use addresses
        result.push('default');
        break;
    }
    
    // Remove duplicates
    return [...new Set(result)];
  }

  private async enrichWithPrices(portfolio: PortfolioAggregate): Promise<void> {
    const assets = portfolio.assets;
    const symbols = [...new Set(assets.map(a => a.symbol))];
    
    if (symbols.length === 0) return;
    
    try {
      const prices = await this.assetValuator.getBatchPrices(symbols);
      
      for (const asset of assets) {
        const price = prices.get(asset.symbol);
        if (price) {
          asset.updatePrice(price);
        }
      }
    } catch (error) {
      console.error('Failed to enrich with prices:', error);
    }
  }

  private isCacheValid(portfolio: PortfolioAggregate): boolean {
    const cacheTimeout = 5 * 60 * 1000; // 5 minutes
    const age = Date.now() - portfolio.lastUpdated.getTime();
    return age < cacheTimeout;
  }

  private generatePortfolioId(userId?: string): string {
    if (userId) {
      return `portfolio_${userId}`;
    }
    return `portfolio_${Date.now()}`;
  }

  async refreshPortfolio(portfolioId: string): Promise<PortfolioAggregate> {
    const existing = await this.portfolioRepository.findById(portfolioId);
    if (!existing) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }

    // Extract addresses from existing portfolio
    const addresses = this.extractAddresses(existing);
    
    return this.aggregatePortfolio({
      sources: existing.sources,
      addresses,
      userId: existing.userId,
      forceRefresh: true
    });
  }

  private extractAddresses(portfolio: PortfolioAggregate): Map<string, string[]> {
    const addresses = new Map<string, string[]>();
    
    // This is simplified - in real implementation, you'd track addresses properly
    for (const asset of portfolio.assets) {
      if (asset.chain) {
        const chainAddresses = addresses.get(asset.chain) || [];
        addresses.set(asset.chain, chainAddresses);
      }
    }
    
    return addresses;
  }
}