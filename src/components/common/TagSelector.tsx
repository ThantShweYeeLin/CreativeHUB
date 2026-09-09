import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface TagSelectorProps {
  /** The category's standardized options — rendered as toggle chips. */
  suggestions: string[];
  /** Currently selected values (standard + custom, in no particular order). */
  selected: string[];
  onChange: (next: string[]) => void;
  otherPlaceholder?: string;
  emptyHint?: string;
  /**
   * 'default' (unchanged) is the solid-fill selection look used by Skills/
   * Styles pickers everywhere else. 'moodboard' is opt-in per call site —
   * border+bold selection instead of a color fill, slightly varied chip
   * sizing, and a dashed "+ Other" chip — for a looser, less checklist-y
   * feel where that's wanted (e.g. Event Matcher's style/theme picker).
   */
  variant?: 'default' | 'moodboard';
}

/**
 * Shared suggested-chips + "+ Other" custom-tag picker used for both Skills
 * and Styles, in onboarding and Edit Profile alike, so the two surfaces can
 * never drift into different UIs for the same taxonomy (one selects from a
 * dropdown/chips, the other free-text).
 *
 * A selected value that isn't in `suggestions` is inherently a custom tag —
 * no separate "is this custom" flag is stored anywhere; it's derived here
 * and in lib/categories.ts's isStandardSkill/isStandardStyle.
 */
export function TagSelector({
  suggestions,
  selected,
  onChange,
  otherPlaceholder = 'Type your own',
  emptyHint,
  variant = 'default',
}: TagSelectorProps) {
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherDraft, setOtherDraft] = useState('');
  const isMoodboard = variant === 'moodboard';

  const customTags = selected.filter((tag) => !suggestions.includes(tag));

  const toggleSuggestion = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  const addCustomTag = () => {
    const value = otherDraft.trim();
    if (!value) {
      setOtherDraft('');
      return;
    }
    if (!selected.some((item) => item.toLowerCase() === value.toLowerCase())) {
      onChange([...selected, value]);
    }
    setOtherDraft('');
    setShowOtherInput(false);
  };

  const removeTag = (value: string) => {
    onChange(selected.filter((item) => item !== value));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => {
          const isSelected = selected.includes(suggestion);
          // Loose "moodboard" sizing: alternate chip padding instead of a
          // uniform grid, purely cosmetic — doesn't affect selection state.
          const sizeClass = isMoodboard && index % 2 === 1 ? 'px-5 py-2.5' : 'px-4 py-2';
          const selectedClass = isMoodboard
            ? 'border-2 border-gray-900 bg-white text-gray-900 font-bold'
            : 'border-2 border-gray-900 bg-gray-900 text-white';
          return (
            <button
              key={suggestion}
              type="button"
              onClick={() => toggleSuggestion(suggestion)}
              className={`rounded-full border-2 ${sizeClass} text-sm font-semibold transition-all ${
                isSelected ? selectedClass : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {suggestion}
            </button>
          );
        })}

        {customTags.map((tag) =>
          isMoodboard ? (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-gray-900 bg-white py-2 pl-4 pr-2.5 text-sm font-bold text-gray-900"
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`} className="text-gray-900/60 hover:text-gray-900">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-gray-900 bg-gray-900 py-2 pl-4 pr-2.5 text-sm font-semibold text-white"
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`} className="text-white/70 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )
        )}

        <button
          type="button"
          onClick={() => setShowOtherInput((current) => !current)}
          className={`inline-flex items-center gap-1 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all ${
            isMoodboard ? 'border-dashed' : ''
          } ${
            showOtherInput
              ? isMoodboard
                ? 'border-gray-900 bg-white font-bold text-gray-900'
                : 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
          }`}
        >
          <Plus className="h-3.5 w-3.5" /> Other
        </button>
      </div>

      {showOtherInput && (
        <div className="mt-3 flex gap-2">
          <input
            value={otherDraft}
            onChange={(event) => setOtherDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustomTag();
              }
            }}
            placeholder={otherPlaceholder}
            autoFocus
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button
            type="button"
            onClick={addCustomTag}
            className="inline-flex items-center gap-1 rounded-xl border-2 border-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-900 hover:text-white"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      )}

      {selected.length === 0 && emptyHint && <p className="mt-2 text-xs text-gray-400">{emptyHint}</p>}
    </div>
  );
}
