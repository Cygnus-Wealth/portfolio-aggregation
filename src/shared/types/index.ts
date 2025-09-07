export const Chain = {
  ETHEREUM: 'ethereum',
  POLYGON: 'polygon',
  ARBITRUM: 'arbitrum',
  OPTIMISM: 'optimism',
  SOLANA: 'solana',
  BINANCE: 'binance'
} as const;

export type Chain = typeof Chain[keyof typeof Chain];

export const AssetType = {
  TOKEN: 'token',
  NFT: 'nft',
  STOCK: 'stock',
  OPTION: 'option',
  CRYPTO: 'crypto',
  DEFI: 'defi'
} as const;

export type AssetType = typeof AssetType[keyof typeof AssetType];

export const IntegrationSource = {
  EVM: 'evm',
  SOLANA: 'solana',
  ROBINHOOD: 'robinhood'
} as const;

export type IntegrationSource = typeof IntegrationSource[keyof typeof IntegrationSource];

export interface Price {
  value: number;
  currency: string;
  timestamp: Date;
  source?: string;
}

export interface Balance {
  amount: number;
  decimals: number;
  formatted: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name?: string;
  type: AssetType;
  chain?: Chain;
  balance: Balance;
  price?: Price;
  value?: Price;
  contractAddress?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface Portfolio {
  id: string;
  userId?: string;
  assets: Asset[];
  totalValue: Price;
  lastUpdated: Date;
  sources: IntegrationSource[];
}

export interface Transaction {
  id: string;
  hash?: string;
  type: 'send' | 'receive' | 'swap' | 'buy' | 'sell';
  from: string;
  to: string;
  asset: Asset;
  amount: number;
  fee?: Price;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  chain?: Chain;
  source: IntegrationSource;
}

export interface WalletConnection {
  id: string;
  address: string;
  chain: Chain;
  connected: boolean;
  label?: string;
  type?: string;
}