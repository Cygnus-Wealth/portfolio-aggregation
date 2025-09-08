import { DomainEvent, DomainEventType } from './DomainEvent';

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>;
export type UnsubscribeFn = () => void;

/**
 * Event bus interface for domain events
 */
export interface IEventBus {
  publish(event: DomainEvent): void;
  subscribe(eventType: DomainEventType | string, handler: EventHandler): UnsubscribeFn;
  subscribeAll(handler: EventHandler): UnsubscribeFn;
}

/**
 * In-memory event bus implementation
 */
export class InMemoryEventBus implements IEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private globalHandlers: Set<EventHandler> = new Set();

  publish(event: DomainEvent): void {
    // Notify specific event type handlers
    const typeHandlers = this.handlers.get(event.eventType);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            result.catch(error => {
              console.error(`Event handler error for ${event.eventType}:`, error);
            });
          }
        } catch (error) {
          console.error(`Event handler error for ${event.eventType}:`, error);
        }
      });
    }

    // Notify global handlers
    this.globalHandlers.forEach(handler => {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch(error => {
            console.error('Global event handler error:', error);
          });
        }
      } catch (error) {
        console.error('Global event handler error:', error);
      }
    });
  }

  subscribe(eventType: DomainEventType | string, handler: EventHandler): UnsubscribeFn {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    const typeHandlers = this.handlers.get(eventType)!;
    typeHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      typeHandlers.delete(handler);
      if (typeHandlers.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  subscribeAll(handler: EventHandler): UnsubscribeFn {
    this.globalHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clear(): void {
    this.handlers.clear();
    this.globalHandlers.clear();
  }
}