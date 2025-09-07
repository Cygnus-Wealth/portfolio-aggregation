import type { IPortfolioRepository } from '../../contracts/repositories/IPortfolioRepository';
import { PortfolioAggregate } from '../../domain/aggregates/Portfolio';
import { AssetEntity } from '../../domain/entities/Asset';
import type { AssetType, Chain, IntegrationSource, Balance, Price } from '../../shared/types';

interface SerializedAsset {
  id: string;
  symbol: string;
  name?: string;
  type: AssetType;
  chain?: Chain;
  balance: Balance;
  price?: Price;
  contractAddress?: string;
  imageUrl?: string;
  metadata: Record<string, unknown>;
}

interface SerializedPortfolio {
  id: string;
  userId?: string;
  assets: SerializedAsset[];
  sources: IntegrationSource[];
  lastUpdated: string;
}

export class LocalStoragePortfolioRepository implements IPortfolioRepository {
  private readonly storageKey = 'cygnus_portfolios';

  async save(portfolio: PortfolioAggregate): Promise<void> {
    const portfolios = await this.getAllPortfolios();
    const index = portfolios.findIndex(p => p.id === portfolio.id);
    
    const serialized = this.serialize(portfolio);
    
    if (index >= 0) {
      portfolios[index] = serialized;
    } else {
      portfolios.push(serialized);
    }
    
    localStorage.setItem(this.storageKey, JSON.stringify(portfolios));
  }

  async findById(id: string): Promise<PortfolioAggregate | null> {
    const portfolios = await this.getAllPortfolios();
    const found = portfolios.find(p => p.id === id);
    
    if (!found) return null;
    
    return this.deserialize(found);
  }

  async findByUserId(userId: string): Promise<PortfolioAggregate[]> {
    const portfolios = await this.getAllPortfolios();
    const userPortfolios = portfolios.filter(p => p.userId === userId);
    
    return userPortfolios.map(p => this.deserialize(p));
  }

  async delete(id: string): Promise<void> {
    const portfolios = await this.getAllPortfolios();
    const filtered = portfolios.filter(p => p.id !== id);
    
    localStorage.setItem(this.storageKey, JSON.stringify(filtered));
  }

  async exists(id: string): Promise<boolean> {
    const portfolios = await this.getAllPortfolios();
    return portfolios.some(p => p.id === id);
  }

  private async getAllPortfolios(): Promise<SerializedPortfolio[]> {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  private serialize(portfolio: PortfolioAggregate): SerializedPortfolio {
    return portfolio.toJSON();
  }

  private deserialize(data: SerializedPortfolio): PortfolioAggregate {
    const assets = data.assets.map((a: SerializedAsset) => new AssetEntity({
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

    return new PortfolioAggregate({
      id: data.id,
      userId: data.userId,
      assets,
      sources: data.sources,
      lastUpdated: new Date(data.lastUpdated)
    });
  }
}