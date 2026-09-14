import { useNavigate } from 'react-router';
import logoImage from '../../../imports/logo.png';
import { useAuth } from '../../../contexts/AuthContext';

interface LegalPageLayoutProps {
  title: string;
  updatedLabel: string;
  children: React.ReactNode;
}

// Shared shell for /terms and /privacy — both routes are always available
// (see App.tsx, same pattern as /reset-password and /post/:postId), since
// a prospective signer-upper needs to be able to read them before creating
// an account, so this can't assume MainLayout's authenticated context.
export function LegalPageLayout({ title, updatedLabel, children }: LegalPageLayoutProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-16">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-4 py-3">
          <button onClick={() => navigate(isAuthenticated ? '/explore' : '/signup')} className="flex items-center gap-2">
            <img src={logoImage} alt="CreativeHUB" className="h-9 w-9 rounded-full object-cover" />
            <span className="font-bold text-gray-900">CreativeHUB</span>
          </button>
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[720px] px-4 py-8">
        <div className="rounded-3xl bg-white p-6 shadow-xl md:p-10">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{updatedLabel}</p>
          <div className="prose-legal mt-8 space-y-8 text-sm leading-relaxed text-gray-700 md:text-base">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-gray-900 md:text-xl">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
