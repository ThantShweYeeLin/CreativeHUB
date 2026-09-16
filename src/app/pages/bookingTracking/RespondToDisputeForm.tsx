import { useState } from 'react';
import { X } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import type { LocalEvidenceItem } from '../../../lib/disputeFlowConfig';
import { EvidenceItemEditor } from './EvidenceItemEditor';

interface RespondToDisputeFormProps {
  bookingId: string;
  userId: string;
  round: number;
  onClose: () => void;
  onSubmitted: () => Promise<void> | void;
}

// Freelancer's side of the same typed-evidence treatment the client's
// Report a Problem flow uses (see ReportProblemFlow.tsx/dispute_evidence.sql)
// — one round, one explanation, any number of individually tagged evidence
// items, instead of a single freeform photo array.
export function RespondToDisputeForm({ bookingId, userId, round, onClose, onSubmitted }: RespondToDisputeFormProps) {
  const [explanation, setExplanation] = useState('');
  const [evidenceItems, setEvidenceItems] = useState<LocalEvidenceItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addEvidenceItem = () => {
    setEvidenceItems((current) => [...current, { id: `${Date.now()}-${current.length}`, file: null, evidenceType: 'photo', description: '' }]);
  };

  const updateEvidenceItem = (id: string, patch: Partial<LocalEvidenceItem>) => {
    setEvidenceItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeEvidenceItem = (id: string) => {
    setEvidenceItems((current) => current.filter((item) => item.id !== id));
  };

  const handleSubmit = async () => {
    if (!explanation.trim()) {
      setError('Explain your side before submitting.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const response = await DataService.respondToBookingDispute(bookingId, {
      actor: 'freelancer',
      hasEvidence: true,
      evidenceText: explanation.trim(),
      reason: explanation.trim(),
    });

    if (response.error) {
      setIsSubmitting(false);
      setError((response.error as any).message || 'Unable to submit response.');
      return;
    }

    for (const item of evidenceItems) {
      if (!item.file) continue;
      const uploadResponse = await DataService.uploadBookingEvidencePhoto(userId, bookingId, item.file);
      if (uploadResponse.error || !uploadResponse.path) {
        continue;
      }
      await DataService.submitDisputeEvidenceItem({
        bookingId,
        round,
        submittedBy: userId,
        role: 'freelancer',
        evidenceType: item.evidenceType,
        storagePath: uploadResponse.path,
        description: item.description.trim() || null,
      });
    }

    setIsSubmitting(false);
    await onSubmitted();
  };

  return (
    <div className="rounded-xl border-2 border-sky-400 bg-sky-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-bold text-gray-900">Respond with Evidence</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        placeholder="Explain your side..."
        className="mb-3 w-full min-h-[80px] rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
      />
      <EvidenceItemEditor
        items={evidenceItems}
        onAdd={addEvidenceItem}
        onUpdate={updateEvidenceItem}
        onRemove={removeEvidenceItem}
        label="Evidence (optional)"
        helperText="Add anything that supports your side — photos, screenshots, messages, or documents."
      />
      <button
        onClick={() => void handleSubmit()}
        disabled={isSubmitting}
        className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white py-3 px-4 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60"
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </div>
  );
}
