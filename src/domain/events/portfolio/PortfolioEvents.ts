import { BaseDomainEvent, DomainEventType } from '../DomainEvent';
import { IntegrationSource } from '../../../shared/types';
import { PortfolioAggregate } from '../../aggregates/Portfolio';

/**
 * Portfolio aggregation started event
 */
export class PortfolioAggregationStartedEvent extends BaseDomainEvent {
  readonly payload: {
    portfolioId: string;
    userId?: string;
    sources: IntegrationSource[];
    addresses: Map<string, string[]>;
  };

  constructor(payload: {
    portfolioId: string;
    userId?: string;
    sources: IntegrationSource[];
    addresses: Map<string, string[]>;
  }) {
    super(DomainEventType.PORTFOLIO_AGGREGATION_STARTED, payload.portfolioId);
    this.payload = payload;
  }
}

/**
 * Portfolio aggregation completed event
 */
export class PortfolioAggregationCompletedEvent extends BaseDomainEvent {
  readonly payload: {
    portfolio: PortfolioAggregate;
    totalValue: number;
    assetCount: number;
    duration: number;
  };

  constructor(payload: {
    portfolio: PortfolioAggregate;
    totalValue: number;
    assetCount: number;
    duration: number;
  }) {
    super(DomainEventType.PORTFOLIO_AGGREGATION_COMPLETED, payload.portfolio.id);
    this.payload = payload;
  }
}

/**
 * Portfolio aggregation failed event
 */
export class PortfolioAggregationFailedEvent extends BaseDomainEvent {
  readonly payload: {
    portfolioId: string;
    error: Error;
    failedSources: IntegrationSource[];
    partialResult?: PortfolioAggregate;
  };

  constructor(payload: {
    portfolioId: string;
    error: Error;
    failedSources: IntegrationSource[];
    partialResult?: PortfolioAggregate;
  }) {
    super(DomainEventType.PORTFOLIO_AGGREGATION_FAILED, payload.portfolioId);
    this.payload = payload;
  }
}

/**
 * Portfolio reconciliation started event
 */
export class PortfolioReconciliationStartedEvent extends BaseDomainEvent {
  readonly payload: {
    portfolioId: string;
    assetCount: number;
  };

  constructor(payload: {
    portfolioId: string;
    assetCount: number;
  }) {
    super(DomainEventType.PORTFOLIO_RECONCILIATION_STARTED, payload.portfolioId);
    this.payload = payload;
  }
}

/**
 * Portfolio reconciliation completed event
 */
export class PortfolioReconciliationCompletedEvent extends BaseDomainEvent {
  readonly payload: {
    portfolioId: string;
    mergedCount: number;
    finalAssetCount: number;
  };

  constructor(payload: {
    portfolioId: string;
    mergedCount: number;
    finalAssetCount: number;
  }) {
    super(DomainEventType.PORTFOLIO_RECONCILIATION_COMPLETED, payload.portfolioId);
    this.payload = payload;
  }
}