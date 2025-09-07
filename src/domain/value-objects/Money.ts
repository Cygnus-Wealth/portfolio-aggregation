export class Money {
  private readonly _amount: number;
  private readonly _currency: string;

  constructor(amount: number, currency: string) {
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    if (!currency || currency.length !== 3) {
      throw new Error('Currency must be a 3-letter code');
    }
    
    this._amount = amount;
    this._currency = currency.toUpperCase();
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  add(other: Money): Money {
    if (this._currency !== other.currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money(this._amount + other.amount, this._currency);
  }

  subtract(other: Money): Money {
    if (this._currency !== other.currency) {
      throw new Error('Cannot subtract money with different currencies');
    }
    if (this._amount < other.amount) {
      throw new Error('Insufficient funds');
    }
    return new Money(this._amount - other.amount, this._currency);
  }

  multiply(factor: number): Money {
    if (factor < 0) {
      throw new Error('Multiplication factor cannot be negative');
    }
    return new Money(this._amount * factor, this._currency);
  }

  equals(other: Money): boolean {
    return this._amount === other.amount && this._currency === other.currency;
  }

  toString(): string {
    return `${this._amount.toFixed(2)} ${this._currency}`;
  }

  toJSON() {
    return {
      amount: this._amount,
      currency: this._currency
    };
  }
}