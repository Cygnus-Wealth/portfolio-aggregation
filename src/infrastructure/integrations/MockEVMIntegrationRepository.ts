import type { IIntegrationRepository } from '@contracts/repositories/IIntegrationRepository';
import type { Asset, Portfolio, Transaction } from '@shared/types';
import { IntegrationSource, AssetType, Chain } from '@shared/types';

export class MockEVMIntegrationRepository implements IIntegrationRepository {
  readonly source = IntegrationSource.EVM;
  private connected = false;
  private readonly mockDelay = 500; // Simulate network delay

  async connect(): Promise<void> {
    await this.delay(this.mockDelay);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.delay(200);
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchPortfolio(addresses: string[]): Promise<Portfolio> {
    if (!this.isConnected()) {
      throw new Error('EVM integration not connected');
    }

    await this.delay(this.mockDelay);
    
    const assets = await this.fetchAssets(addresses);
    const totalValue = this.calculateTotalValue(assets);

    return {
      id: `evm-portfolio-${addresses.join('-')}`,
      assets,
      totalValue,
      lastUpdated: new Date(),
      sources: [IntegrationSource.EVM]
    };
  }

  async fetchAssets(addresses: string[]): Promise<Asset[]> {
    if (!this.isConnected()) {
      throw new Error('EVM integration not connected');
    }

    await this.delay(this.mockDelay);

    const assets: Asset[] = [];
    
    for (const address of addresses) {
      // ETH on Ethereum
      assets.push({
        id: `eth-${address}-ethereum`,
        symbol: 'ETH',
        name: 'Ethereum',
        type: AssetType.CRYPTO,
        chain: Chain.ETHEREUM,
        balance: {
          amount: 2.5,
          decimals: 18,
          formatted: '2.5'
        },
        price: {
          value: 2650.75,
          currency: 'USD',
          timestamp: new Date(),
          source: 'coingecko'
        },
        value: {
          value: 6626.88,
          currency: 'USD',
          timestamp: new Date()
        },
        contractAddress: undefined, // Native token
        imageUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
      });

      // USDC on Ethereum
      assets.push({
        id: `usdc-${address}-ethereum`,
        symbol: 'USDC',
        name: 'USD Coin',
        type: AssetType.TOKEN,
        chain: Chain.ETHEREUM,
        balance: {
          amount: 1500.0,
          decimals: 6,
          formatted: '1500.00'
        },
        price: {
          value: 1.0,
          currency: 'USD',
          timestamp: new Date(),
          source: 'coingecko'
        },
        value: {
          value: 1500.0,
          currency: 'USD',
          timestamp: new Date()
        },
        contractAddress: '0xA0b86991c431C24b41E2D22a7b31AF2d97a',
        imageUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
      });

      // MATIC on Polygon
      assets.push({
        id: `matic-${address}-polygon`,
        symbol: 'MATIC',
        name: 'Polygon',
        type: AssetType.CRYPTO,
        chain: Chain.POLYGON,
        balance: {
          amount: 850.25,
          decimals: 18,
          formatted: '850.25'
        },
        price: {
          value: 0.85,
          currency: 'USD',
          timestamp: new Date(),
          source: 'coingecko'
        },
        value: {
          value: 722.71,
          currency: 'USD',
          timestamp: new Date()
        },
        contractAddress: undefined, // Native token
        imageUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.png'
      });

      // ARB on Arbitrum
      assets.push({
        id: `arb-${address}-arbitrum`,
        symbol: 'ARB',
        name: 'Arbitrum',
        type: AssetType.TOKEN,
        chain: Chain.ARBITRUM,
        balance: {
          amount: 200.0,
          decimals: 18,
          formatted: '200.00'
        },
        price: {
          value: 1.15,
          currency: 'USD',
          timestamp: new Date(),
          source: 'coingecko'
        },
        value: {
          value: 230.0,
          currency: 'USD',
          timestamp: new Date()
        },
        contractAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
        imageUrl: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png'
      });

      // Mock NFT
      assets.push({
        id: `nft-${address}-ethereum-1`,
        symbol: 'BAYC',
        name: 'Bored Ape Yacht Club #1234',
        type: AssetType.NFT,
        chain: Chain.ETHEREUM,
        balance: {
          amount: 1,
          decimals: 0,
          formatted: '1'
        },
        price: {
          value: 15.5,
          currency: 'ETH',
          timestamp: new Date(),
          source: 'opensea'
        },
        value: {
          value: 41087.63,
          currency: 'USD',
          timestamp: new Date()
        },
        contractAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
        imageUrl: 'https://i.seadn.io/gae/example-bayc-image.png',
        metadata: {
          tokenId: '1234',
          collection: 'Bored Ape Yacht Club',
          traits: {
            background: 'Blue',
            fur: 'Golden Brown',
            eyes: 'Bored',
            mouth: 'Grin'
          }
        }
      });
    }

    return assets;
  }

  async fetchTransactions(addresses: string[], limit = 50): Promise<Transaction[]> {
    if (!this.isConnected()) {
      throw new Error('EVM integration not connected');
    }

    await this.delay(this.mockDelay);

    const transactions: Transaction[] = [];
    const now = new Date();

    for (let i = 0; i < Math.min(limit, 10); i++) {
      const address = addresses[i % addresses.length];
      
      transactions.push({
        id: `evm-tx-${i}-${address}`,
        hash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        type: i % 2 === 0 ? 'receive' : 'send',
        from: i % 2 === 0 ? '0x742d35Cc6634C0532925a3b8c5521f2f1D872B1e' : address,
        to: i % 2 === 0 ? address : '0x742d35Cc6634C0532925a3b8c5521f2f1D872B1e',
        asset: {
          id: `eth-${address}-ethereum`,
          symbol: 'ETH',
          name: 'Ethereum',
          type: AssetType.CRYPTO,
          chain: Chain.ETHEREUM,
          balance: {
            amount: 0.5,
            decimals: 18,
            formatted: '0.5'
          }
        },
        amount: 0.5,
        fee: {
          value: 0.002,
          currency: 'ETH',
          timestamp: new Date(now.getTime() - i * 60000)
        },
        timestamp: new Date(now.getTime() - i * 3600000), // Hours ago
        status: 'confirmed',
        chain: Chain.ETHEREUM,
        source: IntegrationSource.EVM
      });
    }

    return transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  subscribeToUpdates(addresses: string[], callback: (update: Portfolio) => void): () => void {
    if (!this.isConnected()) {
      throw new Error('EVM integration not connected');
    }

    // Simulate periodic updates
    const intervalId = setInterval(async () => {
      try {
        const portfolio = await this.fetchPortfolio(addresses);
        callback(portfolio);
      } catch (error) {
        console.error('Error in EVM subscription update:', error);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(intervalId);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateTotalValue(assets: Asset[]): { value: number; currency: string; timestamp: Date } {
    const total = assets.reduce((sum, asset) => {
      if (asset.value?.currency === 'USD') {
        return sum + asset.value.value;
      }
      return sum;
    }, 0);

    return {
      value: total,
      currency: 'USD',
      timestamp: new Date()
    };
  }
}