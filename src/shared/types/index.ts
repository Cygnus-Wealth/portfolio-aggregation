export const Chain = {
  ETHEREUM: 'ethereum',
  POLYGON: 'polygon',
  ARBITRUM: 'arbitrum',
  OPTIMISM: 'optimism',
  SOLANA: 'solana',
  BINANCE: 'binance',
  BITCOIN: 'bitcoin'
} as const;

export type Chain = typeof Chain[keyof typeof Chain];

export const AssetType = {
  TOKEN: 'token',
  NFT: 'nft',
  STOCK: 'stock',
  OPTION: 'option',
  CRYPTO: 'crypto',
  CRYPTOCURRENCY: 'crypto', // Alias for backward compatibility
  DEFI: 'defi'
} as const;

export type AssetType = typeof AssetType[keyof typeof AssetType];

export const IntegrationSource = {
  EVM: 'evm',
  SOLANA: 'solana',
  ROBINHOOD: 'robinhood'
} as const;

export type IntegrationSource = typeof IntegrationSource[keyof typeof IntegrationSource];

export const Environment = {
  MAINNET: 'mainnet',
  TESTNET: 'testnet'
} as const;

export type Environment = typeof Environment[keyof typeof Environment];

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

// ============================================================================
// DeFi Types
// ============================================================================

export const DeFiPositionType = {
  VAULT: 'vault',
  LENDING_SUPPLY: 'lending_supply',
  LENDING_BORROW: 'lending_borrow',
  LIQUIDITY_POOL: 'liquidity_pool',
  STAKING: 'staking',
  FARMING: 'farming',
  PERP_POSITION: 'perp_position'
} as const;

export type DeFiPositionType = typeof DeFiPositionType[keyof typeof DeFiPositionType];

export const DeFiProtocol = {
  BEEFY: 'beefy',
  AAVE: 'aave',
  UNISWAP: 'uniswap',
  COMPOUND: 'compound',
  LIDO: 'lido',
  MARINADE: 'marinade',
  RAYDIUM: 'raydium',
  JUPITER: 'jupiter',
  ORCA: 'orca',
  CETUS: 'cetus',
  TURBOS: 'turbos',
  SCALLOP: 'scallop'
} as const;

export type DeFiProtocol = typeof DeFiProtocol[keyof typeof DeFiProtocol];

export const DeFiDiscoveryPath = {
  PASSIVE: 'passive',
  ACTIVE: 'active'
} as const;

export type DeFiDiscoveryPath = typeof DeFiDiscoveryPath[keyof typeof DeFiDiscoveryPath];

export interface UnderlyingAsset {
  symbol: string;
  amount: number;
  contractAddress?: string;
  chain?: Chain;
}

export interface DeFiReward {
  symbol: string;
  amount: number;
  value?: Price;
}

export interface DeFiPosition {
  id: string;
  type: DeFiPositionType;
  protocol: DeFiProtocol;
  chain: Chain;
  underlyingAssets: UnderlyingAsset[];
  value?: Price;
  apy?: number;
  rewards?: DeFiReward[];
  deduplicationKey: string;
  discoveryPath?: DeFiDiscoveryPath;
  receiptTokenAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface VaultPosition extends DeFiPosition {
  type: typeof DeFiPositionType.VAULT;
  vaultAddress: string;
  shareBalance: number;
  pricePerShare: number;
}

export interface LendingPosition extends DeFiPosition {
  type: typeof DeFiPositionType.LENDING_SUPPLY | typeof DeFiPositionType.LENDING_BORROW;
  supplyRate?: number;
  borrowRate?: number;
  collateralFactor?: number;
  healthFactor?: number;
}

export interface LiquidityPosition extends DeFiPosition {
  type: typeof DeFiPositionType.LIQUIDITY_POOL;
  tokenPair: [string, string];
  priceRange?: { lower: number; upper: number };
  feeTier?: number;
  impermanentLoss?: number;
}

export interface StakingPosition extends DeFiPosition {
  type: typeof DeFiPositionType.STAKING;
  lockPeriod?: number;
  validator?: string;
  rewardsAccrued?: DeFiReward[];
}