import { MinorSkillsPicker, type MinorSkillSelection } from '../../../components/common/MinorSkillsPicker';
import { MAX_MINOR_SKILLS } from '../../../lib/skillsTaxonomy';

interface StepAdditionalSkillsProps {
  majorSkill: string | null;
  minorSkills: MinorSkillSelection[];
  onMinorSkillsChange: (skills: MinorSkillSelection[]) => void;
}

export function StepAdditionalSkills({ majorSkill, minorSkills, onMinorSkillsChange }: StepAdditionalSkillsProps) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-gray-700">Additional skills (optional)</p>
      <p className="mb-4 text-xs text-gray-500">
        Tell clients what else you can provide beyond {majorSkill || 'your primary specialty'}. Select up to {MAX_MINOR_SKILLS} — you can change these later.
      </p>
      <MinorSkillsPicker majorSkill={majorSkill} selected={minorSkills} onChange={onMinorSkillsChange} />
    </div>
  );
}
