import { Chain } from '../../shared/types';

export class Address {
  private readonly _value: string;
  private readonly _chain: Chain;

  constructor(value: string, chain: Chain) {
    if (!this.isValidAddress(value, chain)) {
      throw new Error(`Invalid address for chain ${chain}: ${value}`);
    }
    
    this._value = this.normalize(value, chain);
    this._chain = chain;
  }

  get value(): string {
    return this._value;
  }

  get chain(): Chain {
    return this._chain;
  }

  private isValidAddress(address: string, chain: Chain): boolean {
    if (!address) return false;

    switch (chain) {
      case Chain.ETHEREUM:
      case Chain.POLYGON:
      case Chain.ARBITRUM:
      case Chain.OPTIMISM:
      case Chain.BINANCE:
        return this.isValidEVMAddress(address);
      case Chain.SOLANA:
        return this.isValidSolanaAddress(address);
      default:
        return false;
    }
  }

  private isValidEVMAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private isValidSolanaAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  private normalize(address: string, chain: Chain): string {
    switch (chain) {
      case Chain.ETHEREUM:
      case Chain.POLYGON:
      case Chain.ARBITRUM:
      case Chain.OPTIMISM:
      case Chain.BINANCE:
        return address.toLowerCase();
      case Chain.SOLANA:
        return address;
      default:
        return address;
    }
  }

  equals(other: Address): boolean {
    return this._value === other.value && this._chain === other.chain;
  }

  toString(): string {
    return this._value;
  }

  toJSON() {
    return {
      value: this._value,
      chain: this._chain
    };
  }
}