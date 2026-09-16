import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { DataService } from '../../../lib/dataService';

export const REPORT_REASON_LABEL: Record<string, string> = {
  harassment: 'Harassment',
  scam_fraud: 'Scam / Fraud',
  fake_information: 'Fake information',
  inappropriate_content: 'Inappropriate content',
  unprofessional_behavior: 'Unprofessional behavior',
  other: 'Other',
};

export function AdminReportDetail({ reportId }: { reportId: string }) {
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    const response = await DataService.getUserReportForAdmin(reportId);
    if (response.error || !response.data) {
      setError((response.error as any)?.message || 'Report not found.');
      setIsLoading(false);
      return;
    }
    setReport(response.data);
    const paths: string[] = response.data.evidence_photo_paths || [];
    const entries = await Promise.all(
      paths.map(async (path) => {
        const res = await DataService.getReportEvidenceSignedUrl(path);
        return [path, res.url] as const;
      })
    );
    setSignedUrls(Object.fromEntries(entries.filter(([, url]) => url)) as Record<string, string>);
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const handleResolve = async () => {
    if (!decision) return;
    setIsSaving(true);
    setError(null);
    const response = await DataService.adminResolveUserReport(reportId, decision as any, reason.trim() || undefined);
    setIsSaving(false);
    if (response.error) {
      setError((response.error as any).message || 'Unable to resolve report.');
      return;
    }
    setDecision('');
    setReason('');
    await load();
  };

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (error || !report) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || 'Report not found.'}</div>;

  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_8px_30px_rgba(56,189,248,0.15)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => navigate(`/admin/users/${report.reported_user_id}`)} className="font-bold text-gray-900 hover:underline text-left">
          {report.reported_post_id
            ? `${report.reporter?.full_name || 'Someone'} reported a post by ${report.reported?.full_name || 'a user'}`
            : `${report.reporter?.full_name || 'Someone'} reported ${report.reported?.full_name || 'a user'}`}
        </button>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${report.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-sky-50 text-gray-700'}`}>
          {REPORT_REASON_LABEL[report.reason] || report.reason}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-2">{new Date(report.created_at).toLocaleString()} · {report.status}</p>
      {report.reported_post_id && (
        <a
          href={`/post/${report.reported_post_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-sm hover:bg-sky-100"
        >
          {report.reported_post?.image_url && !String(report.reported_post.image_url).startsWith('blob:') && (
            <img src={report.reported_post.image_url} alt="Reported post" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 underline">View reported post ↗</p>
            {report.reported_post?.caption && <p className="truncate text-xs text-gray-600">{report.reported_post.caption}</p>}
          </div>
        </a>
      )}
      {report.description && <p className="mb-3 text-sm text-gray-700">{report.description}</p>}
      {(report.evidence_photo_paths || []).length > 0 && (
        <div className="mb-3 grid grid-cols-4 gap-2 max-w-md">
          {report.evidence_photo_paths.map((path: string) => (
            <div key={path} className="aspect-square overflow-hidden rounded-lg bg-sky-50">
              {signedUrls[path] && <img src={signedUrls[path]} alt="Evidence" className="h-full w-full object-cover" />}
            </div>
          ))}
        </div>
      )}
      {report.related_booking_id && (
        <button
          onClick={() => navigate(`/admin/bookings/${report.related_booking_id}`)}
          className="mb-3 inline-block text-xs font-semibold text-gray-700 underline"
        >
          View related booking
        </button>
      )}

      {report.status === 'open' ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-sky-100 pt-3">
          <select value={decision} onChange={(e) => setDecision(e.target.value)} className="rounded-lg border border-sky-100 px-3 py-2 text-sm">
            <option value="">Choose a decision...</option>
            <option value="no_action">No action</option>
            <option value="warning">Warning</option>
            <option value="suspended">Suspend account</option>
            <option value="banned">Ban account</option>
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="min-w-[200px] flex-1 rounded-lg border border-sky-100 px-3 py-2 text-sm"
          />
          <button
            disabled={!decision || isSaving}
            onClick={() => void handleResolve()}
            className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Confirm Decision'}
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-lg bg-sky-50/50 px-3 py-2 text-sm text-gray-600 border-t border-sky-100 pt-3">
          Decision: <span className="font-semibold">{report.decision}</span>
          {report.decision_reason && <span> — "{report.decision_reason}"</span>}
        </div>
      )}
    </div>
  );
}
