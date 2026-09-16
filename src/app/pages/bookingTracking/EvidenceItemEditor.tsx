import { X } from 'lucide-react';
import { EVIDENCE_TYPE_OPTIONS, type EvidenceType, type LocalEvidenceItem } from '../../../lib/disputeFlowConfig';

interface EvidenceItemEditorProps {
  items: LocalEvidenceItem[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<LocalEvidenceItem>) => void;
  onRemove: (id: string) => void;
  label: string;
  helperText: string;
}

// Shared per-item tagged evidence editor (type + file + optional
// description) for both the client's Report a Problem flow and the
// freelancer's dispute response — one row per uploaded item, matching
// supabase/dispute_evidence.sql.
export function EvidenceItemEditor({ items, onAdd, onUpdate, onRemove, label, helperText }: EvidenceItemEditorProps) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-600">{label}</label>
        <button onClick={onAdd} className="text-xs font-semibold text-gray-900 underline">
          + Add evidence
        </button>
      </div>
      <p className="mb-2 text-xs text-gray-500">{helperText}</p>
      {items.map((item) => (
        <div key={item.id} className="mb-2 rounded-lg border border-sky-100 bg-white p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <select
              value={item.evidenceType}
              onChange={(e) => onUpdate(item.id, { evidenceType: e.target.value as EvidenceType })}
              className="rounded-lg border border-sky-100 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-sky-400"
            >
              {EVIDENCE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx"
              onChange={(e) => onUpdate(item.id, { file: e.target.files?.[0] || null })}
              className="min-w-0 flex-1 text-xs"
            />
            <button onClick={() => onRemove(item.id)} className="text-gray-400 hover:text-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            value={item.description}
            onChange={(e) => onUpdate(item.id, { description: e.target.value })}
            placeholder="What does this show? (optional)"
            className="w-full rounded-lg border border-sky-100 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>
      ))}
    </div>
  );
}
