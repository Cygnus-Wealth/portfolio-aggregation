import { IEventEmitter, EventHandler, UnsubscribeFn } from '../../../contracts/events/IEventEmitter';
import { DomainEvent, DomainEventType } from '../../../domain/events/DomainEvent';

/**
 * E2E mock event emitter that records all events for assertion
 */
export class E2EMockEventEmitter implements IEventEmitter {
  readonly emittedEvents: Array<{ type: string; event: DomainEvent }> = [];
  private handlers: Map<string, Set<EventHandler>> = new Map();

  emit(eventType: DomainEventType | string, event: DomainEvent): void {
    this.emittedEvents.push({ type: eventType as string, event });

    const typeHandlers = this.handlers.get(eventType as string);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try {
          handler(event);
        } catch {
          // swallow in tests
        }
      });
    }
  }

  on(eventType: DomainEventType | string, handler: EventHandler): UnsubscribeFn {
    if (!this.handlers.has(eventType as string)) {
      this.handlers.set(eventType as string, new Set());
    }
    this.handlers.get(eventType as string)!.add(handler);
    return () => this.handlers.get(eventType as string)?.delete(handler);
  }

  off(eventType: DomainEventType | string, handler: EventHandler): void {
    this.handlers.get(eventType as string)?.delete(handler);
  }

  once(eventType: DomainEventType | string, handler: EventHandler): UnsubscribeFn {
    const wrappedHandler: EventHandler = (event) => {
      this.off(eventType, wrappedHandler);
      return handler(event);
    };
    return this.on(eventType, wrappedHandler);
  }

  // -- Test helpers --

  getEventsByType(type: DomainEventType | string): DomainEvent[] {
    return this.emittedEvents
      .filter(e => e.type === type)
      .map(e => e.event);
  }

  hasEvent(type: DomainEventType | string): boolean {
    return this.emittedEvents.some(e => e.type === type);
  }

  clear(): void {
    this.emittedEvents.length = 0;
    this.handlers.clear();
  }
}
