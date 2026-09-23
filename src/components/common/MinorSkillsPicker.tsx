import { TagSelector } from './TagSelector';
import { ExperienceLevelPicker } from './ExperienceLevelPicker';
import { MINOR_SKILL_GROUPS, MINOR_SKILL_GROUP_FOR_MAJOR_CATEGORY, MAX_MINOR_SKILLS } from '../../lib/skillsTaxonomy';

export interface MinorSkillSelection {
  name: string;
  experienceLevel: string | null;
}

interface MinorSkillsPickerProps {
  /** Excluded from every suggestion list — a skill can't be both major and minor. */
  majorSkill: string | null;
  selected: MinorSkillSelection[];
  onChange: (next: MinorSkillSelection[]) => void;
}

/**
 * Shared "pick your other capabilities, then rate each one" picker used in
 * both freelancer onboarding and Edit Profile so the two never drift into
 * different minor-skill UIs. Selecting/deselecting a chip only adds or
 * removes it from `selected` — each entry's experienceLevel is set
 * separately below, and is preserved across re-selection as long as the
 * chip stays checked.
 */
export function MinorSkillsPicker({ majorSkill, selected, onChange }: MinorSkillsPickerProps) {
  const selectedNames = selected.map((entry) => entry.name);

  // Only the group matching the freelancer's own selected specialty — e.g.
  // a Photographer sees other Photography job-title skills (Wedding
  // Photographer, Photo Editor, ...), not Beauty, Writing, Audio, etc. from
  // fields they haven't indicated anything to do with.
  const relevantGroupCategory = majorSkill ? MINOR_SKILL_GROUP_FOR_MAJOR_CATEGORY[majorSkill] : undefined;
  const visibleGroups = MINOR_SKILL_GROUPS.filter((group) => group.category === relevantGroupCategory);

  const handleToggle = (nextNames: string[]) => {
    onChange(nextNames.map((name) => selected.find((entry) => entry.name === name) ?? { name, experienceLevel: null }));
  };

  const setLevel = (name: string, level: string) => {
    onChange(selected.map((entry) => (entry.name === name ? { ...entry, experienceLevel: level } : entry)));
  };

  if (visibleGroups.length === 0) {
    return <p className="text-xs text-gray-400">No additional skill suggestions for this specialty yet.</p>;
  }

  return (
    <div>
      <div className="space-y-5">
        {visibleGroups.map((group) => {
          const groupSuggestions = group.skills.filter((skill) => skill !== majorSkill);
          if (groupSuggestions.length === 0) return null;
          return (
            <div key={group.category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{group.category}</p>
              <TagSelector
                suggestions={groupSuggestions}
                selected={selectedNames}
                onChange={handleToggle}
                allowCustom={false}
                maxSelected={MAX_MINOR_SKILLS}
              />
            </div>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Your experience level in each (optional)</p>
          {selected.map((entry) => (
            <div key={entry.name} className="rounded-xl border border-sky-100 p-3">
              <p className="mb-2 text-sm font-semibold text-gray-800">{entry.name}</p>
              <ExperienceLevelPicker value={entry.experienceLevel} onChange={(level) => setLevel(entry.name, level)} />
            </div>
          ))}
        </div>
      )}

      {selected.length >= MAX_MINOR_SKILLS && (
        <p className="mt-3 text-xs font-semibold text-amber-700">You've selected the maximum of {MAX_MINOR_SKILLS} additional skills.</p>
      )}
    </div>
  );
}
