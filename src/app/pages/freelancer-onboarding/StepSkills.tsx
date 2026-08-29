import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { suggestedSkillsForServices } from '../../../lib/categories';

interface StepSkillsProps {
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  selectedServices: string[];
}

export function StepSkills({ skills, onSkillsChange, selectedServices }: StepSkillsProps) {
  const [draft, setDraft] = useState('');

  const suggestions = suggestedSkillsForServices(selectedServices).filter(
    (skill) => !skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())
  );

  const addSkill = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || skills.some((skill) => skill.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    onSkillsChange([...skills, trimmed]);
  };

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-gray-700">Skills</p>
      <p className="mb-4 text-xs text-gray-500">
        {suggestions.length > 0
          ? 'Tap a suggestion below, or add your own — searchable tags like tools, techniques, or specialties.'
          : 'Add searchable tags like tools, techniques, or specialties (e.g. "Adobe Photoshop", "Studio Lighting").'}
      </p>

      {suggestions.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Common for {selectedServices.filter((s) => s).slice(0, 2).join(', ')}
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => addSkill(skill)}
                className="inline-flex items-center gap-1 rounded-full border-2 border-gray-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-gray-700 transition-all hover:border-gray-900 hover:text-gray-900"
              >
                <Plus className="h-3.5 w-3.5" /> {skill}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addSkill(draft);
              setDraft('');
            }
          }}
          placeholder={suggestions.length > 0 ? "Don't see yours? Type it here" : 'Add a skill'}
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <button
          type="button"
          onClick={() => { addSkill(draft); setDraft(''); }}
          className="inline-flex items-center gap-1 rounded-xl border-2 border-gray-900 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-900 hover:text-white"
        >
          <Plus className="h-4 w-4" /> Add Skill
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3.5 py-1.5 text-sm font-semibold text-white"
          >
            {skill}
            <button
              type="button"
              onClick={() => onSkillsChange(skills.filter((item) => item !== skill))}
              aria-label={`Remove ${skill}`}
              className="text-white/70 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {skills.length === 0 && <p className="text-sm text-gray-400">No skills added yet.</p>}
      </div>
    </div>
  );
}
