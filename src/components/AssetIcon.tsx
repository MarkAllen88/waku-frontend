// src/components/AssetIcon.tsx

import React from 'react';
import type { AssetId } from '../types';

interface AssetIconProps {
  assetId: AssetId | string; // Allow string for graceful handling of unknown assets
  className?: string;
}

/**
 * Renders the appropriate icon for a given assetId.
 * This component replaces the old `getAssetDisplay` function and
 * is aligned with the assets used in the application (BTC, ETH, USDC, VERI).
 */
export const AssetIcon: React.FC<AssetIconProps> = ({ assetId, className = "w-4 h-4" }) => {
  const assetUpper = assetId.toString().toUpperCase();

  switch (assetUpper) {
    case 'BTC':
    case 'BITCOIN':
      return <div className={`${className} bg-orange-500 rounded-full`} />;
    case 'ETH':
    case 'ETHEREUM':
      return <div className={`${className} bg-gray-400 rounded-full`} />;
    case 'USDC':
    case 'USD':
      return <div className={`${className} bg-blue-500 rounded-full`} />;
    case 'VERI':
    case 'VERITASEUM':
      return <img src="https://activate.veri.vip/favicon.svg" alt="VERI" className={className} />;
    default:
      return <div className={`${className} bg-gray-500 rounded-full`} />;
  }
};
