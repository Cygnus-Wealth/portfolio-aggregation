import { PortfolioAggregate } from '../../domain/aggregates/Portfolio';
import { AssetEntity } from '../../domain/entities/Asset';
import type { IIntegrationRepository } from '../../contracts/repositories/IIntegrationRepository';
import type { IPortfolioRepository } from '../../contracts/repositories/IPortfolioRepository';
import type { IAssetValuatorRepository } from '../../contracts/repositories/IAssetValuatorRepository';
import { IntegrationSource } from '../../shared/types';
import type { DeFiPosition } from '../../shared/types';
import { ChainFamilyRouter, ChainFamily } from '../../domain/services/ChainFamilyRouter';

export interface AggregationOptions {
  sources?: IntegrationSource[];
  addresses: Map<string, string[]>; // chain -> addresses
  userId?: string;
  forceRefresh?: boolean;
}

export interface DeFiAggregationResult {
  positions: DeFiPosition[];
  failedSources: { source: IntegrationSource; error: string }[];
  receiptTokenAddresses: Set<string>;
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

    // Scatter: Fetch assets and DeFi positions from all sources in parallel
    const assetFetchPromises = sourcesToFetch.map(source =>
      this.fetchFromSource(source, options.addresses)
    );
    const defiFetchPromises = sourcesToFetch.map(source =>
      this.fetchDeFiFromSource(source, options.addresses)
    );

    try {
      const [assetResults, defiResults] = await Promise.all([
        Promise.allSettled(assetFetchPromises),
        Promise.allSettled(defiFetchPromises)
      ]);

      // Gather: Process asset results
      for (let i = 0; i < assetResults.length; i++) {
        const result = assetResults[i];
        const source = sourcesToFetch[i];

        if (result.status === 'fulfilled' && result.value) {
          const assets = result.value;
          portfolio.addSource(source);

          for (const asset of assets) {
            portfolio.addAsset(asset);
          }
        } else if (result.status === 'rejected') {
          console.error(`Failed to fetch assets from ${source}:`, result.reason);
        }
      }

      // Gather: Process DeFi results with deduplication
      const defiAggregation = this.processDeFiResults(defiResults, sourcesToFetch);

      for (const position of defiAggregation.positions) {
        portfolio.addDeFiPosition(position);
      }

      // Coordinate: filter receipt tokens to prevent double-counting
      portfolio.filterReceiptTokens(defiAggregation.receiptTokenAddresses);

      // Reconcile duplicates
      portfolio.reconcile();

      // Enrich with prices (assets + DeFi underlying assets)
      await this.enrichWithPrices(portfolio);
      await this.enrichDeFiWithPrices(portfolio);

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
    // Robinhood doesn't use blockchain addresses
    if (source === IntegrationSource.ROBINHOOD) {
      return ['default'];
    }

    // Route by chain family: find which family maps to this integration source
    const groupedByFamily = ChainFamilyRouter.groupAddressesByFamily(addresses);

    const result: string[] = [];
    for (const [family, addrs] of groupedByFamily) {
      if (ChainFamilyRouter.familyToIntegrationSource(family) === source) {
        result.push(...addrs);
      }
    }

    return [...new Set(result)];
  }

  private async fetchDeFiFromSource(
    source: IntegrationSource,
    addresses: Map<string, string[]>
  ): Promise<DeFiPosition[]> {
    const integration = this.integrations.get(source);
    if (!integration || !integration.getDeFiPositions) {
      return [];
    }

    if (!integration.isConnected()) {
      await integration.connect();
    }

    const relevantAddresses = this.getRelevantAddresses(source, addresses);
    if (relevantAddresses.length === 0) {
      return [];
    }

    return integration.getDeFiPositions(relevantAddresses);
  }

  private processDeFiResults(
    results: PromiseSettledResult<DeFiPosition[]>[],
    sources: IntegrationSource[]
  ): DeFiAggregationResult {
    const seen = new Map<string, DeFiPosition>();
    const failedSources: { source: IntegrationSource; error: string }[] = [];
    const receiptTokenAddresses = new Set<string>();

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const source = sources[i];

      if (result.status === 'fulfilled' && result.value) {
        for (const position of result.value) {
          // Deduplicate by deduplicationKey — first-seen wins
          if (!seen.has(position.deduplicationKey)) {
            seen.set(position.deduplicationKey, position);
          }
          // Collect receipt token addresses
          if (position.receiptTokenAddress) {
            receiptTokenAddresses.add(position.receiptTokenAddress.toLowerCase());
          }
        }
      } else if (result.status === 'rejected') {
        console.error(`Failed to fetch DeFi from ${source}:`, result.reason);
        failedSources.push({
          source,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        });
      }
    }

    return {
      positions: Array.from(seen.values()),
      failedSources,
      receiptTokenAddresses
    };
  }

  private async enrichDeFiWithPrices(portfolio: PortfolioAggregate): Promise<void> {
    const positions = portfolio.defiPositions;
    const symbols = new Set<string>();

    for (const position of positions) {
      for (const underlying of position.underlyingAssets) {
        symbols.add(underlying.symbol);
      }
    }

    if (symbols.size === 0) return;

    try {
      const prices = await this.assetValuator.getBatchPrices([...symbols]);

      for (const position of positions) {
        if (position.value) continue; // Already priced

        let totalValue = 0;
        for (const underlying of position.underlyingAssets) {
          const price = prices.get(underlying.symbol);
          if (price) {
            totalValue += underlying.amount * price.value;
          }
        }

        if (totalValue > 0) {
          position.value = {
            value: totalValue,
            currency: 'USD',
            timestamp: new Date()
          };
        }
      }
    } catch (error) {
      console.error('Failed to enrich DeFi with prices:', error);
    }
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