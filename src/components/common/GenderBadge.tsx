import type { Gender } from '../../lib/database.types';

// Pronouns are stated as text on profile pages rather than shown as a
// male/female symbol badge on avatar icons throughout the app.
export const GENDER_META: Record<Gender, { label: string; pronoun: string; className: string }> = {
  male: { label: 'Male', pronoun: 'He / Him', className: 'bg-blue-500 text-white' },
  female: { label: 'Female', pronoun: 'She / Her', className: 'bg-pink-500 text-white' },
  lgbtq_plus: { label: 'LGBTQ+', pronoun: 'They / Them', className: 'bg-gradient-to-br from-purple-500 via-pink-500 to-amber-400 text-white' },
  prefer_not_to_say: { label: 'Prefer not to say', pronoun: '', className: 'bg-gray-400 text-white' },
};

export const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'lgbtq_plus', label: 'LGBTQ+' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const GENDER_SIZE_CLASSES = {
  xs: 'w-3 h-3 text-[7px]',
  sm: 'w-4 h-4 text-[9px]',
  md: 'w-5 h-5 text-[11px]',
};

export const GENDER_POSITION_CLASSES = {
  'bottom-right': '-bottom-0.5 -right-0.5',
  'top-right': '-top-0.5 -right-0.5',
  'top-left': '-top-0.5 -left-0.5',
};

export function getPronounLabel(gender?: Gender | null): string | null {
  if (!gender) return null;
  const pronoun = GENDER_META[gender]?.pronoun;
  return pronoun || null;
}
