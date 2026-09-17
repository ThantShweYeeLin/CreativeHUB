import { useState } from 'react';
import { X, FileText, Camera } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { DataService } from '../../../lib/dataService';
import {
  getReportReasonOptions,
  getEvidenceRequirement,
  EVIDENCE_FIELD_LABEL,
  type EvidenceField,
} from '../../../lib/attendanceVerification';

type Role = 'client' | 'freelancer';

function isPreviewableImage(file: File) {
  return file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.heic');
}

export function ReportAttendanceProblem({
  booking,
  bookingId,
  role,
  onCancel,
  onSubmitted,
}: {
  booking: any;
  bookingId: string;
  role: Role;
  onCancel: () => void;
  onSubmitted: () => Promise<void>;
}) {
  const { user } = useAuth();
  const reasonOptions = getReportReasonOptions(role);
  const [reason, setReason] = useState(reasonOptions[0]?.value || 'other');
  const [explanation, setExplanation] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requirement = getEvidenceRequirement(reason);
  const otherPartyName = role === 'client' ? booking.freelancer?.full_name : booking.client?.full_name;

  const requiresField = (field: EvidenceField) => requirement.required.includes(field);
  const showsField = (field: EvidenceField) => requiresField(field) || requirement.optional.includes(field);

  const hasEvidenceFile = files.length > 0;
  const canSubmit =
    (!requiresField('location_photo') && !requiresField('screenshot') ? true : hasEvidenceFile) &&
    (!requiresField('explanation') || explanation.trim().length > 0);

  const handleSubmit = async () => {
    if (!user?.id) return;
    setIsSubmitting(true);
    setError(null);

    const evidencePaths: string[] = [];
    for (const file of files) {
      const uploadResponse = await DataService.uploadBookingEvidencePhoto(user.id, bookingId, file);
      if (uploadResponse.error || !uploadResponse.path) {
        setError('Unable to upload one of the evidence files. Please try again.');
        setIsSubmitting(false);
        return;
      }
      evidencePaths.push(uploadResponse.path);
    }

    const response = await DataService.submitAttendanceReport(bookingId, {
      reason,
      explanation: explanation.trim(),
      evidencePaths,
    });
    setIsSubmitting(false);
    if (response.error) {
      setError((response.error as any)?.message || 'Unable to submit this report. Please try again.');
      return;
    }
    await onSubmitted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Create a Ticket</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-sky-50/50 p-3 text-sm text-gray-600 space-y-0.5">
          <p className="font-semibold text-gray-900">{booking.project_name}</p>
          {booking.start_date && (
            <p>
              {new Date(`${booking.start_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              {booking.start_time ? ` · ${booking.start_time.slice(0, 5)}` : ''}
            </p>
          )}
          {booking.location_address && <p>{booking.location_address}</p>}
          {otherPartyName && <p>With: {otherPartyName}</p>}
        </div>

        <label className="mb-1 block text-xs font-semibold text-gray-600">Reason</label>
        <select
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setFiles([]);
          }}
          className="mb-4 w-full rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
        >
          {reasonOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {requirement.safetyExempt && (
          <p className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            Your safety comes first — photo or screenshot evidence is optional for this report. A written description is
            enough.
          </p>
        )}

        {(showsField('location_photo') || showsField('screenshot')) && (
          <div className="mb-4">
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Evidence
              {requiresField('location_photo') || requiresField('screenshot') ? ' (required)' : ' (optional)'}
            </label>
            <p className="mb-1.5 text-xs text-gray-500">
              {(['location_photo', 'screenshot'] as EvidenceField[])
                .filter(showsField)
                .map((field) => `${EVIDENCE_FIELD_LABEL[field]}${requiresField(field) ? '' : ' (optional)'}`)
                .join(' · ')}
            </p>
            <input
              type="file"
              accept="image/*,.heic,.pdf"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 6))}
              className="text-xs"
            />
            {files.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="aspect-square overflow-hidden rounded-lg border border-sky-100 bg-sky-50/50">
                    {isPreviewableImage(file) ? (
                      <img src={URL.createObjectURL(file)} alt={file.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center">
                        {file.type === 'application/pdf' ? (
                          <FileText className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Camera className="h-5 w-5 text-gray-400" />
                        )}
                        <span className="text-[10px] text-gray-500 truncate w-full">{file.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <label className="mb-1 block text-xs font-semibold text-gray-600">
          Additional Details{requiresField('explanation') ? ' (required)' : ' (optional)'}
        </label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Describe what happened..."
          className="mb-4 w-full min-h-[90px] rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {showConfirm ? (
          <div className="rounded-xl border-2 border-sky-400 bg-sky-50/50 p-4">
            <p className="mb-3 text-sm text-gray-800">
              Are you sure you want to submit this ticket? False reports may result in account penalties.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-sky-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-sky-100"
              >
                Go Back
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 text-sm font-bold text-white hover:shadow-lg disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting...' : 'Yes, Submit Ticket'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 rounded-xl border border-sky-200 py-3 text-sm font-semibold text-gray-700 hover:bg-sky-100">
              Cancel
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!canSubmit}
              className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-sm font-bold text-white hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit Ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
