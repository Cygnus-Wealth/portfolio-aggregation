import { AssetType, Chain } from '../../shared/types';
import type { Balance, Price } from '../../shared/types';
import { Money } from '../value-objects/Money';

export class AssetEntity {
  private _id: string;
  private _symbol: string;
  private _name?: string;
  private _type: AssetType;
  private _chain?: Chain;
  private _balance: Balance;
  private _price?: Price;
  private _contractAddress?: string;
  private _imageUrl?: string;
  private _metadata: Record<string, unknown>;

  constructor(params: {
    id: string;
    symbol: string;
    name?: string;
    type: AssetType;
    chain?: Chain;
    balance: Balance;
    price?: Price;
    contractAddress?: string;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    this._id = params.id;
    this._symbol = params.symbol.toUpperCase();
    this._name = params.name;
    this._type = params.type;
    this._chain = params.chain;
    this._balance = params.balance;
    this._price = params.price;
    this._contractAddress = params.contractAddress;
    this._imageUrl = params.imageUrl;
    this._metadata = params.metadata || {};
  }

  get id(): string {
    return this._id;
  }

  get symbol(): string {
    return this._symbol;
  }

  get name(): string | undefined {
    return this._name;
  }

  get type(): AssetType {
    return this._type;
  }

  get chain(): Chain | undefined {
    return this._chain;
  }

  get balance(): Balance {
    return this._balance;
  }

  get price(): Price | undefined {
    return this._price;
  }

  get contractAddress(): string | undefined {
    return this._contractAddress;
  }

  get imageUrl(): string | undefined {
    return this._imageUrl;
  }

  get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }

  getValue(): Money | null {
    if (!this._price) return null;
    
    const totalValue = this._balance.amount * this._price.value;
    return new Money(totalValue, this._price.currency);
  }

  updatePrice(price: Price): void {
    this._price = price;
  }

  updateBalance(balance: Balance): void {
    this._balance = balance;
  }

  isOnChain(chain: Chain): boolean {
    return this._chain === chain;
  }

  isSameAsset(other: AssetEntity): boolean {
    if (this._contractAddress && other.contractAddress) {
      return this._contractAddress === other.contractAddress && 
             this._chain === other.chain;
    }
    
    return this._symbol === other.symbol && 
           this._type === other.type &&
           this._chain === other.chain;
  }

  merge(other: AssetEntity): AssetEntity {
    if (!this.isSameAsset(other)) {
      throw new Error('Cannot merge different assets');
    }

    const mergedBalance: Balance = {
      amount: this._balance.amount + other.balance.amount,
      decimals: this._balance.decimals,
      formatted: (this._balance.amount + other.balance.amount).toFixed(this._balance.decimals)
    };

    const latestPrice = this._price && other.price
      ? (this._price.timestamp > other.price.timestamp ? this._price : other.price)
      : this._price || other.price;

    return new AssetEntity({
      id: this._id,
      symbol: this._symbol,
      name: this._name || other.name,
      type: this._type,
      chain: this._chain,
      balance: mergedBalance,
      price: latestPrice,
      contractAddress: this._contractAddress || other.contractAddress,
      imageUrl: this._imageUrl || other.imageUrl,
      metadata: { ...other.metadata, ...this._metadata }
    });
  }

  toJSON() {
    return {
      id: this._id,
      symbol: this._symbol,
      name: this._name,
      type: this._type,
      chain: this._chain,
      balance: this._balance,
      price: this._price,
      value: this.getValue()?.toJSON(),
      contractAddress: this._contractAddress,
      imageUrl: this._imageUrl,
      metadata: this._metadata
    };
  }
}