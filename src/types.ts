// src/types.ts

// REFACTORED: Define and export the AssetId type.
export type AssetId = 'BTC' | 'ETH' | 'USDC' | 'VERI';

// All other types from your original App.tsx
export interface Message {
  payload: string;
  contentTopic: string;
  version?: number;
  timestamp?: string; // Should be BigInt in reality, but string for JSON transport
  ephemeral?: boolean;
}

export interface CommunityMetadata {
  name: string;
  contentTopic: string;
}

export interface HealthResponse {
  nodeHealth: 'ready' | 'unhealthy' | 'starting' | string;
  totalPeers: number;
}

export interface PriceInfo {
  usd: number;
  usd_24h_change: number;
}

export interface PriceData {
  bitcoin: PriceInfo;
  ethereum: PriceInfo;
  "usd-coin": PriceInfo;
  veritaseum: PriceInfo;
}

// REFACTORED: The `fromDisplay` and `toDisplay` properties, which contained JSX,
// have been removed. The UI will now use the AssetIcon component directly.
export interface ProcessedSwapOffer {
  key: string;
  fromAsset: string;
  fromAmount: number | string;
  toAsset: string;
  toAmount: number | string;
  timestamp?: string;
  rate: string;
  rawMessage: string;
  isDebugMode: boolean;
  isValidJSON: boolean;
  originalData: any;
  isMyOffer: boolean;
}
