import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronLeft, Users } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { PageBackdrop } from '../../components/common/PageBackdrop';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';

export function TeamProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [team, setTeam] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!id) return;
      setIsLoading(true);

      const [teamResponse, membersResponse] = await Promise.all([
        DataService.getTeam(id),
        DataService.getTeamMembers(id),
      ]);

      if (!isMounted) return;

      if (teamResponse.error || !teamResponse.data) {
        setError((teamResponse.error as any)?.message || 'Unable to load this team.');
        setIsLoading(false);
        return;
      }

      setTeam(teamResponse.data);
      setMembers(membersResponse.data || []);
      setIsLoading(false);
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleSubmitRequest = async () => {
    if (!id || !user?.id) return;
    if (!projectName.trim() || !budget.trim()) {
      setError('Enter a project name and budget.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const response = await DataService.createTeamBooking({
      teamId: id,
      clientId: user.id,
      projectName: projectName.trim(),
      description: description.trim(),
      budget: Number(budget),
    });
    setIsSubmitting(false);

    if (response.error) {
      setError((response.error as any).message || 'Unable to send request.');
      return;
    }

    setIsRequestFormOpen(false);
    setProjectName('');
    setDescription('');
    setBudget('');
    setSuccess('Request sent to the team. Each member needs to confirm before it becomes a booking.');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sky-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sky-50 px-4 text-center">
        <p className="text-sm text-gray-600">{error || 'Team not found.'}</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-20 md:pb-12">
      <PageBackdrop />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-6 md:px-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-black"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

        <div className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(56,189,248,0.15)] md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-blue-100">
              <Users className="h-6 w-6 text-sky-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
              <p className="text-sm text-gray-600">{members.length} member{members.length === 1 ? '' : 's'}</p>
            </div>
          </div>

          {team.description && <p className="mt-4 text-sm text-gray-700">{team.description}</p>}

          <div className="mt-6 space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-xl bg-sky-50/60 px-4 py-2.5">
                <Avatar
                  src={member.user?.avatar_url || DEFAULT_AVATAR_URL}
                  alt={member.user?.full_name || 'Member'}
                  gender={member.user?.gender}
                  sizeClassName="w-9 h-9"
                />
                <span className="text-sm font-semibold text-gray-900">{member.user?.full_name || 'Member'}</span>
                <span className="rounded-full border border-sky-100 px-2 py-0.5 text-xs font-semibold capitalize text-gray-600">
                  {member.role}
                </span>
              </div>
            ))}
          </div>

          {user?.role === 'client' && (
            <div className="mt-6 border-t border-sky-100 pt-6">
              {!isRequestFormOpen ? (
                <button
                  onClick={() => setIsRequestFormOpen(true)}
                  className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 font-semibold text-white hover:shadow-lg"
                >
                  Request This Team
                </button>
              ) : (
                <div className="space-y-3">
                  <input
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Project name"
                    className="w-full rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe what you need"
                    rows={3}
                    className="w-full rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <input
                    type="number"
                    min={0}
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsRequestFormOpen(false)}
                      className="flex-1 rounded-xl bg-sky-50 px-4 py-2 font-semibold text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleSubmitRequest()}
                      disabled={isSubmitting}
                      className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
                    >
                      {isSubmitting ? 'Sending...' : 'Send Request'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
