import type { ICommand } from './Command';
import type { AddressMetadata } from '../../contracts/repositories/IAddressRepository';

/**
 * Command to add an address to tracking
 */
export class AddAddressCommand implements ICommand<void> {
  readonly chain: string;
  readonly address: string;
  readonly metadata?: AddressMetadata;

  constructor(chain: string, address: string, metadata?: AddressMetadata) {
    this.chain = chain;
    this.address = address;
    this.metadata = metadata;
  }

  async execute(): Promise<void> {
    // Execution delegated to handler
    throw new Error('Command must be executed through CommandBus');
  }
}