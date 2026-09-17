// Tokenizes card details directly against Omise from the browser via
// Omise.js — the card number never touches our own server, only the
// resulting one-time token does. Matches how the app already avoids
// storing/transmitting real card data (see DataService's payment_methods
// comment) instead of hand-rolling a form that posts card fields to Express.

declare global {
  interface Window {
    Omise?: {
      setPublicKey: (key: string) => void;
      createToken: (
        type: 'card',
        card: {
          name: string;
          number: string;
          expiration_month: number;
          expiration_year: number;
          security_code: string;
        },
        callback: (statusCode: number, response: OmiseTokenResponse) => void
      ) => void;
    };
  }
}

interface OmiseTokenResponse {
  object: 'token' | 'error';
  id?: string;
  card?: { security_code_check: boolean };
  message?: string;
  code?: string;
}

export interface CardDetails {
  name: string;
  number: string;
  expirationMonth: number;
  expirationYear: number;
  securityCode: string;
}

const OMISE_JS_URL = 'https://cdn.omise.co/omise.js';
let loadPromise: Promise<void> | null = null;

function loadOmiseJs(): Promise<void> {
  if (window.Omise) {
    return Promise.resolve();
  }
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = OMISE_JS_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Unable to load the payment library. Check your connection and try again.'));
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}

/** Turns raw card details into a one-time Omise token id (e.g. "tokn_test_..."), ready to send to our /api/payments/charge endpoint. */
export async function tokenizeCard(card: CardDetails): Promise<string> {
  const publicKey = import.meta.env.VITE_OMISE_PUBLIC_KEY as string | undefined;
  if (!publicKey) {
    throw new Error('Payments are not configured yet.');
  }

  await loadOmiseJs();
  window.Omise!.setPublicKey(publicKey);

  return new Promise((resolve, reject) => {
    window.Omise!.createToken(
      'card',
      {
        name: card.name,
        number: card.number.replace(/\s+/g, ''),
        expiration_month: card.expirationMonth,
        expiration_year: card.expirationYear,
        security_code: card.securityCode,
      },
      (statusCode, response) => {
        if (statusCode !== 200 || response.object === 'error' || !response.id) {
          reject(new Error(response.message || 'Unable to verify this card.'));
          return;
        }
        resolve(response.id);
      }
    );
  });
}
