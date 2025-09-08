import { IPortfolioRepository } from '../../contracts/repositories/IPortfolioRepository';
import { PortfolioAggregate } from '../../domain/aggregates/Portfolio';

/**
 * In-memory portfolio repository for testing
 */
export class InMemoryPortfolioRepository implements IPortfolioRepository {
  private portfolios: Map<string, PortfolioAggregate> = new Map();
  private cacheKeys: Map<string, string> = new Map();

  async save(portfolio: PortfolioAggregate): Promise<void> {
    this.portfolios.set(portfolio.id, portfolio);
  }

  async findById(id: string): Promise<PortfolioAggregate | null> {
    return this.portfolios.get(id) || null;
  }

  async findByUserId(userId: string): Promise<PortfolioAggregate[]> {
    const results: PortfolioAggregate[] = [];
    for (const portfolio of this.portfolios.values()) {
      if (portfolio.userId === userId) {
        results.push(portfolio);
      }
    }
    return results;
  }

  async delete(id: string): Promise<void> {
    this.portfolios.delete(id);
    // Remove associated cache keys
    for (const [key, portfolioId] of this.cacheKeys) {
      if (portfolioId === id) {
        this.cacheKeys.delete(key);
      }
    }
  }

  getCacheKey(params: { sources?: string[]; addresses?: Map<string, string[]>; userId?: string }): string {
    const sources = params.sources?.sort().join(',') || '';
    const addresses = Array.from(params.addresses?.entries() || [])
      .map(([chain, addrs]) => `${chain}:${addrs.sort().join(',')}`)
      .sort()
      .join(';');
    const userId = params.userId || 'anonymous';
    
    return `portfolio:${userId}:${sources}:${addresses}`;
  }

  isCacheValid(portfolio: PortfolioAggregate, ttl: number): boolean {
    const age = Date.now() - portfolio.lastUpdated.getTime();
    return age < ttl;
  }

  async invalidateCache(pattern?: string): Promise<void> {
    if (pattern) {
      // Remove cache entries matching pattern
      for (const key of this.cacheKeys.keys()) {
        if (key.includes(pattern)) {
          const portfolioId = this.cacheKeys.get(key);
          if (portfolioId) {
            this.portfolios.delete(portfolioId);
          }
          this.cacheKeys.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.portfolios.clear();
      this.cacheKeys.clear();
    }
  }

  /**
   * Get all portfolios (for testing)
   */
  getAllPortfolios(): PortfolioAggregate[] {
    return Array.from(this.portfolios.values());
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.portfolios.clear();
    this.cacheKeys.clear();
  }
}