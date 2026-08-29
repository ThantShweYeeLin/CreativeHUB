export const EXPERIENCE_YEAR_OPTIONS = ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', '10+ years'] as const;
export const EXPERIENCE_LEVEL_OPTIONS = ['Beginner', 'Intermediate', 'Professional', 'Expert'] as const;
export const AVAILABILITY_OPTIONS = ['Available', 'Busy', 'Unavailable'] as const;
export const WORKING_DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const SERVICE_AREA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'local', label: 'Local area only' },
  { value: 'city', label: 'Within my city' },
  { value: 'country', label: 'Anywhere in the country' },
  { value: 'international', label: 'Willing to travel internationally' },
];
export const SERVICE_RADIUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '5', label: '5 km' },
  { value: '10', label: '10 km' },
  { value: '25', label: '25 km' },
  { value: '50', label: '50 km' },
  { value: 'anywhere', label: 'Anywhere' },
];
export const PRICING_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'per_project', label: 'Per Project' },
  { value: 'custom_quote', label: 'Custom Quote' },
];
export const LIMITATION_DAY_OPTIONS = ['Weekdays', 'Weekends', 'Public holidays'] as const;
export const CONTACT_PREFERENCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'creativehub_messages', label: 'CreativeHUB Messages (recommended)' },
  { value: 'email', label: 'Email' },
];

export function parseExperienceYears(value: string) {
  switch (value) {
    case 'Less than 1 year':
      return 0;
    case '1-3 years':
      return 2;
    case '3-5 years':
      return 4;
    case '5-10 years':
      return 7;
    case '10+ years':
      return 10;
    default:
      return 0;
  }
}

export function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
