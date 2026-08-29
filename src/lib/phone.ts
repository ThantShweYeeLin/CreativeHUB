// Lightweight phone validation — CreativeHUB targets Thailand primarily but
// doesn't want to block international users, so this accepts:
//   - Thai mobile/landline numbers: 0XXXXXXXXX (10 digits, starts with 0) or
//     +66XXXXXXXXX (Thai country code form of the same number)
//   - General international numbers: + followed by 8-15 digits (E.164-ish)
// Formatting characters (spaces, dashes, parentheses) are stripped before
// validation so "081-234-5678" and "0812345678" both pass.
const THAI_LOCAL_PATTERN = /^0\d{9}$/;
const THAI_INTL_PATTERN = /^\+66\d{9}$/;
const GENERAL_INTL_PATTERN = /^\+\d{8,15}$/;

export function isValidPhoneNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const stripped = trimmed.replace(/[\s\-().]/g, '');
  return THAI_LOCAL_PATTERN.test(stripped) || THAI_INTL_PATTERN.test(stripped) || GENERAL_INTL_PATTERN.test(stripped);
}

/** Strips formatting characters for storage — keeps the leading "+" for international numbers. */
export function normalizePhoneNumber(value: string): string {
  return value.trim().replace(/[\s\-().]/g, '');
}
