import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { Gender } from '../../lib/database.types';
import { GENDER_OPTIONS, GENDER_POSITION_CLASSES, GENDER_SIZE_CLASSES } from './GenderBadge';

interface EditableGenderBadgeProps {
  gender: Gender | null | undefined;
  onSelect: (gender: Gender) => void | Promise<void>;
  size?: keyof typeof GENDER_SIZE_CLASSES;
  position?: keyof typeof GENDER_POSITION_CLASSES;
  disabled?: boolean;
}

export function EditableGenderBadge({ gender, onSelect, size = 'md', position = 'top-right', disabled = false }: EditableGenderBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSelect = async (value: Gender) => {
    setIsOpen(false);
    setIsSaving(true);
    await onSelect(value);
    setIsSaving(false);
  };

  return (
    <div className={`absolute z-20 ${GENDER_POSITION_CLASSES[position]}`}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled || isSaving}
        title="Edit pronouns"
        aria-label="Edit pronouns"
        className={`flex items-center justify-center rounded-full bg-white text-gray-700 ring-2 ring-white leading-none font-bold shadow-sm transition hover:brightness-95 disabled:opacity-60 ${GENDER_SIZE_CLASSES[size]}`}
      >
        {isSaving ? <span className="animate-pulse">…</span> : <Pencil className="h-2.5 w-2.5" />}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => void handleSelect(option.value)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition hover:bg-gray-50 ${
                  gender === option.value ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default EditableGenderBadge;
