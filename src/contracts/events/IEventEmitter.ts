import { DomainEvent, DomainEventType } from '../../domain/events/DomainEvent';

/**
 * Event handler type
 */
export type EventHandler = (event: DomainEvent) => void | Promise<void>;

/**
 * Unsubscribe function type
 */
export type UnsubscribeFn = () => void;

/**
 * Event emitter interface for external event propagation
 */
export interface IEventEmitter {
  /**
   * Emit an event
   */
  emit(eventType: DomainEventType | string, event: DomainEvent): void;
  
  /**
   * Subscribe to an event
   */
  on(eventType: DomainEventType | string, handler: EventHandler): UnsubscribeFn;
  
  /**
   * Unsubscribe from an event
   */
  off(eventType: DomainEventType | string, handler: EventHandler): void;
  
  /**
   * Subscribe to an event once
   */
  once(eventType: DomainEventType | string, handler: EventHandler): UnsubscribeFn;
}