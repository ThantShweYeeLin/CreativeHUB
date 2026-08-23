export interface CurrencyConfig {
  code: string;
  symbol: string;
  label: string;
  rateFromUsd: number;
}

// rateFromUsd means: 1 USD = rateFromUsd units of that currency.
export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: 'THB', symbol: '฿', label: 'Thai Baht', rateFromUsd: 36 },
  { code: 'USD', symbol: '$', label: 'US Dollar', rateFromUsd: 1 },
  { code: 'EUR', symbol: '€', label: 'Euro', rateFromUsd: 0.92 },
  { code: 'GBP', symbol: '£', label: 'British Pound', rateFromUsd: 0.78 },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen', rateFromUsd: 160 },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar', rateFromUsd: 1.34 },
  { code: 'MYR', symbol: 'RM', label: 'Malaysian Ringgit', rateFromUsd: 4.7 },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', rateFromUsd: 1.52 },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar', rateFromUsd: 1.37 },
  { code: 'MMK', symbol: 'K', label: 'Myanmar Kyat', rateFromUsd: 2100 },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee', rateFromUsd: 83.4 },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan', rateFromUsd: 7.26 },
];

const DEFAULT_CURRENCY = 'THB';

const currencyByCode = new Map(SUPPORTED_CURRENCIES.map((item) => [item.code, item]));

export function normalizeCurrencyCode(value: string | null | undefined, fallback = DEFAULT_CURRENCY) {
  const normalized = (value || '').trim().toUpperCase();
  return normalized || fallback;
}

export function getSupportedCurrencyCodes() {
  return SUPPORTED_CURRENCIES.map((item) => item.code);
}

export function getCurrencySymbol(currencyCode: string | null | undefined) {
  const code = normalizeCurrencyCode(currencyCode);
  return currencyByCode.get(code)?.symbol || `${code} `;
}

export function isSupportedCurrency(currencyCode: string | null | undefined) {
  return currencyByCode.has(normalizeCurrencyCode(currencyCode));
}

export function convertAmount(amount: number, fromCurrency: string, toCurrency: string) {
  const safeAmount = Number(amount || 0);
  const fromCode = normalizeCurrencyCode(fromCurrency);
  const toCode = normalizeCurrencyCode(toCurrency);

  if (!Number.isFinite(safeAmount) || fromCode === toCode) {
    return safeAmount;
  }

  const fromRate = currencyByCode.get(fromCode)?.rateFromUsd;
  const toRate = currencyByCode.get(toCode)?.rateFromUsd;

  if (!fromRate || !toRate) {
    return safeAmount;
  }

  const amountInUsd = safeAmount / fromRate;
  return amountInUsd * toRate;
}

export function formatCurrencyAmount(amount: number, currencyCode: string, maximumFractionDigits = 0) {
  const safeAmount = Number(amount || 0);
  const code = normalizeCurrencyCode(currencyCode);

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits,
    }).format(safeAmount);
  } catch {
    const symbol = getCurrencySymbol(code);
    const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(safeAmount);
    return `${symbol}${formatted}`;
  }
}
