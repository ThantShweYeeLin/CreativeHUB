import { useLocation, useNavigate } from 'react-router';
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
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const fallbackPath = isAuthenticated ? '/explore' : '/signup';

  // Both Settings and the sign-up checkbox deliberately open these pages in
  // a NEW TAB (so an in-progress sign-up form or Settings state isn't
  // lost) — that tab has no prior history entry, so navigate(-1) is a
  // silent no-op there. react-router sets location.key to 'default' for a
  // tab's very first entry, which is exactly that case; anywhere else
  // (opened via an in-app link, or the browser's own back/forward) a real
  // history entry exists and navigate(-1) works as expected.
  const handleBack = () => {
    if (location.key === 'default') {
      navigate(fallbackPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-16">
      <header className="sticky top-0 z-10 border-b border-sky-100 bg-white/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-4 py-3">
          <button onClick={() => navigate(fallbackPath)} className="flex items-center gap-2">
            <img src={logoImage} alt="CreativeHUB" className="h-9 w-9 rounded-full object-cover" />
            <span className="font-bold text-gray-900">CreativeHUB</span>
          </button>
          <button
            onClick={handleBack}
            className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-sky-50"
          >
            Back
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[720px] px-4 py-8">
        <div className="rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(56,189,248,0.15)] border border-sky-100 md:p-10">
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
