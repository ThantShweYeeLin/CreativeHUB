import type { Gender } from './database.types';

export const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'lgbtq_plus', label: 'LGBTQ+' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export function genderLabel(gender?: Gender | string | null): string | null {
  return GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? null;
}

// Not set, or explicitly "Prefer not to say", should never be shown on the
// public profile - same privacy rule as pronouns (see lib/pronouns.ts).
export function shouldDisplayGender(gender?: Gender | string | null): boolean {
  return Boolean(gender && gender !== 'prefer_not_to_say');
}
