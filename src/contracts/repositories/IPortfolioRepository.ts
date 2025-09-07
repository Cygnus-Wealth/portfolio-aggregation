import { PortfolioAggregate } from '../../domain/aggregates/Portfolio';

export interface IPortfolioRepository {
  save(portfolio: PortfolioAggregate): Promise<void>;
  findById(id: string): Promise<PortfolioAggregate | null>;
  findByUserId(userId: string): Promise<PortfolioAggregate[]>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}