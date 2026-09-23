import { TagSelector } from '../../../components/common/TagSelector';
import { MUSICIAN_CATEGORY_LABEL, suggestedPerformerTypesForCategory, suggestedStylesForCategory } from '../../../lib/categories';

interface StepStylesProps {
  category: string | null;
  styles: string[];
  onStylesChange: (styles: string[]) => void;
  minorCategories: string[];
  minorCategoryStylesByCategory: Record<string, string[]>;
  onMinorCategoryStylesChange: (category: string, styles: string[]) => void;
  onRemoveMinorCategory: (category: string) => void;
  performerType?: string[];
  onPerformerTypeChange?: (performerType: string[]) => void;
  minorCategoryPerformerTypeByCategory: Record<string, string[]>;
  onMinorCategoryPerformerTypeChange: (category: string, performerType: string[]) => void;
}

export function StepStyles({
  category,
  styles,
  onStylesChange,
  minorCategories,
  minorCategoryStylesByCategory,
  onMinorCategoryStylesChange,
  onRemoveMinorCategory,
  performerType = [],
  onPerformerTypeChange,
  minorCategoryPerformerTypeByCategory,
  onMinorCategoryPerformerTypeChange,
}: StepStylesProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-sm font-semibold text-gray-700">Styles{category ? ` for ${category}` : ''}</p>
        <p className="mb-4 text-xs text-gray-500">What your work looks like. Clients search and filter by these styles.</p>
        <TagSelector
          suggestions={suggestedStylesForCategory(category)}
          selected={styles}
          onChange={onStylesChange}
          otherPlaceholder="e.g. Fantasy Fairy Makeup"
        />
      </div>

      {category === MUSICIAN_CATEGORY_LABEL && onPerformerTypeChange && (
        <div>
          <p className="mb-1 text-sm font-semibold text-gray-700">Performer type</p>
          <p className="mb-4 text-xs text-gray-500">How you perform — separate from genre, so clients can filter by both.</p>
          <TagSelector
            suggestions={suggestedPerformerTypesForCategory(category)}
            selected={performerType}
            onChange={onPerformerTypeChange}
            otherPlaceholder="e.g. String Quartet"
          />
        </div>
      )}

      {minorCategories.map((minorCategory) => (
        <div key={minorCategory}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-700">Styles for {minorCategory}</p>
            <button
              type="button"
              onClick={() => onRemoveMinorCategory(minorCategory)}
              className="text-xs font-semibold text-gray-400 hover:text-red-600"
            >
              Not a specialty? Remove
            </button>
          </div>
          <p className="mb-4 text-xs text-gray-500">The specialty you're also skilled in — select the styles that apply here too.</p>
          <TagSelector
            suggestions={suggestedStylesForCategory(minorCategory)}
            selected={minorCategoryStylesByCategory[minorCategory] || []}
            onChange={(next) => onMinorCategoryStylesChange(minorCategory, next)}
            otherPlaceholder="e.g. Fantasy Fairy Makeup"
          />

          {minorCategory === MUSICIAN_CATEGORY_LABEL && (
            <div className="mt-4">
              <p className="mb-1 text-sm font-semibold text-gray-700">Performer type for {minorCategory}</p>
              <p className="mb-4 text-xs text-gray-500">How you perform in this specialty.</p>
              <TagSelector
                suggestions={suggestedPerformerTypesForCategory(minorCategory)}
                selected={minorCategoryPerformerTypeByCategory[minorCategory] || []}
                onChange={(next) => onMinorCategoryPerformerTypeChange(minorCategory, next)}
                otherPlaceholder="e.g. String Quartet"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
