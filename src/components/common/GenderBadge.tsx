import type { Gender } from '../../lib/database.types';

export const GENDER_META: Record<Gender, { label: string; symbol: string; className: string }> = {
  male: { label: 'Male', symbol: '♂', className: 'bg-blue-500 text-white' },
  female: { label: 'Female', symbol: '♀', className: 'bg-pink-500 text-white' },
  lgbtq_plus: { label: 'LGBTQ+', symbol: '⚧', className: 'bg-gradient-to-br from-purple-500 via-pink-500 to-amber-400 text-white' },
  prefer_not_to_say: { label: 'Prefer not to say', symbol: '–', className: 'bg-gray-400 text-white' },
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

const SIZE_CLASSES = GENDER_SIZE_CLASSES;
const POSITION_CLASSES = GENDER_POSITION_CLASSES;

interface GenderBadgeProps {
  gender?: Gender | null;
  size?: keyof typeof SIZE_CLASSES;
  position?: keyof typeof POSITION_CLASSES;
  className?: string;
}

export function GenderBadge({ gender, size = 'sm', position = 'bottom-right', className = '' }: GenderBadgeProps) {
  if (!gender) {
    return null;
  }

  const meta = GENDER_META[gender] || GENDER_META.prefer_not_to_say;

  return (
    <span
      title={meta.label}
      aria-label={meta.label}
      className={`absolute flex items-center justify-center rounded-full ring-2 ring-white leading-none font-bold ${POSITION_CLASSES[position]} ${SIZE_CLASSES[size]} ${meta.className} ${className}`}
    >
      {meta.symbol}
    </span>
  );
}

export default GenderBadge;
