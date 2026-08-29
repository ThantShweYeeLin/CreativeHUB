import { useEffect, useState } from 'react';
import { findCountryByCode, type CountryOption } from '../../lib/geoData';
import { getCountryCallingCode } from '../../lib/phone';

interface PhoneInputProps {
  /** ISO country code the calling-code prefix is derived from — kept in sync with the page's Country field by the caller. */
  countryIsoCode: string | null;
  /** The national-format number as typed, e.g. "081 234 5678" — NOT E.164. Validate/normalize separately via lib/phone's validatePhoneForCountry. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * "[flag +66 ▼] [81 234 5678]" phone field. The prefix pill is read-only —
 * it syncs from whichever country is selected elsewhere on the page rather
 * than offering its own separate country picker, so the two can never
 * disagree (per product decision: signup's phone code always follows the
 * Country field).
 */
export function PhoneInput({ countryIsoCode, value, onChange, placeholder = '81 234 5678', required }: PhoneInputProps) {
  const [country, setCountry] = useState<CountryOption | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    findCountryByCode(countryIsoCode).then((resolved) => {
      if (!cancelled) setCountry(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [countryIsoCode]);

  const callingCode = getCountryCallingCode(countryIsoCode);

  return (
    <div className="flex gap-2">
      <div
        className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700"
        title={country ? `${country.name} calling code` : 'Select a country first'}
      >
        {country ? (
          <>
            <span className="text-base">{country.flag}</span>
            <span>{callingCode ?? '—'}</span>
          </>
        ) : (
          <span className="text-gray-400">+--</span>
        )}
      </div>
      <input
        type="tel"
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
    </div>
  );
}
