/**
 * Parse amount safely from various input types
 */
export const parseAmount = (value: any): number => {
  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isFinite(parsed) ? parsed : 0;
  }
  
  if (value && typeof value === 'object' && value.amount !== undefined) {
    return parseAmount(value.amount);
  }
  
  return 0;
};

/**
 * Calculate exchange rate between two amounts
 */
export const calculateRate = (fromAmount: number, toAmount: number): string => {
  if (!fromAmount || !toAmount || !isFinite(fromAmount) || !isFinite(toAmount) || fromAmount <= 0) {
    return 'N/A';
  }
  
  const rate = toAmount / fromAmount;
  if (!isFinite(rate)) {
    return 'N/A';
  }
  
  // Format rate with appropriate decimals based on magnitude
  let decimals = 4;
  if (rate >= 1000) decimals = 2;
  else if (rate >= 100) decimals = 3;
  else if (rate < 0.0001) decimals = 8;
  
  return rate.toFixed(decimals);
};

