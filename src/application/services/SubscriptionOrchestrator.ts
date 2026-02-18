import { Chain } from '../../shared/types';
import type {
  ISubscriptionService,
  ChainSubscriptionEvent,
  PortfolioUpdateEvent,
  LiveSubscriptionHandle,
  SubscriptionStatus,
} from '../../contracts/subscriptions/ISubscriptionService';

type UpdateCallback = (event: PortfolioUpdateEvent) => void;

/**
 * Debounce windows per chain (ms).
 * Ethereum/L2s have 12s+ block times so no debounce needed.
 * Solana has fast block times — debounce 2s.
 * Polygon has 2s blocks — debounce 5s.
 */
const DEBOUNCE_MS: Partial<Record<Chain, number>> = {
  [Chain.SOLANA]: 2000,
  [Chain.POLYGON]: 5000,
};

const DEDUP_WINDOW_MS = 500;

interface PendingEvent {
  event: PortfolioUpdateEvent;
  timer: ReturnType<typeof setTimeout>;
}

interface Subscription {
  id: number;
  addresses: Map<Chain, string[]>;
  callback: UpdateCallback;
  chainUnsubscribers: Array<() => void>;
  active: boolean;
}

export class SubscriptionOrchestrator {
  private services: Map<Chain, ISubscriptionService>;
  private subscriptions: Map<number, Subscription> = new Map();
  private nextId = 1;
  private disposed = false;

  // Dedup state: key = `${chain}:${address}`, value = pending event timer
  private dedupTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  // Debounce state: key = `${chain}:${address}`, value = debounce timer
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  // Pending debounced events: key = `${chain}:${address}`
  private debouncedEvents: Map<string, PortfolioUpdateEvent> = new Map();

  constructor(services: Map<Chain, ISubscriptionService>) {
    this.services = services;
  }

  subscribeToAddresses(
    addresses: Map<Chain, string[]>,
    callback: UpdateCallback
  ): LiveSubscriptionHandle {
    const id = this.nextId++;
    const chainUnsubscribers: Array<() => void> = [];

    const subscription: Subscription = {
      id,
      addresses,
      callback,
      chainUnsubscribers,
      active: true,
    };

    this.subscriptions.set(id, subscription);

    // Create chain-level subscriptions
    for (const [chain, addrs] of addresses) {
      const service = this.services.get(chain);
      if (!service) continue;

      const unsub = service.subscribe(addrs, (rawEvent: ChainSubscriptionEvent) => {
        if (this.disposed) return;
        this.handleRawEvent(rawEvent);
      });

      chainUnsubscribers.push(unsub);
    }

    return {
      unsubscribe: () => {
        subscription.active = false;
        for (const unsub of subscription.chainUnsubscribers) {
          unsub();
        }
        subscription.chainUnsubscribers.length = 0;
        this.subscriptions.delete(id);
      },
      isActive: () => subscription.active,
    };
  }

  getConnectionStatus(): Map<Chain, SubscriptionStatus> {
    const result = new Map<Chain, SubscriptionStatus>();
    for (const [chain, service] of this.services) {
      result.set(chain, service.getStatus());
    }
    return result;
  }

  dispose(): void {
    this.disposed = true;

    // Unsubscribe all
    for (const sub of this.subscriptions.values()) {
      sub.active = false;
      for (const unsub of sub.chainUnsubscribers) {
        unsub();
      }
      sub.chainUnsubscribers.length = 0;
    }
    this.subscriptions.clear();

    // Clear all timers
    for (const timer of this.dedupTimers.values()) {
      clearTimeout(timer);
    }
    this.dedupTimers.clear();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.debouncedEvents.clear();
  }

  // -- Internal --

  private handleRawEvent(raw: ChainSubscriptionEvent): void {
    const normalized = this.normalizeEvent(raw);
    const dedupKey = `${normalized.chain}:${normalized.address}`;
    const debounceMs = DEBOUNCE_MS[normalized.chain as Chain];

    if (debounceMs) {
      this.debounceEvent(dedupKey, normalized, debounceMs);
    } else {
      this.deduplicateAndEmit(dedupKey, normalized);
    }
  }

  private normalizeEvent(raw: ChainSubscriptionEvent): PortfolioUpdateEvent {
    return {
      chain: raw.chain,
      address: raw.address,
      updateType: this.mapEventType(raw.eventType),
      timestamp: raw.timestamp,
    };
  }

  private mapEventType(eventType: string): PortfolioUpdateEvent['updateType'] {
    const lower = eventType.toLowerCase();
    if (lower.includes('mint') || lower.includes('new')) return 'new_asset';
    if (lower.includes('burn') || lower.includes('remove')) return 'removed_asset';
    if (lower.includes('price')) return 'price_change';
    return 'balance_change';
  }

  /**
   * Debounce: wait until `debounceMs` of silence before emitting.
   * Each new event resets the timer.
   */
  private debounceEvent(
    key: string,
    event: PortfolioUpdateEvent,
    debounceMs: number
  ): void {
    // Store latest event
    this.debouncedEvents.set(key, event);

    // Clear existing debounce timer
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      const pending = this.debouncedEvents.get(key);
      this.debouncedEvents.delete(key);
      if (pending) {
        this.emitToSubscribers(pending);
      }
    }, debounceMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Dedup: if we already have a pending event for this key within DEDUP_WINDOW_MS,
   * swallow the new event. Otherwise schedule emission after the dedup window.
   */
  private deduplicateAndEmit(key: string, event: PortfolioUpdateEvent): void {
    if (this.dedupTimers.has(key)) {
      // Already have a pending event — deduplicate (swallow)
      return;
    }

    // Schedule emission after dedup window
    const timer = setTimeout(() => {
      this.dedupTimers.delete(key);
      this.emitToSubscribers(event);
    }, DEDUP_WINDOW_MS);

    this.dedupTimers.set(key, timer);
  }

  private emitToSubscribers(event: PortfolioUpdateEvent): void {
    if (this.disposed) return;

    for (const sub of this.subscriptions.values()) {
      if (!sub.active) continue;

      // Only emit to subscribers interested in this chain/address
      const chainAddresses = sub.addresses.get(event.chain as Chain);
      if (chainAddresses && chainAddresses.includes(event.address)) {
        try {
          sub.callback(event);
        } catch {
          // Swallow subscriber errors
        }
      }
    }
  }
}
