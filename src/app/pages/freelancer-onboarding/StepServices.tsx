import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { CATEGORY_GROUPS } from '../../../lib/categories';
import { toggle } from './types';

interface StepServicesProps {
  selectedServices: string[];
  onSelectedServicesChange: (services: string[]) => void;
  selectedSpecialties: string[];
  onSelectedSpecialtiesChange: (specialties: string[]) => void;
}

const CATALOG_LABELS = new Set(CATEGORY_GROUPS.map((group) => group.label));

export function StepServices({
  selectedServices,
  onSelectedServicesChange,
  selectedSpecialties,
  onSelectedSpecialtiesChange,
}: StepServicesProps) {
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherDraft, setOtherDraft] = useState('');

  const availableSpecialties = CATEGORY_GROUPS.filter((group) => selectedServices.includes(group.label));
  const customServices = selectedServices.filter((service) => !CATALOG_LABELS.has(service));

  const handleToggleService = (label: string) => {
    const next = toggle(selectedServices, label);
    onSelectedServicesChange(next);

    const group = CATEGORY_GROUPS.find((item) => item.label === label);
    if (group && !next.includes(label)) {
      onSelectedSpecialtiesChange(selectedSpecialties.filter((specialty) => !group.specialties.includes(specialty)));
    }
  };

  const addCustomService = () => {
    const value = otherDraft.trim();
    if (!value || selectedServices.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setOtherDraft('');
      return;
    }
    onSelectedServicesChange([...selectedServices, value]);
    setOtherDraft('');
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">What services do you provide?</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {CATEGORY_GROUPS.filter((group) => group.id !== 'other').map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => handleToggleService(group.label)}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                selectedServices.includes(group.label)
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {group.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowOtherInput((current) => !current)}
            className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
              showOtherInput || customServices.length > 0
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-400'
            }`}
          >
            Other
          </button>
        </div>
      </div>

      {(showOtherInput || customServices.length > 0) && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Your own service</p>
          <div className="mb-3 flex gap-2">
            <input
              value={otherDraft}
              onChange={(event) => setOtherDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addCustomService();
                }
              }}
              placeholder="e.g. Voiceover Artist"
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="button"
              onClick={addCustomService}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-gray-900 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-900 hover:text-white"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          {customServices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {customServices.map((service) => (
                <span
                  key={service}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-3.5 py-1.5 text-sm font-semibold text-white"
                >
                  {service}
                  <button
                    type="button"
                    onClick={() => onSelectedServicesChange(selectedServices.filter((s) => s !== service))}
                    aria-label={`Remove ${service}`}
                    className="text-white/70 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {availableSpecialties.length > 0 && (
        <div className="space-y-4">
          {availableSpecialties.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{group.label} specialties</p>
              <div className="flex flex-wrap gap-2">
                {group.specialties.map((specialty) => (
                  <button
                    key={specialty}
                    type="button"
                    onClick={() => onSelectedSpecialtiesChange(toggle(selectedSpecialties, specialty))}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                      selectedSpecialties.includes(specialty)
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {specialty}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
