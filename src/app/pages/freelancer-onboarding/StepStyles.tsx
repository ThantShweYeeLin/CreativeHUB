import { TagSelector } from '../../../components/common/TagSelector';
import { MUSICIAN_CATEGORY_LABEL, suggestedPerformerTypesForCategory, suggestedStylesForCategory } from '../../../lib/categories';

interface StepStylesProps {
  category: string | null;
  styles: string[];
  onStylesChange: (styles: string[]) => void;
  minorCategory?: string | null;
  minorCategoryStyles?: string[];
  onMinorCategoryStylesChange?: (styles: string[]) => void;
  performerType?: string[];
  onPerformerTypeChange?: (performerType: string[]) => void;
  minorCategoryPerformerType?: string[];
  onMinorCategoryPerformerTypeChange?: (performerType: string[]) => void;
}

export function StepStyles({
  category,
  styles,
  onStylesChange,
  minorCategory,
  minorCategoryStyles = [],
  onMinorCategoryStylesChange,
  performerType = [],
  onPerformerTypeChange,
  minorCategoryPerformerType = [],
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

      {minorCategory && onMinorCategoryStylesChange && (
        <div>
          <p className="mb-1 text-sm font-semibold text-gray-700">Styles for {minorCategory}</p>
          <p className="mb-4 text-xs text-gray-500">Your minor category — select the styles that apply here too.</p>
          <TagSelector
            suggestions={suggestedStylesForCategory(minorCategory)}
            selected={minorCategoryStyles}
            onChange={onMinorCategoryStylesChange}
            otherPlaceholder="e.g. Fantasy Fairy Makeup"
          />
        </div>
      )}

      {minorCategory === MUSICIAN_CATEGORY_LABEL && onMinorCategoryPerformerTypeChange && (
        <div>
          <p className="mb-1 text-sm font-semibold text-gray-700">Performer type for {minorCategory}</p>
          <p className="mb-4 text-xs text-gray-500">How you perform in this minor category.</p>
          <TagSelector
            suggestions={suggestedPerformerTypesForCategory(minorCategory)}
            selected={minorCategoryPerformerType}
            onChange={onMinorCategoryPerformerTypeChange}
            otherPlaceholder="e.g. String Quartet"
          />
        </div>
      )}
    </div>
  );
}
