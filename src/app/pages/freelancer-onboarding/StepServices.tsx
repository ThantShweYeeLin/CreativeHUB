import { CATEGORY_GROUPS } from '../../../lib/categories';
import { toggle } from './types';

interface StepServicesProps {
  selectedServices: string[];
  onSelectedServicesChange: (services: string[]) => void;
  selectedSpecialties: string[];
  onSelectedSpecialtiesChange: (specialties: string[]) => void;
}

export function StepServices({
  selectedServices,
  onSelectedServicesChange,
  selectedSpecialties,
  onSelectedSpecialtiesChange,
}: StepServicesProps) {
  const availableSpecialties = CATEGORY_GROUPS.filter((group) => selectedServices.includes(group.label));

  const handleToggleService = (label: string) => {
    const next = toggle(selectedServices, label);
    onSelectedServicesChange(next);

    const group = CATEGORY_GROUPS.find((item) => item.label === label);
    if (group && !next.includes(label)) {
      onSelectedSpecialtiesChange(selectedSpecialties.filter((specialty) => !group.specialties.includes(specialty)));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">What services do you provide?</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {CATEGORY_GROUPS.map((group) => (
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
        </div>
      </div>

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
