import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SubscriptionOrchestrator } from '../../../../application/services/SubscriptionOrchestrator';
import type {
  ISubscriptionService,
  ChainSubscriptionEvent,
  ChainEventCallback,
  PortfolioUpdateEvent
} from '../../../../contracts/subscriptions/ISubscriptionService';
import { SubscriptionStatus } from '../../../../contracts/subscriptions/ISubscriptionService';
import { Chain } from '../../../../shared/types';

// -- Mock helpers --

function createMockSubscriptionService(chain: Chain): ISubscriptionService & {
  simulateEvent: (event: Partial<ChainSubscriptionEvent>) => void;
  _callbacks: Set<ChainEventCallback>;
} {
  const callbacks = new Set<ChainEventCallback>();

  const service: ISubscriptionService & {
    simulateEvent: (event: Partial<ChainSubscriptionEvent>) => void;
    _callbacks: Set<ChainEventCallback>;
  } = {
    _callbacks: callbacks,
    subscribe: vi.fn((_addresses: string[], callback: ChainEventCallback) => {
      callbacks.add(callback);
      return () => { callbacks.delete(callback); };
    }),
    getStatus: vi.fn(() => SubscriptionStatus.CONNECTED),
    getChain: vi.fn(() => chain),
    simulateEvent(partial: Partial<ChainSubscriptionEvent>) {
      const event: ChainSubscriptionEvent = {
        chain,
        address: partial.address || '0xabc',
        eventType: partial.eventType || 'Transfer',
        data: partial.data || {},
        timestamp: partial.timestamp || new Date(),
      };
      for (const cb of callbacks) {
        cb(event);
      }
    }
  };

  return service;
}

