import { describe, it, expect } from 'vitest';
import { Money } from '../../../../domain/value-objects/Money';

describe('Money Value Object', () => {
  describe('constructor', () => {
    it('should create a valid Money instance', () => {
      const money = new Money(100, 'USD');
      expect(money.amount).toBe(100);
      expect(money.currency).toBe('USD');
    });

    it('should uppercase currency code', () => {
      const money = new Money(100, 'usd');
      expect(money.currency).toBe('USD');
    });

    it('should throw error for negative amount', () => {
      expect(() => new Money(-100, 'USD')).toThrow('Money amount cannot be negative');
    });

    it('should throw error for invalid currency code', () => {
      expect(() => new Money(100, 'US')).toThrow('Currency must be a 3-letter code');
      expect(() => new Money(100, '')).toThrow('Currency must be a 3-letter code');
    });
  });

  describe('add', () => {
    it('should add two Money instances with same currency', () => {
      const money1 = new Money(100, 'USD');
      const money2 = new Money(50, 'USD');
      const result = money1.add(money2);
      
      expect(result.amount).toBe(150);
      expect(result.currency).toBe('USD');
    });

    it('should throw error when adding different currencies', () => {
      const money1 = new Money(100, 'USD');
      const money2 = new Money(50, 'EUR');
      
      expect(() => money1.add(money2)).toThrow('Cannot add money with different currencies');
    });
  });

  describe('subtract', () => {
    it('should subtract two Money instances with same currency', () => {
      const money1 = new Money(100, 'USD');
      const money2 = new Money(30, 'USD');
      const result = money1.subtract(money2);
      
      expect(result.amount).toBe(70);
      expect(result.currency).toBe('USD');
    });

    it('should throw error when subtracting different currencies', () => {
      const money1 = new Money(100, 'USD');
      const money2 = new Money(50, 'EUR');
      
      expect(() => money1.subtract(money2)).toThrow('Cannot subtract money with different currencies');
    });

    it('should throw error for insufficient funds', () => {
      const money1 = new Money(50, 'USD');
      const money2 = new Money(100, 'USD');
      
      expect(() => money1.subtract(money2)).toThrow('Insufficient funds');
    });
  });

  describe('multiply', () => {
    it('should multiply Money by a factor', () => {
      const money = new Money(100, 'USD');
      const result = money.multiply(2.5);
      
      expect(result.amount).toBe(250);
      expect(result.currency).toBe('USD');
    });

    it('should throw error for negative multiplication factor', () => {
      const money = new Money(100, 'USD');
      
      expect(() => money.multiply(-2)).toThrow('Multiplication factor cannot be negative');
    });
  });

  describe('equals', () => {
    it('should return true for equal Money instances', () => {
      const money1 = new Money(100, 'USD');
      const money2 = new Money(100, 'USD');
      
      expect(money1.equals(money2)).toBe(true);
    });

    it('should return false for different amounts', () => {
      const money1 = new Money(100, 'USD');
      const money2 = new Money(200, 'USD');
      
      expect(money1.equals(money2)).toBe(false);
    });

    it('should return false for different currencies', () => {
      const money1 = new Money(100, 'USD');
      const money2 = new Money(100, 'EUR');
      
      expect(money1.equals(money2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should format Money as string', () => {
      const money = new Money(100.5, 'USD');
      expect(money.toString()).toBe('100.50 USD');
    });
  });

  describe('toJSON', () => {
    it('should serialize Money to JSON', () => {
      const money = new Money(100, 'USD');
      const json = money.toJSON();
      
      expect(json).toEqual({
        amount: 100,
        currency: 'USD'
      });
    });
  });
});