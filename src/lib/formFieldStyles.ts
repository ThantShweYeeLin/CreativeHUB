// Shared field/chip/input style tokens for filter- and form-style screens
// (Event Matcher, Advanced Filters, and any future one). Both pages used to
// hand-copy these values independently and kept drifting apart — pull from
// here instead of retyping the literal classes so a future third page
// can't repeat the same drift.
export const FIELD_LABEL_CLASS = 'text-sm font-semibold text-gray-900';

export const CHIP_BASE_CLASS = 'rounded-full px-5 py-2.5 text-sm transition-all';
export const CHIP_SELECTED_CLASS = 'border-2 border-gray-900 font-bold text-gray-900';
export const CHIP_UNSELECTED_CLASS = 'border border-gray-200 font-medium text-gray-600 hover:border-gray-400';

/** Toggle-chip className for the given selection state, with any extra classes (icon gap, disabled state, etc.) appended. */
export function chipClass(isSelected: boolean, extraClasses = ''): string {
  return `${CHIP_BASE_CLASS} ${isSelected ? CHIP_SELECTED_CLASS : CHIP_UNSELECTED_CLASS} ${extraClasses}`.trim();
}

export const INPUT_CONTAINER_CLASS =
  'rounded-2xl border border-gray-200 bg-white px-4 py-3.5 focus-within:ring-2 focus-within:ring-gray-900';

export const FIELD_SECTION_SPACING_CLASS = 'space-y-6';
