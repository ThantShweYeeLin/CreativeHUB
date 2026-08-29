import { TagSelector } from '../../../components/common/TagSelector';
import { suggestedSkillsForCategory } from '../../../lib/categories';

interface StepSkillsProps {
  category: string | null;
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
}

export function StepSkills({ category, skills, onSkillsChange }: StepSkillsProps) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-gray-700">Skills</p>
      <p className="mb-4 text-xs text-gray-500">What you can do. Select all that apply, or add your own.</p>
      <TagSelector
        suggestions={suggestedSkillsForCategory(category)}
        selected={skills}
        onChange={onSkillsChange}
        otherPlaceholder="e.g. Voiceover Direction"
      />
    </div>
  );
}
