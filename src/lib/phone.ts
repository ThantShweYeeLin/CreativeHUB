import { parsePhoneNumberFromString, getCountryCallingCode as libGetCountryCallingCode, type CountryCode } from 'libphonenumber-js';

/** "+66", "+95", "+1" — the international calling code for a country, or null if libphonenumber-js has no metadata for it. */
export function getCountryCallingCode(isoCode: string | null | undefined): string | null {
  if (!isoCode) return null;
  try {
    return `+${libGetCountryCallingCode(isoCode as CountryCode)}`;
  } catch {
    return null;
  }
}

export interface PhoneValidationResult {
  isValid: boolean;
  /** E.164 format, e.g. "+66812345678" — null unless isValid. */
  e164: string | null;
}

/**
 * Validates a phone number against a specific country and normalizes it to
 * E.164. Correctly drops a Thai local leading "0" (0812345678 -> +66812345678)
 * and equivalent national-prefix conventions in other countries — this is
 * libphonenumber-js's job, not manual string surgery.
 */
export function validatePhoneForCountry(rawNumber: string, isoCode: string | null | undefined): PhoneValidationResult {
  if (!rawNumber.trim() || !isoCode) return { isValid: false, e164: null };

  const phone = parsePhoneNumberFromString(rawNumber, isoCode as CountryCode);
  if (!phone || !phone.isValid()) return { isValid: false, e164: null };

  return { isValid: true, e164: phone.number };
}

/** Formats an already-stored E.164 number for display, e.g. "+66812345678" -> "+66 81 234 5678". */
export function formatPhoneForDisplay(e164: string | null | undefined): string {
  if (!e164) return '';
  const phone = parsePhoneNumberFromString(e164);
  return phone ? phone.formatInternational() : e164;
}
