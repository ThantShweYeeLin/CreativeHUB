// Card-form helpers for the DEMO payment mode (server/src/lib/demoPayments.ts).
// Formatting/validation only - a full card number never leaves the browser in
// demo mode: the server receives a token with brand, last four, expiry and a
// simulated outcome.

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'jcb' | 'unionpay' | 'card';

export const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', jcb: 'JCB', unionpay: 'UnionPay', card: 'Card',
};

export const digitsOnly = (value: string) => value.replace(/\D/g, '');

export function detectBrand(number: string): CardBrand {
  const n = digitsOnly(number);
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]|[3-6]|7[01]|720))/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^35(2[89]|[3-8])/.test(n)) return 'jcb';
  if (/^62/.test(n)) return 'unionpay';
  return 'card';
}

export function formatCardNumber(value: string): string {
  const brand = detectBrand(value);
  const n = digitsOnly(value).slice(0, brand === 'amex' ? 15 : 16);
  return brand === 'amex'
    ? [n.slice(0, 4), n.slice(4, 10), n.slice(10)].filter(Boolean).join(' ')
    : (n.match(/.{1,4}/g) || []).join(' ');
}

export function luhnValid(number: string): boolean {
  const n = digitsOnly(number);
  if (n.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

export function formatExpiry(value: string): string {
  const d = digitsOnly(value).slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function parseExpiry(value: string): { month: number; year: number } | null {
  const m = value.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return null;
  return { month, year: 2000 + Number(m[2]) };
}

export function expiryInPast(exp: { month: number; year: number }, now = new Date()): boolean {
  return exp.year < now.getFullYear() || (exp.year === now.getFullYear() && exp.month < now.getMonth() + 1);
}

export const cvcLength = (brand: CardBrand) => (brand === 'amex' ? 4 : 3);

export interface CardFormValues { name: string; number: string; expiry: string; cvc: string }
export interface CardFormErrors { name?: string; number?: string; expiry?: string; cvc?: string }

export function validateCardForm(values: CardFormValues, now = new Date()): CardFormErrors {
  const errors: CardFormErrors = {};
  const brand = detectBrand(values.number);
  if (values.name.trim().length < 2) errors.name = 'Enter the name on your card.';
  if (!luhnValid(values.number)) errors.number = 'That card number doesn’t look right.';
  const exp = parseExpiry(values.expiry);
  if (!exp) errors.expiry = 'Use MM/YY.';
  else if (expiryInPast(exp, now)) errors.expiry = 'This card has expired.';
  if (digitsOnly(values.cvc).length !== cvcLength(brand)) errors.cvc = `${cvcLength(brand)} digits.`;
  return errors;
}

// Well-known test numbers (same idea as a payment provider's test cards).
const DEMO_OUTCOMES: Record<string, 'declined' | 'insufficient_funds' | 'expired_card' | 'processing_error'> = {
  '4000000000000002': 'declined',
  '4000000000009995': 'insufficient_funds',
  '4000000000000069': 'expired_card',
  '4000000000000119': 'processing_error',
};

export function createDemoToken(values: CardFormValues): string {
  const number = digitsOnly(values.number);
  const exp = parseExpiry(values.expiry)!;
  const payload = {
    brand: BRAND_LABEL[detectBrand(number)],
    last4: number.slice(-4),
    expMonth: exp.month,
    expYear: exp.year,
    outcome: DEMO_OUTCOMES[number] || 'success',
  };
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `demo_tok_${b64}`;
}
