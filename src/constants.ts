// waku-frontend/src/constants.ts

import { PriceData, AssetId } from './types';

// ============================================================================
// API and Network Configuration
// ============================================================================

// UPDATED: This now accepts VITE_SERVICE_ENDPOINT (from .env) or VITE_API_ENDPOINT (from docker-compose)
// This makes your configuration more resilient to changes.
const serviceEndpoint = import.meta.env.VITE_SERVICE_ENDPOINT || import.meta.env.VITE_API_ENDPOINT;

// This check provides a clear error if the .env file is missing or misconfigured.
if (!serviceEndpoint) {
  throw new Error("FATAL: VITE_SERVICE_ENDPOINT or VITE_API_ENDPOINT is not defined. Please check your waku-frontend/.env or docker-compose.yml file.");
}

// Ensure there's no trailing slash
export const SERVICE_ENDPOINT = String(serviceEndpoint).replace(/\/$/, '');

export const VERIDAO_ORANGE = '#f27900';

// ============================================================================
// Timing and Intervals (in milliseconds)
// ============================================================================

export const MESSAGE_FETCH_DELAY = 1500;
export const PRICE_UPDATE_INTERVAL = 60000;
export const UPTIME_UPDATE_INTERVAL = 1000;

// ============================================================================
// Default Data and Placeholders
// ============================================================================

export const DEFAULT_PRICE_DATA: PriceData = {
  bitcoin: { usd: 67000, usd_24h_change: 0 },
  ethereum: { usd: 3400, usd_24h_change: 0 },
  "usd-coin": { usd: 1, usd_24h_change: 0 },
  veritaseum: { usd: 25, usd_24h_change: 0 },
};

// ============================================================================
// Application-Specific Constants
// ============================================================================

export const ASSET_OPTIONS: { value: AssetId; label: string }[] = [
  { value: 'BTC', label: 'BTC' },
  { value: 'ETH', label: 'ETH' },
  { value: 'USDC', label: 'USDC' },
  { value: 'VERI', label: 'VERI' },
];
