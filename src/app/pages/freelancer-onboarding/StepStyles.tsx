import { TagSelector } from '../../../components/common/TagSelector';
import { suggestedStylesForCategory } from '../../../lib/categories';

interface StepStylesProps {
  category: string | null;
  styles: string[];
  onStylesChange: (styles: string[]) => void;
  minorCategory?: string | null;
  minorCategoryStyles?: string[];
  onMinorCategoryStylesChange?: (styles: string[]) => void;
}

export function StepStyles({
  category,
  styles,
  onStylesChange,
  minorCategory,
  minorCategoryStyles = [],
  onMinorCategoryStylesChange,
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
    </div>
  );
}
