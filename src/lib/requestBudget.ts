export interface BudgetMeta {
  currency: string;
  min: number;
  max: number;
}

const BUDGET_META_PATTERN = /\[\[BUDGET_META:([A-Z]{3}):(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)\]\]/;

export const SUPPORTED_CURRENCIES = [
  { code: 'THB', label: 'Thai Baht' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'SGD', label: 'Singapore Dollar' },
] as const;

export function inferCurrencyFromLocation(location: string | null | undefined) {
  const normalized = (location || '').toLowerCase();

  if (normalized.includes('thailand') || normalized.includes('bangkok') || normalized.includes('chiang')) {
    return 'THB';
  }

  if (normalized.includes('united states') || normalized.includes('usa') || normalized.includes('california') || normalized.includes('new york')) {
    return 'USD';
  }

  if (normalized.includes('singapore')) {
    return 'SGD';
  }

  if (normalized.includes('japan') || normalized.includes('tokyo') || normalized.includes('osaka')) {
    return 'JPY';
  }

  if (normalized.includes('united kingdom') || normalized.includes('uk') || normalized.includes('london')) {
    return 'GBP';
  }

  if (normalized.includes('germany') || normalized.includes('france') || normalized.includes('spain') || normalized.includes('italy') || normalized.includes('europe')) {
    return 'EUR';
  }

  return 'THB';
}

export function buildBudgetMetaTag(meta: BudgetMeta) {
  return `[[BUDGET_META:${meta.currency}:${meta.min}:${meta.max}]]`;
}

export function appendBudgetMeta(message: string, meta: BudgetMeta) {
  return `${message.trim()}\n\n${buildBudgetMetaTag(meta)}`;
}

export function extractBudgetMeta(...texts: Array<string | null | undefined>) {
  for (const text of texts) {
    const source = text || '';
    const match = source.match(BUDGET_META_PATTERN);
    if (match) {
      const currency = match[1];
      const min = Number(match[2]);
      const max = Number(match[3]);

      if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
        return { currency, min, max } satisfies BudgetMeta;
      }
    }
  }

  return null;
}

export function stripBudgetMeta(text: string | null | undefined) {
  return (text || '').replace(BUDGET_META_PATTERN, '').trim();
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatBudgetRange(meta: BudgetMeta) {
  return `${formatMoney(meta.min, meta.currency)} - ${formatMoney(meta.max, meta.currency)}`;
}
