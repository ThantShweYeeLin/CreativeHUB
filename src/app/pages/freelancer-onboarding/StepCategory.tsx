import { FREELANCER_CATEGORIES } from '../../../lib/categories';

interface StepCategoryProps {
  selectedCategory: string | null;
  onSelectCategory: (label: string) => void;
}

export function StepCategory({ selectedCategory, onSelectCategory }: StepCategoryProps) {
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
    </div>
  );
}
