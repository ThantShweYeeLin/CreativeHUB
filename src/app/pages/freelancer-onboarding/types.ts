export const AVAILABILITY_OPTIONS = ['Available', 'Busy', 'Unavailable'] as const;
export const WORKING_DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
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

export function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
