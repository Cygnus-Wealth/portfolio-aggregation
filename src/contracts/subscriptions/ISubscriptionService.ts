import type { Chain } from '../../shared/types';

/**
 * Status of a subscription connection
 */
export const SubscriptionStatus = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
} as const;

export type SubscriptionStatus = typeof SubscriptionStatus[keyof typeof SubscriptionStatus];

/**
 * Chain-specific raw subscription event from integration services.
 * Each integration (evm, sol) emits events in its own format;
 * the SubscriptionOrchestrator normalizes them.
 */
export interface ChainSubscriptionEvent {
  chain: Chain;
  address: string;
  eventType: string;
  data: unknown;
  timestamp: Date;
}

/**
 * Callback for chain subscription events
 */
export type ChainEventCallback = (event: ChainSubscriptionEvent) => void;

/**
 * Interface expected from evm-integration and sol-integration SubscriptionServices.
 * These are being built in parallel — implement against this contract and mock in tests.
 */
export interface ISubscriptionService {
  subscribe(addresses: string[], callback: ChainEventCallback): () => void;
  getStatus(): SubscriptionStatus;
  getChain(): Chain;
}

/**
 * Normalized portfolio update event emitted by the SubscriptionOrchestrator
 */
export interface PortfolioUpdateEvent {
  chain: Chain;
  address: string;
  assetId?: string;
  updateType: 'balance_change' | 'price_change' | 'new_asset' | 'removed_asset';
  timestamp: Date;
}

/**
 * Handle returned by subscribeToLiveUpdates() for managing the subscription
 */
export interface LiveSubscriptionHandle {
  unsubscribe: () => void;
  isActive: () => boolean;
}
