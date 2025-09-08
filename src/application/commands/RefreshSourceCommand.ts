import type { ICommand } from './Command';
import { IntegrationSource } from '../../shared/types';
import { AssetEntity } from '../../domain/entities/Asset';

/**
 * Command to refresh data from a specific integration source
 */
export class RefreshSourceCommand implements ICommand<RefreshSourceResult> {
  readonly source: IntegrationSource;
  readonly addresses: string[];
  readonly portfolioId?: string;

  constructor(
    source: IntegrationSource,
    addresses: string[],
    portfolioId?: string
  ) {
    this.source = source;
    this.addresses = addresses;
    this.portfolioId = portfolioId;
  }

  async execute(): Promise<RefreshSourceResult> {
    // Execution delegated to handler
    throw new Error('Command must be executed through CommandBus');
  }
}

/**
 * Result of source refresh
 */
export interface RefreshSourceResult {
  source: IntegrationSource;
  assets: AssetEntity[];
  success: boolean;
  error?: Error;
  duration: number;
}