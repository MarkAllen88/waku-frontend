/**
 * Format price with specified decimal places
 */
export const formatPrice = (price: number | null | undefined, decimals: number = 2): string => {
  if (price == null) return "0.00";
  return price.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Format price change percentage with sign
 */
export const formatChange = (change: number | null | undefined): string => {
  if (change == null) return "0.00";
  return (change >= 0 ? '+' : '') + change.toFixed(2);
};

/**
 * Format timestamp from nanoseconds to human readable
 */
export const formatDate = (timestamp?: string): string => {
  try {
    if (!timestamp) return "";
    const ns = BigInt(timestamp);
    const ms = Number(ns / 1000000n);
    return new Date(ms).toLocaleString();
  } catch {
    return "";
  }
};

