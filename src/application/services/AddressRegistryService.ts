import type { IAddressRepository, AddressEntry, AddressMetadata } from '../../contracts/repositories/IAddressRepository';
import type { IEventEmitter } from '../../contracts/events/IEventEmitter';
import { BaseDomainEvent, DomainEventType } from '../../domain/events/DomainEvent';

/**
 * Wallet connection interface for address discovery
 */
export interface WalletConnection {
  type: 'metamask' | 'walletconnect' | 'phantom' | 'coinbase' | 'other';
  chainId: string;
  addresses: string[];
}

/**
 * Address added event
 */
export class AddressAddedEvent extends BaseDomainEvent {
  readonly payload: {
    chain: string;
    address: string;
    metadata: AddressMetadata;
  };

  constructor(chain: string, address: string, metadata: AddressMetadata) {
    super(DomainEventType.ADDRESS_ADDED);
    this.payload = { chain, address, metadata };
  }
}

/**
 * Address removed event
 */
export class AddressRemovedEvent extends BaseDomainEvent {
  readonly payload: {
    chain: string;
    address: string;
  };

  constructor(chain: string, address: string) {
    super(DomainEventType.ADDRESS_REMOVED);
    this.payload = { chain, address };
  }
}

/**
 * Service for managing tracked addresses
 */
export class AddressRegistryService {
  constructor(
    private addressRepository: IAddressRepository,
    private eventEmitter?: IEventEmitter
  ) {}

  /**
   * Add an address to track
   */
  async addAddress(chain: string, address: string, metadata?: AddressMetadata): Promise<void> {
    // Validate address format
    const isValid = await this.validateAddress(chain, address);
    if (!isValid) {
      throw new Error(`Invalid address format for chain ${chain}: ${address}`);
    }

    // Normalize address
    const normalizedAddress = this.normalizeAddress(chain, address);
    
    // Save to repository
    const fullMetadata: AddressMetadata = {
      source: 'manual',
      addedAt: new Date(),
      ...metadata
    };
    
    await this.addressRepository.save(chain, normalizedAddress, fullMetadata);
    
    // Emit event
    if (this.eventEmitter) {
      const event = new AddressAddedEvent(chain, normalizedAddress, fullMetadata);
      this.eventEmitter.emit(DomainEventType.ADDRESS_ADDED, event);
    }
  }

  /**
   * Remove an address from tracking
   */
  async removeAddress(chain: string, address: string): Promise<void> {
    const normalizedAddress = this.normalizeAddress(chain, address);
    
    await this.addressRepository.remove(chain, normalizedAddress);
    
    // Emit event
    if (this.eventEmitter) {
      const event = new AddressRemovedEvent(chain, normalizedAddress);
      this.eventEmitter.emit(DomainEventType.ADDRESS_REMOVED, event);
    }
  }

  /**
   * Update address metadata
   */
  async updateAddressMetadata(
    chain: string,
    address: string,
    metadata: AddressMetadata
  ): Promise<void> {
    const normalizedAddress = this.normalizeAddress(chain, address);
    
    await this.addressRepository.update(chain, normalizedAddress, metadata);
    
    // Emit event
    if (this.eventEmitter) {
      // Create specific event for metadata update
      const event = {
        eventId: `evt_${Date.now()}`,
        eventType: DomainEventType.ADDRESS_METADATA_UPDATED,
        occurredAt: new Date(),
        payload: { chain, address: normalizedAddress, metadata }
      };
      this.eventEmitter.emit(DomainEventType.ADDRESS_METADATA_UPDATED, event);
    }
  }

  /**
   * Get addresses for a specific chain or all chains
   */
  async getAddresses(chain?: string): Promise<Map<string, AddressEntry[]>> {
    if (chain) {
      const chainAddresses = await this.addressRepository.findByChain(chain);
      const result = new Map<string, AddressEntry[]>();
      result.set(chain, chainAddresses);
      return result;
    }
    
    return this.addressRepository.findAll();
  }

  /**
   * Get address by label
   */
  async getAddressByLabel(label: string): Promise<AddressEntry | null> {
    return this.addressRepository.findByLabel(label);
  }

  /**
   * Discover addresses from wallet connection
   */
  async discoverAddresses(walletConnection: WalletConnection): Promise<AddressEntry[]> {
    const discovered: AddressEntry[] = [];
    const chain = this.mapChainIdToChain(walletConnection.chainId);
    
    for (const address of walletConnection.addresses) {
      const isValid = await this.validateAddress(chain, address);
      if (isValid) {
        const normalizedAddress = this.normalizeAddress(chain, address);
        
        const metadata: AddressMetadata = {
          source: 'wallet',
          addedAt: new Date(),
          tags: [`wallet:${walletConnection.type}`]
        };
        
        await this.addressRepository.save(chain, normalizedAddress, metadata);
        
        discovered.push({
          chain,
          address: normalizedAddress,
          metadata
        });
      }
    }
    
    return discovered;
  }

  /**
   * Validate address format for a chain
   */
  async validateAddress(chain: string, address: string): Promise<boolean> {
    switch (chain.toLowerCase()) {
      case 'ethereum':
      case 'polygon':
      case 'arbitrum':
      case 'optimism':
      case 'binance':
        return this.validateEVMAddress(address);
      
      case 'solana':
        return this.validateSolanaAddress(address);
      
      case 'bitcoin':
        return this.validateBitcoinAddress(address);
      
      default:
        // Unknown chain, basic validation
        return address.length > 0 && address.length < 100;
    }
  }

  /**
   * Validate EVM address format
   */
  private validateEVMAddress(address: string): boolean {
    // Basic EVM address validation
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Validate Solana address format
   */
  private validateSolanaAddress(address: string): boolean {
    // Basic Solana address validation (base58, 32-44 chars)
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  /**
   * Validate Bitcoin address format
   */
  private validateBitcoinAddress(address: string): boolean {
    // Basic Bitcoin address validation (supports multiple formats)
    // P2PKH (starts with 1)
    if (/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;
    // P2SH (starts with 3)
    if (/^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;
    // Bech32 (starts with bc1)
    if (/^bc1[a-z0-9]{39,59}$/.test(address)) return true;
    
    return false;
  }

  /**
   * Normalize address format
   */
  private normalizeAddress(chain: string, address: string): string {
    switch (chain.toLowerCase()) {
      case 'ethereum':
      case 'polygon':
      case 'arbitrum':
      case 'optimism':
      case 'binance':
        // EVM addresses: lowercase
        return address.toLowerCase();
      
      default:
        // Keep original format for other chains
        return address;
    }
  }

  /**
   * Map chain ID to chain name
   */
  private mapChainIdToChain(chainId: string): string {
    const chainMap: Record<string, string> = {
      '1': 'ethereum',
      '137': 'polygon',
      '42161': 'arbitrum',
      '10': 'optimism',
      '56': 'binance',
      'solana': 'solana',
      'bitcoin': 'bitcoin'
    };
    
    return chainMap[chainId] || chainId;
  }
}