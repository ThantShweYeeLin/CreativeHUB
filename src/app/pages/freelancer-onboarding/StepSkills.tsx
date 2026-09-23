import { TagSelector } from '../../../components/common/TagSelector';
import { suggestedSkillsForCategory } from '../../../lib/categories';

interface StepSkillsProps {
  category: string | null;
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  minorCategories: string[];
  minorCategorySkillsByCategory: Record<string, string[]>;
  onMinorCategorySkillsChange: (category: string, skills: string[]) => void;
  onRemoveMinorCategory: (category: string) => void;
}

export function StepSkills({
  category,
  skills,
  onSkillsChange,
  minorCategories,
  minorCategorySkillsByCategory,
  onMinorCategorySkillsChange,
  onRemoveMinorCategory,
}: StepSkillsProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-sm font-semibold text-gray-700">Skills{category ? ` for ${category}` : ''}</p>
        <p className="mb-4 text-xs text-gray-500">What you can do. Select all that apply, or add your own.</p>
        <TagSelector
          suggestions={suggestedSkillsForCategory(category)}
          selected={skills}
          onChange={onSkillsChange}
          otherPlaceholder="e.g. Voiceover Direction"
        />
      </div>

      {minorCategories.map((minorCategory) => (
        <div key={minorCategory}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-700">Skills for {minorCategory}</p>
            <button
              type="button"
              onClick={() => onRemoveMinorCategory(minorCategory)}
              className="text-xs font-semibold text-gray-400 hover:text-red-600"
            >
              Not a specialty? Remove
            </button>
          </div>
          <p className="mb-4 text-xs text-gray-500">The specialty you're also skilled in — select what you can do here too.</p>
          <TagSelector
            suggestions={suggestedSkillsForCategory(minorCategory)}
            selected={minorCategorySkillsByCategory[minorCategory] || []}
            onChange={(next) => onMinorCategorySkillsChange(minorCategory, next)}
            otherPlaceholder="e.g. Voiceover Direction"
          />
        </div>
      ))}
    </div>
  );
}
