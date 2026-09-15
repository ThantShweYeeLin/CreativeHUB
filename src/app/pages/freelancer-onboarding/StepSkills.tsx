import { TagSelector } from '../../../components/common/TagSelector';
import { suggestedSkillsForCategory } from '../../../lib/categories';

interface StepSkillsProps {
  category: string | null;
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  minorCategory?: string | null;
  minorCategorySkills?: string[];
  onMinorCategorySkillsChange?: (skills: string[]) => void;
}

export function StepSkills({
  category,
  skills,
  onSkillsChange,
  minorCategory,
  minorCategorySkills = [],
  onMinorCategorySkillsChange,
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

      {minorCategory && onMinorCategorySkillsChange && (
        <div>
          <p className="mb-1 text-sm font-semibold text-gray-700">Skills for {minorCategory}</p>
          <p className="mb-4 text-xs text-gray-500">The specialty you're also skilled in — select what you can do here too.</p>
          <TagSelector
            suggestions={suggestedSkillsForCategory(minorCategory)}
            selected={minorCategorySkills}
            onChange={onMinorCategorySkillsChange}
            otherPlaceholder="e.g. Voiceover Direction"
          />
        </div>
      )}
    </div>
  );
}
