/**
 * Address metadata interface
 */
export interface AddressMetadata {
  label?: string;
  tags?: string[];
  source?: 'manual' | 'wallet' | 'discovered';
  addedAt?: Date;
}

/**
 * Address entry interface
 */
export interface AddressEntry {
  chain: string;
  address: string;
  metadata: AddressMetadata;
}

/**
 * Repository interface for address management
 */
export interface IAddressRepository {
  /**
   * Save an address with metadata
   */
  save(chain: string, address: string, metadata: AddressMetadata): Promise<void>;
  
  /**
   * Remove an address
   */
  remove(chain: string, address: string): Promise<void>;
  
  /**
   * Find addresses by chain
   */
  findByChain(chain: string): Promise<AddressEntry[]>;
  
  /**
   * Find all addresses grouped by chain
   */
  findAll(): Promise<Map<string, AddressEntry[]>>;
  
  /**
   * Find address by label
   */
  findByLabel(label: string): Promise<AddressEntry | null>;
  
  /**
   * Update address metadata
   */
  update(chain: string, address: string, metadata: Partial<AddressMetadata>): Promise<void>;
  
  /**
   * Clear all addresses
   */
  clear(): Promise<void>;
}