import { FREELANCER_CATEGORIES } from '../../../lib/categories';
import { ExperienceLevelPicker } from '../../../components/common/ExperienceLevelPicker';

interface StepCategoryProps {
  selectedCategory: string | null;
  onSelectCategory: (label: string) => void;
  experienceLevel: string | null;
  onExperienceLevelChange: (level: string) => void;
  selectedMinorCategory: string | null;
  onSelectMinorCategory: (label: string | null) => void;
}

export function StepCategory({
  selectedCategory,
  onSelectCategory,
  experienceLevel,
  onExperienceLevelChange,
  selectedMinorCategory,
  onSelectMinorCategory,
}: StepCategoryProps) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-gray-700">What's your freelancer category?</p>
      <p className="mb-4 text-xs text-gray-500">Pick the one that best describes your services — this determines the Skills and Styles you'll choose next.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {FREELANCER_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.label)}
            className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
              selectedCategory === category.label
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-400'
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
          <p className="mb-1 text-sm font-semibold text-gray-700">Minor category (optional)</p>
          <p className="mb-3 text-xs text-gray-500">
            Also provide services in a second area? We'll include its Skills and Styles as suggestions too.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {FREELANCER_CATEGORIES.filter((category) => category.label !== selectedCategory).map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectMinorCategory(selectedMinorCategory === category.label ? null : category.label)}
                className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                  selectedMinorCategory === category.label
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
