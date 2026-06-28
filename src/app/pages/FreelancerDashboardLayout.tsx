import { ChevronLeft, Image as ImageIcon, Settings, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router';

export type DashboardSection = 'portfolio' | 'requests' | 'analytics' | 'settings';

interface FreelancerDashboardLayoutProps {
  section: DashboardSection;
  onBack: () => void;
  children: React.ReactNode;
}

const tabs: { id: DashboardSection; label: string; icon: any; path: string }[] = [
  { id: 'portfolio', label: 'Portfolio', icon: ImageIcon, path: '/freelancer-dashboard/portfolio' },
  { id: 'requests', label: 'Requests', icon: Users, path: '/freelancer-dashboard/requests' },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp, path: '/freelancer-dashboard/analytics' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/freelancer-dashboard/settings' },
];

export function FreelancerDashboardLayout({ section, onBack, children }: FreelancerDashboardLayoutProps) {
  const navigate = useNavigate();

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
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Freelancer Dashboard</h1>
          <p className="text-sm text-gray-600 md:text-base">Manage your portfolio, requests, analytics, and settings</p>
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

        {children}
      </div>
    </div>
  );
}
