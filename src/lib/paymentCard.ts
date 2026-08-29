export interface CardDetailsInput {
  cardholderName: string;
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

export function detectCardBrand(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '');
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^6(?:011|5)/.test(digits)) return 'Discover';
  return 'Card';
}

export function formatCardNumberInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function luhnCheck(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function validateCardDetails(input: CardDetailsInput): string | null {
  const digits = input.cardNumber.replace(/\D/g, '');

  if (!input.cardholderName.trim()) return 'Enter the cardholder name.';
  if (digits.length < 13 || digits.length > 19) return 'Enter a valid card number.';
  if (!luhnCheck(digits)) return 'This card number looks invalid.';
  if (!input.expMonth || input.expMonth < 1 || input.expMonth > 12) return 'Enter a valid expiry month.';
  if (!input.expYear) return 'Enter a valid expiry year.';

  const now = new Date();
  const expiry = new Date(input.expYear, input.expMonth, 0, 23, 59, 59);
  if (expiry < now) return 'This card has expired.';

  if (!/^\d{3,4}$/.test(input.cvc)) return 'Enter a valid security code.';

  return null;
}

export function last4Of(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '');
  return digits.slice(-4);
}

export function formatCardLabel(method: { brand: string; last4: string }): string {
  return `${method.brand} •••• ${method.last4}`;
}
