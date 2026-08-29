import { TagSelector } from '../../../components/common/TagSelector';
import { suggestedStylesForCategory } from '../../../lib/categories';

interface StepStylesProps {
  category: string | null;
  styles: string[];
  onStylesChange: (styles: string[]) => void;
}

export function StepStyles({ category, styles, onStylesChange }: StepStylesProps) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-gray-700">Styles</p>
      <p className="mb-4 text-xs text-gray-500">What your work looks like. The AI Matcher uses these to find you from an inspiration photo.</p>
      <TagSelector
        suggestions={suggestedStylesForCategory(category)}
        selected={styles}
        onChange={onStylesChange}
        otherPlaceholder="e.g. Fantasy Fairy Makeup"
      />
    </div>
  );
}
