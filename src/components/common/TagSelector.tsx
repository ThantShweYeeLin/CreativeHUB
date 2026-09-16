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
  /** Hide the "+ Other" free-text option — for taxonomies that must stay controlled (e.g. minor skills). Defaults to true. */
  allowCustom?: boolean;
  /** Once this many are selected, remaining unselected suggestions are disabled rather than toggleable. */
  maxSelected?: number;
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
  allowCustom = true,
  maxSelected,
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
          const isDisabled = !isSelected && maxSelected !== undefined && selected.length >= maxSelected;
          // Loose "moodboard" sizing: alternate chip padding instead of a
          // uniform grid, purely cosmetic — doesn't affect selection state.
          const sizeClass = isMoodboard && index % 2 === 1 ? 'px-5 py-2.5' : 'px-4 py-2';
          const selectedClass = isMoodboard
            ? 'border-2 border-sky-500 bg-white text-sky-700 font-bold'
            : 'border-2 border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 text-white';
          return (
            <button
              key={suggestion}
              type="button"
              disabled={isDisabled}
              onClick={() => toggleSuggestion(suggestion)}
              className={`rounded-full border-2 ${sizeClass} text-sm font-semibold transition-all ${
                isSelected
                  ? selectedClass
                  : isDisabled
                    ? 'cursor-not-allowed border-sky-100 bg-sky-50 text-gray-300'
                    : 'border-sky-100 bg-white text-gray-700 hover:border-sky-300'
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
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-sky-500 bg-white py-2 pl-4 pr-2.5 text-sm font-bold text-sky-700"
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`} className="text-sky-700/60 hover:text-sky-700">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 py-2 pl-4 pr-2.5 text-sm font-semibold text-white"
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`} className="text-white/70 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )
        )}

        {allowCustom && (
          <button
            type="button"
            onClick={() => setShowOtherInput((current) => !current)}
            className={`inline-flex items-center gap-1 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all ${
              isMoodboard ? 'border-dashed' : ''
            } ${
              showOtherInput
                ? isMoodboard
                  ? 'border-sky-500 bg-white font-bold text-sky-700'
                  : 'border-sky-500 bg-gradient-to-r from-sky-500 to-blue-600 text-white'
                : 'border-sky-100 bg-white text-gray-700 hover:border-sky-300'
            }`}
          >
            <Plus className="h-3.5 w-3.5" /> Other
          </button>
        )}
      </div>

      {allowCustom && showOtherInput && (
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
            className="flex-1 rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            type="button"
            onClick={addCustomTag}
            className="inline-flex items-center gap-1 rounded-xl border-2 border-sky-400 px-4 py-2.5 text-sm font-semibold text-sky-600 hover:bg-gradient-to-r hover:from-sky-500 hover:to-blue-600 hover:text-white hover:border-transparent"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      )}

      {selected.length === 0 && emptyHint && <p className="mt-2 text-xs text-gray-400">{emptyHint}</p>}
    </div>
  );
}
