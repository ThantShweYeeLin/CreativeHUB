import { useState } from 'react';
import { X } from 'lucide-react';
import { TermsOfServiceContent } from '../app/pages/legal/TermsOfServiceContent';
import { PrivacyPolicyContent } from '../app/pages/legal/PrivacyPolicyContent';

type LegalTab = 'terms' | 'privacy';

interface LegalContentModalProps {
  initialTab: LegalTab;
  onClose: () => void;
}

// Shows Terms of Service / Privacy Policy as switchable tabs in an overlay
// instead of navigating to /terms or /privacy — used from the sign-up form
// and Settings specifically so reading them never loses in-progress form
// state (a multi-step sign-up in particular has no way to recover that
// state once the page unmounts). The standalone /terms and /privacy pages
// still exist for direct/shareable links; this reuses the exact same
// content components so the two never drift apart.
export function LegalContentModal({ initialTab, onClose }: LegalContentModalProps) {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(56,189,248,0.25)]">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-sky-100 px-5 py-3">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeTab === 'terms' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'text-gray-600 hover:bg-sky-50'
              }`}
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeTab === 'privacy' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white' : 'text-gray-600 hover:bg-sky-50'
              }`}
            >
              Privacy Policy
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-sky-50 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6">
          <p className="mb-6 text-xs text-gray-500">Last updated September 2026</p>
          <div className="space-y-8 text-sm leading-relaxed text-gray-700">
            {activeTab === 'terms' ? (
              <TermsOfServiceContent onLinkToPrivacy={() => setActiveTab('privacy')} />
            ) : (
              <PrivacyPolicyContent onLinkToTerms={() => setActiveTab('terms')} />
            )}
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-sky-100 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
