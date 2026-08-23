import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { DataService } from '../lib/dataService';
import { convertAmount, formatCurrencyAmount, getCurrencySymbol, normalizeCurrencyCode } from '../lib/currency';

interface CurrencyContextValue {
  currency: string;
  symbol: string;
  loading: boolean;
  setCurrency: (currencyCode: string, persist?: boolean) => Promise<void>;
  formatAmount: (amount: number, sourceCurrency?: string) => string;
}

const CURRENCY_STORAGE_KEY = 'creativehub.preferred-currency';

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState('THB');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrency() {
      const localCurrency = normalizeCurrencyCode(localStorage.getItem(CURRENCY_STORAGE_KEY), 'THB');

      if (!user?.id) {
        if (isMounted) {
          setCurrencyState(localCurrency);
          setLoading(false);
        }
        return;
      }

      const response = await DataService.getUser(user.id);
      if (!isMounted) {
        return;
      }

      const fromProfile = normalizeCurrencyCode((response.data as any)?.preferred_currency, localCurrency);
      setCurrencyState(fromProfile);
      localStorage.setItem(CURRENCY_STORAGE_KEY, fromProfile);
      setLoading(false);
    }

    setLoading(true);
    void loadCurrency();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const setCurrency = async (currencyCode: string, persist = true) => {
    const normalized = normalizeCurrencyCode(currencyCode, 'THB');
    setCurrencyState(normalized);
    localStorage.setItem(CURRENCY_STORAGE_KEY, normalized);

    if (persist && user?.id) {
      await DataService.updateUser(user.id, {
        preferred_currency: normalized,
        updated_at: new Date().toISOString(),
      } as any);
    }
  };

  const value: CurrencyContextValue = {
    currency,
    symbol: getCurrencySymbol(currency),
    loading,
    setCurrency,
    formatAmount: (amount: number, sourceCurrency?: string) => {
      const from = normalizeCurrencyCode(sourceCurrency, currency);
      if (from === currency) {
        return formatCurrencyAmount(amount, currency);
      }

      const converted = convertAmount(amount, from, currency);
      return formatCurrencyAmount(converted, currency);
    },
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
}
