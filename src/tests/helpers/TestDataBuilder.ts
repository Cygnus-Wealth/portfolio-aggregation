import { AssetEntity } from '../../domain/entities/Asset';
import { PortfolioAggregate } from '../../domain/aggregates/Portfolio';
import { Money } from '../../domain/value-objects/Money';
import { Address } from '../../domain/value-objects/Address';
import { AssetType, IntegrationSource, Asset, Balance } from '../../shared/types';

/**
 * Test data builder for creating test fixtures
 */
export class TestDataBuilder {
  /**
   * Create a test asset entity
   */
  static createAsset(overrides: Partial<AssetEntity> = {}): AssetEntity {
    return new AssetEntity({
      id: `asset-${Math.random().toString(36).substr(2, 9)}`,
      symbol: 'ETH',
      name: 'Ethereum',
      type: AssetType.CRYPTOCURRENCY,
      chain: 'ethereum',
      balance: {
        amount: 1.0,
        decimals: 18,
        formatted: '1.000000000000000000'
      },
      price: {
        value: 2500,
        currency: 'USD'
      },
      ...overrides
    });
  }

  /**
   * Create a test portfolio aggregate
   */
  static createPortfolio(overrides: Partial<PortfolioAggregate> = {}): PortfolioAggregate {
    const portfolio = new PortfolioAggregate({
      id: `portfolio-${Math.random().toString(36).substr(2, 9)}`,
      userId: 'test-user',
      ...overrides
    });

    // Add default assets if none provided
    if (!overrides.assets) {
      portfolio.addAsset(TestDataBuilder.createAsset());
      portfolio.addAsset(TestDataBuilder.createAsset({
        symbol: 'USDC',
        name: 'USD Coin',
        balance: {
          amount: 1000,
          decimals: 6,
          formatted: '1000.000000'
        },
        price: {
          value: 1,
          currency: 'USD'
        }
      }));
    }

    // Add default sources if none provided
    if (!overrides.sources) {
      portfolio.addSource(IntegrationSource.EVM);
    }

    return portfolio;
  }

  /**
   * Create a test money value object
   */
  static createMoney(amount: number = 100, currency: string = 'USD'): Money {
    return new Money(amount, currency);
  }

  /**
   * Create a test address value object
   */
  static createAddress(
    value: string = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
    chain: string = 'ethereum'
  ): Address {
    return new Address(value, chain);
  }

  /**
   * Create a test balance
   */
  static createBalance(overrides: Partial<Balance> = {}): Balance {
    return {
      amount: 1.0,
      decimals: 18,
      formatted: '1.000000000000000000',
      ...overrides
    };
  }

  /**
   * Create test assets for integration
   */
  static createIntegrationAssets(count: number = 5): Asset[] {
    const assets: Asset[] = [];
    const symbols = ['ETH', 'BTC', 'USDC', 'USDT', 'DAI', 'LINK', 'UNI', 'AAVE'];
    
    for (let i = 0; i < count; i++) {
      const symbol = symbols[i % symbols.length];
      assets.push({
        id: `asset-${i}`,
        symbol,
        name: `${symbol} Token`,
        type: AssetType.CRYPTOCURRENCY,
        chain: i % 2 === 0 ? 'ethereum' : 'polygon',
        balance: {
          amount: Math.random() * 100,
          decimals: symbol.includes('USD') ? 6 : 18,
          formatted: ''
        },
        price: {
          value: symbol === 'BTC' ? 45000 : symbol === 'ETH' ? 2500 : 1,
          currency: 'USD'
        },
        metadata: {
          source: IntegrationSource.EVM,
          fetchedAt: new Date().toISOString()
        }
      });
    }
    
    return assets;
  }

  /**
   * Create a portfolio with random assets
   */
  static createRandomPortfolio(): PortfolioAggregate {
    const portfolio = new PortfolioAggregate({
      id: `portfolio-${Date.now()}`,
      userId: `user-${Math.random().toString(36).substr(2, 9)}`
    });

    const assetCount = Math.floor(Math.random() * 10) + 1;
    const assets = TestDataBuilder.createIntegrationAssets(assetCount);

    for (const assetData of assets) {
      const asset = new AssetEntity(assetData);
      portfolio.addAsset(asset);
    }

    portfolio.addSource(IntegrationSource.EVM);
    if (Math.random() > 0.5) {
      portfolio.addSource(IntegrationSource.SOLANA);
    }

    return portfolio;
  }

  /**
   * Create test addresses map
   */
  static createAddressesMap(): Map<string, string[]> {
    const addresses = new Map<string, string[]>();
    addresses.set('ethereum', [
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4',
      '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed'
    ]);
    addresses.set('polygon', [
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4'
    ]);
    addresses.set('solana', [
      '5UtaXPD7yKFdwZcNh5qZRf8kY3Zv7HaGpP9K9S5dFN4X'
    ]);
    return addresses;
  }
}