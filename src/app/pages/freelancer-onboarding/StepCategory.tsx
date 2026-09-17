import { FREELANCER_CATEGORIES, MAX_MINOR_CATEGORIES } from '../../../lib/categories';
import { ExperienceLevelPicker } from '../../../components/common/ExperienceLevelPicker';

interface StepCategoryProps {
  selectedCategory: string | null;
  onSelectCategory: (label: string) => void;
  experienceLevel: string | null;
  onExperienceLevelChange: (level: string) => void;
  selectedMinorCategories: string[];
  onToggleMinorCategory: (label: string) => void;
  minorCategoryExperienceLevels: Record<string, string>;
  onMinorCategoryExperienceLevelChange: (category: string, level: string) => void;
}

export function StepCategory({
  selectedCategory,
  onSelectCategory,
  experienceLevel,
  onExperienceLevelChange,
  selectedMinorCategories,
  onToggleMinorCategory,
  minorCategoryExperienceLevels,
  onMinorCategoryExperienceLevelChange,
}: StepCategoryProps) {
  const atMinorCategoryLimit = selectedMinorCategories.length >= MAX_MINOR_CATEGORIES;

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-gray-700">What's your specialty?</p>
      <p className="mb-4 text-xs text-gray-500">Pick the one that best describes your services — this determines the Skills and Styles you'll choose next.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {FREELANCER_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.label)}
            className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
              selectedCategory === category.label
                ? 'border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 text-white'
                : 'border-sky-100 text-gray-600 hover:border-sky-300'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {selectedCategory && (
        <div className="mt-5">
          <ExperienceLevelPicker
            label={`Your experience level as a ${selectedCategory} (optional)`}
            value={experienceLevel}
            onChange={onExperienceLevelChange}
          />
        </div>
      )}

      {selectedCategory && (
        <div className="mt-6">
          <p className="mb-1 text-sm font-semibold text-gray-700">Also skilled in (optional)</p>
          <p className="mb-3 text-xs text-gray-500">
            Also provide services in other areas? Select up to {MAX_MINOR_CATEGORIES} — we'll include each one's Skills and Styles as suggestions too.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {FREELANCER_CATEGORIES.filter((category) => category.label !== selectedCategory).map((category) => {
              const isSelected = selectedMinorCategories.includes(category.label);
              const isDisabled = !isSelected && atMinorCategoryLimit;
              return (
                <button
                  key={category.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onToggleMinorCategory(category.label)}
                  className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                    isSelected
                      ? 'border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 text-white'
                      : isDisabled
                        ? 'cursor-not-allowed border-sky-100 bg-sky-50 text-gray-300'
                        : 'border-sky-100 text-gray-600 hover:border-sky-300'
                  }`}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
          {atMinorCategoryLimit && (
            <p className="mt-2 text-xs font-semibold text-amber-700">You've selected the maximum of {MAX_MINOR_CATEGORIES} additional specialties.</p>
          )}

          {selectedMinorCategories.length > 0 && (
            <div className="mt-5 space-y-4">
              {selectedMinorCategories.map((minorCategory) => (
                <ExperienceLevelPicker
                  key={minorCategory}
                  label={`Your experience level as a ${minorCategory} (optional)`}
                  value={minorCategoryExperienceLevels[minorCategory] || null}
                  onChange={(level) => onMinorCategoryExperienceLevelChange(minorCategory, level)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
