import { TagSelector } from '../../../components/common/TagSelector';
import { suggestedSkillsForCategory } from '../../../lib/categories';
import { MinorSkillsPicker, type MinorSkillSelection } from '../../../components/common/MinorSkillsPicker';
import { MAX_MINOR_SKILLS } from '../../../lib/skillsTaxonomy';

interface StepSkillsProps {
  category: string | null;
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  minorCategories: string[];
  minorCategorySkillsByCategory: Record<string, string[]>;
  onMinorCategorySkillsChange: (category: string, skills: string[]) => void;
  minorSkills: MinorSkillSelection[];
  onMinorSkillsChange: (skills: MinorSkillSelection[]) => void;
}

export function StepSkills({
  category,
  skills,
  onSkillsChange,
  minorCategories,
  minorCategorySkillsByCategory,
  onMinorCategorySkillsChange,
  minorSkills,
  onMinorSkillsChange,
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
          <p className="mb-1 text-sm font-semibold text-gray-700">Skills for {minorCategory}</p>
          <p className="mb-4 text-xs text-gray-500">The specialty you're also skilled in — select what you can do here too.</p>
          <TagSelector
            suggestions={suggestedSkillsForCategory(minorCategory)}
            selected={minorCategorySkillsByCategory[minorCategory] || []}
            onChange={(next) => onMinorCategorySkillsChange(minorCategory, next)}
            otherPlaceholder="e.g. Voiceover Direction"
          />
        </div>
      ))}

      <div>
        <p className="mb-1 text-sm font-semibold text-gray-700">Additional skills</p>
        <p className="mb-4 text-xs text-gray-500">
          Other capabilities you offer beyond {category || 'your primary category'} — optional, up to {MAX_MINOR_SKILLS}.
        </p>
        <MinorSkillsPicker majorSkill={category} selected={minorSkills} onChange={onMinorSkillsChange} />
      </div>
    </div>
  );
}
