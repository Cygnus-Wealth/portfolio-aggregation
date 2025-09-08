import type { ICommand } from './Command';
import { PortfolioAggregate } from '../../domain/aggregates/Portfolio';
import { IntegrationSource } from '../../shared/types';

/**
 * Command to aggregate portfolio from multiple sources
 */
export class AggregatePortfolioCommand implements ICommand<PortfolioAggregate> {
  readonly addresses: Map<string, string[]>;
  readonly sources: IntegrationSource[];
  readonly userId?: string;
  readonly forceRefresh: boolean;

  constructor(
    addresses: Map<string, string[]>,
    sources: IntegrationSource[],
    userId?: string,
    forceRefresh: boolean = false
  ) {
    this.addresses = addresses;
    this.sources = sources;
    this.userId = userId;
    this.forceRefresh = forceRefresh;
  }

  async execute(): Promise<PortfolioAggregate> {
    // Execution delegated to handler
    throw new Error('Command must be executed through CommandBus');
  }
}

/**
 * Result of portfolio aggregation
 */
export interface AggregatePortfolioResult {
  portfolio: PortfolioAggregate;
  successfulSources: IntegrationSource[];
  failedSources: IntegrationSource[];
  errors: Map<IntegrationSource, Error>;
  fromCache: boolean;
}