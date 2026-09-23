import { useNavigate } from 'react-router';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logoImage from '../../imports/logo.png';

export function SiteFooter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Same check App.tsx's own /freelancer-dashboard route guard uses — an
  // already-onboarded freelancer clicking this should land on their
  // dashboard, not be sent back through onboarding again.
  const isFreelancer = user?.role === 'freelancer';

  const LINK_COLUMNS: Array<{ heading: string; links: Array<{ label: string; to: string }> }> = [
    {
      heading: 'Explore',
      links: [
        { label: 'Browse Freelancers', to: '/explore' },
        { label: 'Map', to: '/map' },
        { label: 'Event Assistant', to: '/event-matcher' },
        { label: 'For You', to: '/for-you' },
      ],
    },
    {
      heading: 'For Freelancers',
      links: [
        { label: isFreelancer ? 'Freelancer Dashboard' : 'Become a Freelancer', to: isFreelancer ? '/freelancer-dashboard' : '/become-freelancer' },
        { label: 'Freelancer Premium', to: '/freelancer-dashboard/premium' },
        { label: 'Open Opportunities', to: '/freelancer-dashboard/opportunities' },
      ],
    },
    {
      heading: 'Support',
      links: [
        { label: 'Help & Tickets', to: '/tickets' },
        { label: 'Terms of Service', to: '/terms' },
        { label: 'Privacy Policy', to: '/privacy' },
      ],
    },
  ];

  return (
    <footer className="relative mt-16 border-t border-sky-100">
      <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="flex items-center gap-2.5"
          >
            <img src={logoImage} alt="CreativeHUB" className="h-9 w-9 rounded-xl object-contain" />
            <span className="font-serif text-lg font-bold text-gray-900">CreativeHUB</span>
          </button>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-500">
            <Sparkles className="h-3.5 w-3.5 text-sky-500" />
            Thailand's Creative Marketplace
          </p>
          <p className="mt-3 max-w-xs text-sm text-gray-500">
            Book top-tier photographers, makeup artists, videographers and more — in minutes.
          </p>
        </div>

        {LINK_COLUMNS.map((column) => (
          <div key={column.heading}>
            <h3 className="text-sm font-bold text-gray-900">{column.heading}</h3>
            <ul className="mt-3 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.to}>
                  <button
                    type="button"
                    onClick={() => navigate(link.to)}
                    className="text-sm text-gray-500 transition-colors hover:text-sky-700"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-sky-100 py-5 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} CreativeHUB. All rights reserved.
      </div>
    </footer>
  );
}
