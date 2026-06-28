import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar,
  Check,
  ChevronLeft,
  DollarSign,
  Image as ImageIcon,
  Layers,
  MapPin,
  Settings,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';
import { extractBudgetMeta, formatBudgetRange, stripBudgetMeta } from '../../lib/requestBudget';

type DashboardSection = 'portfolio' | 'requests' | 'analytics' | 'settings';

interface FreelancerDashboardProps {
  onBack: () => void;
  section: DashboardSection;
}

interface SettingsFormState {
  title: string;
  description: string;
  hourly_rate: number;
  experience_years: number;
  is_available: boolean;
  location: string;
  skills: string;
  styles: string;
}

interface NewPortfolioFormState {
  title: string;
  description: string;
  tools: string;
  projectUrl: string;
  imageFile: File | null;
}

interface EditPortfolioFormState {
  id: string;
  title: string;
  description: string;
  tools: string;
  projectUrl: string;
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function FreelancerDashboard({ onBack, section }: FreelancerDashboardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [freelancerProfile, setFreelancerProfile] = useState<any | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestMinBudget, setRequestMinBudget] = useState('');
  const [isAddingPortfolio, setIsAddingPortfolio] = useState(false);
  const [isSavingPortfolio, setIsSavingPortfolio] = useState(false);
  const [newPortfolioForm, setNewPortfolioForm] = useState<NewPortfolioFormState>({
    title: '',
    description: '',
    tools: '',
    projectUrl: '',
    imageFile: null,
  });
  const [isGeneratingStyles, setIsGeneratingStyles] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<EditPortfolioFormState | null>(null);
  const [isUpdatingPortfolio, setIsUpdatingPortfolio] = useState(false);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
    title: '',
    description: '',
    hourly_rate: 0,
    experience_years: 0,
    is_available: true,
    location: '',
    skills: '',
    styles: '',
  });

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const [profileResponse, requestsResponse, userResponse] = await Promise.all([
        DataService.getFreelancerProfile(user.id),
        DataService.getFreelancerRequests(user.id),
        DataService.getUser(user.id),
      ]);

      if (!isMounted) return;

      if (profileResponse.error || !profileResponse.data) {
        setError((profileResponse.error as any)?.message || 'Unable to load freelancer profile.');
        setFreelancerProfile(null);
        setPortfolioItems([]);
        setRequests([]);
        setIsLoading(false);
        return;
      }

      setFreelancerProfile(profileResponse.data);
      setRequests(requestsResponse.data || []);

      const portfolioResponse = await DataService.getFreelancerPortfolio(profileResponse.data.id);
      if (!isMounted) return;

      if (portfolioResponse.error) {
        setError((portfolioResponse.error as any)?.message || 'Unable to load portfolio items.');
        setPortfolioItems([]);
      } else {
        setPortfolioItems(portfolioResponse.data || []);
      }

      setSettingsForm({
        title: profileResponse.data.title || '',
        description: profileResponse.data.description || '',
        hourly_rate: Number(profileResponse.data.hourly_rate || 0),
        experience_years: Number(profileResponse.data.experience_years || 0),
        is_available: profileResponse.data.is_available !== false,
        location: userResponse.data?.location || '',
        skills: (profileResponse.data.skills || []).join(', '),
        styles: (profileResponse.data.styles || []).join(', '),
      });

      setIsLoading(false);
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    const pending = requests.filter((request) => request.status === 'pending').length;
    const accepted = requests.filter((request) => request.status === 'accepted').length;
    const rejected = requests.filter((request) => request.status === 'rejected').length;
    const totalBudget = requests.reduce((acc, request) => acc + Number(request.budget || 0), 0);
    const averageBudget = requests.length > 0 ? Math.round(totalBudget / requests.length) : 0;

    return {
      portfolioCount: portfolioItems.length,
      pending,
      accepted,
      rejected,
      totalRequests: requests.length,
      averageBudget,
    };
  }, [portfolioItems, requests]);

  const handleRequestDecision = async (requestId: string, status: 'accepted' | 'rejected') => {
    setError(null);
    setSuccess(null);

    const response = await DataService.updateRequest(requestId, { status } as any);
    if (response.error) {
      setError((response.error as any).message || `Unable to ${status} request.`);
      return;
    }

    if (status === 'accepted') {
      const request = requests.find((item) => item.id === requestId);

      if (request) {
        const budgetMeta = extractBudgetMeta(request.message, request.description);
        const bookingResponse = await DataService.createBooking({
          client_id: request.client_id,
          freelancer_id: request.freelancer_id,
          project_name: request.project_name,
          description: stripBudgetMeta(request.description || request.message || 'Auto-created from accepted request.'),
          budget: Number(budgetMeta?.max ?? request.budget ?? 0),
          status: 'confirmed',
          payment_status: 'unpaid',
          deliverables: `Auto-created from request ${request.id}`,
        } as any);

        if (bookingResponse.error) {
          setError((bookingResponse.error as any).message || 'Request accepted, but booking conversion failed.');
        }
      }
    }

    setRequests((current) => current.map((request) => (request.id === requestId ? { ...request, status } : request)));
    setSuccess(status === 'accepted' ? 'Request accepted and converted to booking.' : 'Request rejected.');
  };

  const handleDeletePortfolio = async (portfolioId: string) => {
    setError(null);
    setSuccess(null);

    const response = await DataService.deletePortfolioItem(portfolioId);
    if (response.error) {
      setError((response.error as any).message || 'Unable to delete portfolio item.');
      return;
    }

    setPortfolioItems((current) => current.filter((item) => item.id !== portfolioId));
    setSuccess('Portfolio item removed.');
  };

  const handleCreatePortfolio = async () => {
    if (!user?.id || !freelancerProfile?.id) {
      setError('You need a freelancer profile before uploading portfolio items.');
      return;
    }

    if (!newPortfolioForm.title.trim()) {
      setError('Portfolio title is required.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSavingPortfolio(true);

    let imageUrls: string[] = [];

    if (newPortfolioForm.imageFile) {
      const uploadResponse = await DataService.uploadPortfolioImage(user.id, newPortfolioForm.imageFile);
      if (uploadResponse.error || !uploadResponse.publicUrl) {
        setError((uploadResponse.error as any)?.message || 'Unable to upload portfolio image.');
        setIsSavingPortfolio(false);
        return;
      }

      imageUrls = [uploadResponse.publicUrl];
    }

    const createResponse = await DataService.createPortfolioItem(freelancerProfile.id, {
      title: newPortfolioForm.title.trim(),
      description: newPortfolioForm.description.trim() || null,
      image_urls: imageUrls,
      project_url: newPortfolioForm.projectUrl.trim() || null,
      tools_used: parseTags(newPortfolioForm.tools),
      featured: false,
    } as any);

    if (createResponse.error || !createResponse.data) {
      setError((createResponse.error as any)?.message || 'Unable to create portfolio item.');
      setIsSavingPortfolio(false);
      return;
    }

    setPortfolioItems((current) => [createResponse.data, ...current]);
    setNewPortfolioForm({ title: '', description: '', tools: '', projectUrl: '', imageFile: null });
    setIsAddingPortfolio(false);
    setIsSavingPortfolio(false);
    setSuccess('Portfolio item uploaded successfully.');
  };

  const startEditingPortfolio = (item: any) => {
    setEditingPortfolio({
      id: item.id,
      title: item.title || '',
      description: item.description || '',
      tools: (item.tools_used || []).join(', '),
      projectUrl: item.project_url || '',
    });
  };

  const handleUpdatePortfolio = async () => {
    if (!editingPortfolio) return;

    if (!editingPortfolio.title.trim()) {
      setError('Portfolio title is required.');
      return;
    }

    setIsUpdatingPortfolio(true);
    setError(null);
    setSuccess(null);

    const updateResponse = await DataService.updatePortfolioItem(editingPortfolio.id, {
      title: editingPortfolio.title.trim(),
      description: editingPortfolio.description.trim() || null,
      tools_used: parseTags(editingPortfolio.tools),
      project_url: editingPortfolio.projectUrl.trim() || null,
      updated_at: new Date().toISOString(),
    } as any);

    if (updateResponse.error || !updateResponse.data) {
      setError((updateResponse.error as any)?.message || 'Unable to update portfolio item.');
      setIsUpdatingPortfolio(false);
      return;
    }

    setPortfolioItems((current) =>
      current.map((item) => (item.id === editingPortfolio.id ? updateResponse.data : item))
    );
    setEditingPortfolio(null);
    setIsUpdatingPortfolio(false);
    setSuccess('Portfolio item updated.');
  };

  const handleGenerateAIStyleProfile = async () => {
    if (portfolioItems.length === 0) {
      setError('Add at least one portfolio item before generating AI style profile.');
      return;
    }

    const combinedText = `${settingsForm.title} ${settingsForm.description} ${portfolioItems
      .map((item) => `${item.title || ''} ${item.description || ''}`)
      .join(' ')}`.toLowerCase();

    const stylePool = [
      { label: 'Minimal', keywords: ['minimal', 'clean', 'simple'] },
      { label: 'Bold', keywords: ['bold', 'vibrant', 'strong'] },
      { label: 'Editorial', keywords: ['editorial', 'magazine', 'fashion'] },
      { label: 'Cinematic', keywords: ['cinematic', 'film', 'moody'] },
      { label: 'Playful', keywords: ['playful', 'fun', 'bright'] },
      { label: 'Luxury', keywords: ['luxury', 'premium', 'elegant'] },
      { label: 'Street', keywords: ['street', 'urban', 'city'] },
      { label: 'Natural', keywords: ['natural', 'outdoor', 'organic'] },
    ];

    const inferredStyles = stylePool
      .filter((style) => style.keywords.some((keyword) => combinedText.includes(keyword)))
      .map((style) => style.label)
      .slice(0, 4);

    const generatedStyles = inferredStyles.length > 0
      ? inferredStyles
      : ['Clean', 'Modern', 'Versatile'];

    const generatedSkills = Array.from(
      new Set([
        ...parseTags(settingsForm.skills),
        ...portfolioItems.flatMap((item) => (item.tools_used || []) as string[]),
      ])
    ).slice(0, 8);

    setIsGeneratingStyles(true);
    setError(null);
    setSuccess(null);

    const profileUpdate = await DataService.updateFreelancerProfile(user!.id, {
      styles: generatedStyles,
      skills: generatedSkills,
      portfolio_count: portfolioItems.length,
      updated_at: new Date().toISOString(),
    } as any);

    if (profileUpdate.error) {
      setError((profileUpdate.error as any)?.message || 'Unable to apply generated style profile.');
      setIsGeneratingStyles(false);
      return;
    }

    setFreelancerProfile(profileUpdate.data);
    setSettingsForm((current) => ({
      ...current,
      styles: generatedStyles.join(', '),
      skills: generatedSkills.join(', '),
    }));
    setIsGeneratingStyles(false);
    setSuccess('AI style profile generated from your current portfolio.');
  };

  const handleSaveSettings = async () => {
    if (!user?.id) return;

    setIsSavingSettings(true);
    setError(null);
    setSuccess(null);

    const [profileUpdate, userUpdate] = await Promise.all([
      DataService.updateFreelancerProfile(user.id, {
        title: settingsForm.title,
        description: settingsForm.description,
        hourly_rate: settingsForm.hourly_rate,
        experience_years: settingsForm.experience_years,
        is_available: settingsForm.is_available,
        skills: parseTags(settingsForm.skills),
        styles: parseTags(settingsForm.styles),
        updated_at: new Date().toISOString(),
      } as any),
      DataService.updateUser(user.id, {
        location: settingsForm.location,
        updated_at: new Date().toISOString(),
      } as any),
    ]);

    if (profileUpdate.error || userUpdate.error) {
      setError(
        (profileUpdate.error as any)?.message ||
          (userUpdate.error as any)?.message ||
          'Unable to save settings.'
      );
      setIsSavingSettings(false);
      return;
    }

    setFreelancerProfile(profileUpdate.data);
    setSuccess('Settings saved successfully.');
    setIsSavingSettings(false);
  };

  const tabs: { id: DashboardSection; label: string; icon: any; path: string }[] = [
    { id: 'portfolio', label: 'Portfolio', icon: ImageIcon, path: '/freelancer-dashboard/portfolio' },
    { id: 'requests', label: 'Requests', icon: Users, path: '/freelancer-dashboard/requests' },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, path: '/freelancer-dashboard/analytics' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/freelancer-dashboard/settings' },
  ];

  const filteredRequests = useMemo(() => {
    const minBudget = Number(requestMinBudget || 0);

    return requests
      .filter((request) => (requestStatusFilter === 'all' ? true : request.status === requestStatusFilter))
      .filter((request) => {
        const searchable = `${request.project_name || ''} ${request.client?.full_name || ''} ${request.message || ''}`.toLowerCase();
        return requestSearch.trim().length === 0 || searchable.includes(requestSearch.trim().toLowerCase());
      })
      .filter((request) => {
        if (!requestMinBudget.trim()) return true;
        const meta = extractBudgetMeta(request.message, request.description);
        const effectiveMax = Number(meta?.max ?? request.budget ?? 0);
        return effectiveMax >= minBudget;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [requests, requestStatusFilter, requestSearch, requestMinBudget]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-12">
      <div className="sticky top-0 z-10 mb-6 border-b border-gray-200 bg-white/80 backdrop-blur-lg md:mb-8">
        <div className="mx-auto max-w-[1400px] px-4 py-4 md:px-8 md:py-6">
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 transition-colors hover:text-black md:mb-4 md:text-base"
          >
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            Back to Home
          </button>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Freelancer Dashboard</h1>
              <p className="text-sm text-gray-600 md:text-base">Manage your portfolio, requests, analytics, and settings</p>
            </div>
            {freelancerProfile && (
              <div className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                Status: {freelancerProfile.is_available === false ? 'Unavailable' : 'Available'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 md:px-8">
        <div className="mb-6 flex gap-2 overflow-x-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg md:mb-8 md:rounded-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all md:rounded-xl md:px-6 md:py-3 md:text-base ${
                section === tab.id
                  ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow-lg'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="h-4 w-4 md:h-5 md:w-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
          </div>
        ) : section === 'portfolio' ? (
          <div className="space-y-6 md:space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">My Portfolio</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddingPortfolio((current) => !current)}
                  className="rounded-lg bg-gradient-to-r from-gray-900 to-black px-4 py-2 text-sm font-semibold text-white hover:shadow"
                >
                  {isAddingPortfolio ? 'Close' : 'Upload Portfolio'}
                </button>
                <button
                  onClick={() => void handleGenerateAIStyleProfile()}
                  disabled={isGeneratingStyles}
                  className="rounded-lg border border-gray-900 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:opacity-60"
                >
                  {isGeneratingStyles ? 'Generating...' : 'AI Style Profile'}
                </button>
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
                  {portfolioItems.length} items
                </div>
              </div>
            </div>

            {isAddingPortfolio && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Upload New Portfolio Item</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input
                    value={newPortfolioForm.title}
                    onChange={(event) => setNewPortfolioForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Project title"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <input
                    value={newPortfolioForm.projectUrl}
                    onChange={(event) => setNewPortfolioForm((current) => ({ ...current, projectUrl: event.target.value }))}
                    placeholder="Project URL (optional)"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <textarea
                  value={newPortfolioForm.description}
                  onChange={(event) => setNewPortfolioForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Describe this project"
                  className="min-h-24 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input
                    value={newPortfolioForm.tools}
                    onChange={(event) => setNewPortfolioForm((current) => ({ ...current, tools: event.target.value }))}
                    placeholder="Tools used (comma separated)"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setNewPortfolioForm((current) => ({
                        ...current,
                        imageFile: event.target.files?.[0] || null,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm"
                  />
                </div>
                <button
                  onClick={() => void handleCreatePortfolio()}
                  disabled={isSavingPortfolio}
                  className="w-full rounded-xl bg-gradient-to-r from-gray-900 to-black px-6 py-3 font-semibold text-white hover:shadow-lg disabled:opacity-60"
                >
                  {isSavingPortfolio ? 'Uploading...' : 'Save Portfolio Item'}
                </button>
              </div>
            )}
            {portfolioItems.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
                <h3 className="text-xl font-bold text-gray-900">No portfolio items yet</h3>
                <p className="mt-2 text-gray-600">Add projects from your freelancer profile workflow to show them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {portfolioItems.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                    <div className="aspect-[4/3] bg-gray-100">
                      <ImageWithFallback
                        src={item.image_urls?.[0] || DEFAULT_AVATAR_URL}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-gray-600">{item.description || 'No description provided.'}</p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => startEditingPortfolio(item)}
                          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleDeletePortfolio(item.id)}
                          className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {editingPortfolio && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6 space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Edit Portfolio Item</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input
                    value={editingPortfolio.title}
                    onChange={(event) =>
                      setEditingPortfolio((current) =>
                        current ? { ...current, title: event.target.value } : current
                      )
                    }
                    placeholder="Project title"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <input
                    value={editingPortfolio.projectUrl}
                    onChange={(event) =>
                      setEditingPortfolio((current) =>
                        current ? { ...current, projectUrl: event.target.value } : current
                      )
                    }
                    placeholder="Project URL (optional)"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <textarea
                  value={editingPortfolio.description}
                  onChange={(event) =>
                    setEditingPortfolio((current) =>
                      current ? { ...current, description: event.target.value } : current
                    )
                  }
                  placeholder="Describe this project"
                  className="min-h-24 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                />
                <input
                  value={editingPortfolio.tools}
                  onChange={(event) =>
                    setEditingPortfolio((current) =>
                      current ? { ...current, tools: event.target.value } : current
                    )
                  }
                  placeholder="Tools used (comma separated)"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setEditingPortfolio(null);
                      setError(null);
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-800 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleUpdatePortfolio()}
                    disabled={isUpdatingPortfolio}
                    className="w-full rounded-xl bg-gradient-to-r from-gray-900 to-black px-6 py-3 font-semibold text-white hover:shadow-lg disabled:opacity-60"
                  >
                    {isUpdatingPortfolio ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : section === 'requests' ? (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Freelancer Requests</h2>
              <p className="text-sm text-gray-600 md:text-base">Manage incoming project requests</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg md:p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                {(['all', 'pending', 'accepted', 'rejected'] as const).map((status) => {
                  const count =
                    status === 'all'
                      ? requests.length
                      : requests.filter((request) => request.status === status).length;

                  return (
                    <button
                      key={status}
                      onClick={() => setRequestStatusFilter(status)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                        requestStatusFilter === status
                          ? 'bg-gradient-to-r from-gray-900 to-black text-white shadow'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status[0].toUpperCase() + status.slice(1)} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={requestSearch}
                  onChange={(event) => setRequestSearch(event.target.value)}
                  placeholder="Search by project, client, or message"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
                <input
                  type="number"
                  value={requestMinBudget}
                  onChange={(event) => setRequestMinBudget(event.target.value)}
                  placeholder="Minimum budget"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            {requests.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
                <h3 className="text-xl font-bold text-gray-900">No requests yet</h3>
                <p className="mt-2 text-gray-600">Incoming client requests will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request) => (
                  (() => {
                    const budgetMeta = extractBudgetMeta(request.message, request.description) || {
                      currency: 'THB',
                      min: Number(request.budget || 0),
                      max: Number(request.budget || 0),
                    };

                    const cleanMessage = stripBudgetMeta(request.message || request.description || 'No message provided');

                    return (
                  <div key={request.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                      <div className="h-14 w-14 overflow-hidden rounded-full ring-2 ring-white shadow-md">
                        <ImageWithFallback
                          src={request.client?.avatar_url || DEFAULT_AVATAR_URL}
                          alt={request.client?.full_name || 'Client'}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">{request.project_name}</h3>
                        <p className="text-sm text-gray-600">
                          {request.client?.full_name || 'Client'} • {cleanMessage}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-600">
                          <span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{formatBudgetRange(budgetMeta)}</span>
                          <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(request.created_at).toLocaleDateString()}</span>
                          <span className="rounded-full border border-gray-200 px-2 py-1 font-semibold capitalize">{request.status}</span>
                        </div>
                      </div>
                      {request.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleRequestDecision(request.id, 'accepted')}
                            className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" /> Accept
                          </button>
                          <button
                            onClick={() => void handleRequestDecision(request.id, 'rejected')}
                            className="flex items-center gap-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            <X className="h-4 w-4" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                    );
                  })()
                ))}

                {filteredRequests.length === 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg text-gray-600">
                    No requests match these filters.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : section === 'analytics' ? (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Analytics</h2>
              <p className="text-sm text-gray-600 md:text-base">Performance based on your real dashboard data</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
              {[
                { label: 'Portfolio Items', value: stats.portfolioCount, icon: Layers },
                { label: 'Pending Requests', value: stats.pending, icon: Users },
                { label: 'Accepted Requests', value: stats.accepted, icon: Check },
                { label: 'Average Budget', value: `฿${stats.averageBudget.toLocaleString()}`, icon: TrendingUp },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
                  <div className="mb-3 inline-flex rounded-xl bg-gray-100 p-3">
                    <stat.icon className="h-5 w-5 text-gray-900" />
                  </div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Service Settings</h2>
              <p className="text-sm text-gray-600 md:text-base">Update your public freelancer details</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Title</label>
                <input
                  value={settingsForm.title}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Description</label>
                <textarea
                  value={settingsForm.description}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-24 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Hourly Rate (THB)</label>
                  <input
                    type="number"
                    value={settingsForm.hourly_rate}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, hourly_rate: Number(event.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Experience Years</label>
                  <input
                    type="number"
                    value={settingsForm.experience_years}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, experience_years: Number(event.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                      value={settingsForm.location}
                      onChange={(event) => setSettingsForm((current) => ({ ...current, location: event.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-9 pr-4 outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Skills (comma separated)</label>
                  <input
                    value={settingsForm.skills}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, skills: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Styles (comma separated)</label>
                  <input
                    value={settingsForm.styles}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, styles: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={settingsForm.is_available}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, is_available: event.target.checked }))}
                />
                Available for new bookings
              </label>
              <button
                onClick={() => void handleSaveSettings()}
                disabled={isSavingSettings}
                className="w-full rounded-xl bg-gradient-to-r from-gray-900 to-black px-6 py-3 font-semibold text-white hover:shadow-lg disabled:opacity-60"
              >
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