describe('SubscriptionOrchestrator', () => {
  let orchestrator: SubscriptionOrchestrator;
  let ethService: ReturnType<typeof createMockSubscriptionService>;
  let polygonService: ReturnType<typeof createMockSubscriptionService>;
  let solService: ReturnType<typeof createMockSubscriptionService>;

  beforeEach(() => {
    vi.useFakeTimers();
    ethService = createMockSubscriptionService(Chain.ETHEREUM);
    polygonService = createMockSubscriptionService(Chain.POLYGON);
    solService = createMockSubscriptionService(Chain.SOLANA);

    orchestrator = new SubscriptionOrchestrator(
      new Map<Chain, ISubscriptionService>([
        [Chain.ETHEREUM, ethService],
        [Chain.POLYGON, polygonService],
        [Chain.SOLANA, solService],
      ])
    );
  });

  afterEach(() => {
    orchestrator.dispose();
    vi.useRealTimers();
  });

  // =====================================================================
  // 1. Lifecycle management
  // =====================================================================
  describe('lifecycle management', () => {
    it('should create subscriptions for tracked addresses', () => {
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc', '0xdef']],
        [Chain.SOLANA, ['5UtaX']],
      ]);

      orchestrator.subscribeToAddresses(addresses, () => {});

      expect(ethService.subscribe).toHaveBeenCalledWith(
        ['0xabc', '0xdef'],
        expect.any(Function)
      );
      expect(solService.subscribe).toHaveBeenCalledWith(
        ['5UtaX'],
        expect.any(Function)
      );
      // Polygon not called because no polygon addresses given
      expect(polygonService.subscribe).not.toHaveBeenCalled();
    });

    it('should return a handle that can unsubscribe', () => {
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc']],
      ]);

      const handle = orchestrator.subscribeToAddresses(addresses, () => {});

      expect(handle.isActive()).toBe(true);
      handle.unsubscribe();
      expect(handle.isActive()).toBe(false);
    });

    it('should skip chains with no subscription service', () => {
      const addresses = new Map<Chain, string[]>([
        [Chain.BITCOIN, ['bc1q']],
      ]);

      // Should not throw
      const handle = orchestrator.subscribeToAddresses(addresses, () => {});
      expect(handle.isActive()).toBe(true);
    });

    it('should report connection status per chain', () => {
      const statuses = orchestrator.getConnectionStatus();

      expect(statuses.get(Chain.ETHEREUM)).toBe(SubscriptionStatus.CONNECTED);
      expect(statuses.get(Chain.POLYGON)).toBe(SubscriptionStatus.CONNECTED);
      expect(statuses.get(Chain.SOLANA)).toBe(SubscriptionStatus.CONNECTED);
    });
  });

  // =====================================================================
  // 2. Event normalization
  // =====================================================================
  describe('event normalization', () => {
    it('should normalize chain-specific events to PortfolioUpdateEvent', () => {
      const received: PortfolioUpdateEvent[] = [];
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc']],
      ]);

      orchestrator.subscribeToAddresses(addresses, (event) => {
        received.push(event);
      });

      ethService.simulateEvent({
        address: '0xabc',
        eventType: 'Transfer',
        data: { value: '1000' },
      });

      // No debounce on ethereum, but dedup window applies — flush timers
      vi.advanceTimersByTime(600);

      expect(received.length).toBe(1);
      expect(received[0].chain).toBe(Chain.ETHEREUM);
      expect(received[0].address).toBe('0xabc');
      expect(received[0].updateType).toBe('balance_change');
    });

    it('should map different chain event types to normalized update types', () => {
      const received: PortfolioUpdateEvent[] = [];
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc']],
      ]);

      orchestrator.subscribeToAddresses(addresses, (event) => {
        received.push(event);
      });

      ethService.simulateEvent({
        address: '0xabc',
        eventType: 'TokenMint',
      });

      vi.advanceTimersByTime(600);

      expect(received.length).toBe(1);
      expect(received[0].updateType).toBe('new_asset');
    });
  });

  // =====================================================================
  // 3. Deduplication (500ms window per address per chain)
  // =====================================================================
  describe('deduplication', () => {
    it('should deduplicate events within 500ms for same address+chain', () => {
      const received: PortfolioUpdateEvent[] = [];
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc']],
      ]);

      orchestrator.subscribeToAddresses(addresses, (event) => {
        received.push(event);
      });

      // Fire two events for same address within 500ms
      ethService.simulateEvent({ address: '0xabc', eventType: 'Transfer' });
      vi.advanceTimersByTime(100);
      ethService.simulateEvent({ address: '0xabc', eventType: 'BalanceChange' });

      // At 500ms, the dedup window closes and emits once
      vi.advanceTimersByTime(500);

      expect(received.length).toBe(1);
    });

    it('should not deduplicate events for different addresses', () => {
      const received: PortfolioUpdateEvent[] = [];
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc', '0xdef']],
      ]);

      orchestrator.subscribeToAddresses(addresses, (event) => {
        received.push(event);
      });

      ethService.simulateEvent({ address: '0xabc', eventType: 'Transfer' });
      ethService.simulateEvent({ address: '0xdef', eventType: 'Transfer' });

      vi.advanceTimersByTime(600);

      expect(received.length).toBe(2);
    });

    it('should not deduplicate events outside the 500ms window', () => {
      const received: PortfolioUpdateEvent[] = [];
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc']],
      ]);

      orchestrator.subscribeToAddresses(addresses, (event) => {
        received.push(event);
      });

      ethService.simulateEvent({ address: '0xabc', eventType: 'Transfer' });
      vi.advanceTimersByTime(600); // First event fires

      ethService.simulateEvent({ address: '0xabc', eventType: 'Transfer' });
      vi.advanceTimersByTime(600); // Second event fires

      expect(received.length).toBe(2);
    });
  });

  // =====================================================================
  // 4. Per-chain debouncing
  // =====================================================================
  describe('debouncing', () => {
    it('should debounce Solana events with 2s window', () => {
      const received: PortfolioUpdateEvent[] = [];
      const addresses = new Map<Chain, string[]>([
        [Chain.SOLANA, ['5UtaX']],
      ]);

      orchestrator.subscribeToAddresses(addresses, (event) => {
        received.push(event);
      });

      // Fire rapid events within 2s
      solService.simulateEvent({ address: '5UtaX', eventType: 'AccountChange' });
      vi.advanceTimersByTime(500);
      solService.simulateEvent({ address: '5UtaX', eventType: 'AccountChange' });
      vi.advanceTimersByTime(500);
      solService.simulateEvent({ address: '5UtaX', eventType: 'AccountChange' });

      // Still within debounce window, nothing emitted
      expect(received.length).toBe(0);

      // After 2s debounce from last event
      vi.advanceTimersByTime(2500);

      expect(received.length).toBe(1);
    });

    it('should debounce Polygon events with 5s window', () => {
      const received: PortfolioUpdateEvent[] = [];
      const addresses = new Map<Chain, string[]>([
        [Chain.POLYGON, ['0xabc']],
      ]);

      orchestrator.subscribeToAddresses(addresses, (event) => {
        received.push(event);
      });

      polygonService.simulateEvent({ address: '0xabc', eventType: 'Transfer' });
      vi.advanceTimersByTime(2000);
      polygonService.simulateEvent({ address: '0xabc', eventType: 'Transfer' });

      // Only 2s after second event — still within 5s debounce
      vi.advanceTimersByTime(3000);
      expect(received.length).toBe(0);

      // Now 5s after last event
      vi.advanceTimersByTime(2500);
      expect(received.length).toBe(1);
    });

    it('should NOT debounce Ethereum events (12s+ block times)', () => {
      const received: PortfolioUpdateEvent[] = [];
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc']],
      ]);

      orchestrator.subscribeToAddresses(addresses, (event) => {
        received.push(event);
      });

      ethService.simulateEvent({ address: '0xabc', eventType: 'Transfer' });
      vi.advanceTimersByTime(600); // Past dedup window

      // Event fires immediately (after dedup window only)
      expect(received.length).toBe(1);
    });

    it('should NOT debounce Arbitrum/Optimism events', () => {
      const arbService = createMockSubscriptionService(Chain.ARBITRUM);
      const orch = new SubscriptionOrchestrator(
        new Map<Chain, ISubscriptionService>([
          [Chain.ARBITRUM, arbService],
        ])
      );

      const received: PortfolioUpdateEvent[] = [];
      orch.subscribeToAddresses(
        new Map([[Chain.ARBITRUM, ['0xabc']]]),
        (event) => { received.push(event); }
      );

      arbService.simulateEvent({ address: '0xabc', eventType: 'Transfer' });
      vi.advanceTimersByTime(600);

      expect(received.length).toBe(1);
      orch.dispose();
    });
  });

  // =====================================================================
  // 5. Multiple subscribers
  // =====================================================================
  describe('multiple subscribers', () => {
    it('should notify all active subscribers', () => {
      const received1: PortfolioUpdateEvent[] = [];
      const received2: PortfolioUpdateEvent[] = [];
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc']],
      ]);

      orchestrator.subscribeToAddresses(addresses, (e) => { received1.push(e); });
      orchestrator.subscribeToAddresses(addresses, (e) => { received2.push(e); });

      ethService.simulateEvent({ address: '0xabc', eventType: 'Transfer' });
      vi.advanceTimersByTime(600);

      expect(received1.length).toBe(1);
      expect(received2.length).toBe(1);
    });

    it('should stop notifying unsubscribed listeners', () => {
      const received1: PortfolioUpdateEvent[] = [];
      const received2: PortfolioUpdateEvent[] = [];
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc']],
      ]);

      const handle1 = orchestrator.subscribeToAddresses(addresses, (e) => { received1.push(e); });
      orchestrator.subscribeToAddresses(addresses, (e) => { received2.push(e); });

      handle1.unsubscribe();

      ethService.simulateEvent({ address: '0xabc', eventType: 'Transfer' });
      vi.advanceTimersByTime(600);

      expect(received1.length).toBe(0);
      expect(received2.length).toBe(1);
    });
  });

  // =====================================================================
  // 6. Dispose
  // =====================================================================
  describe('dispose', () => {
    it('should clean up all subscriptions on dispose', () => {
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc']],
        [Chain.SOLANA, ['5UtaX']],
      ]);

      const handle = orchestrator.subscribeToAddresses(addresses, () => {});
      orchestrator.dispose();

      expect(handle.isActive()).toBe(false);
    });

    it('should not emit events after dispose', () => {
      const received: PortfolioUpdateEvent[] = [];
      const addresses = new Map<Chain, string[]>([
        [Chain.ETHEREUM, ['0xabc']],
      ]);

      orchestrator.subscribeToAddresses(addresses, (e) => { received.push(e); });
      orchestrator.dispose();

      ethService.simulateEvent({ address: '0xabc', eventType: 'Transfer' });
      vi.advanceTimersByTime(600);

      expect(received.length).toBe(0);
    });
  });
});
