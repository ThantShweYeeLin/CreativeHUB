import { useState } from 'react';
import { Facebook, Globe, Instagram, Plus, Trash2 } from 'lucide-react';
import { detectPortfolioPlatform, PORTFOLIO_PLATFORM_LABELS, type PortfolioLinkDraft, type PortfolioPlatform } from './types';

interface StepPortfolioProps {
  links: PortfolioLinkDraft[];
  onLinksChange: (links: PortfolioLinkDraft[]) => void;
}

const PLATFORM_ICON: Record<PortfolioPlatform, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  website: Globe,
};

function isValidUrl(value: string) {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    return Boolean(url.hostname.includes('.'));
  } catch {
    return false;
  }
}

export function StepPortfolio({ links, onLinksChange }: StepPortfolioProps) {
  const [urlDraft, setUrlDraft] = useState('');
  const [labelDraft, setLabelDraft] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const detectedPlatform = detectPortfolioPlatform(urlDraft);

  const addLink = () => {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;

    if (!isValidUrl(trimmed)) {
      setFormError('Enter a full link, e.g. https://instagram.com/yourhandle');
      return;
    }

    const normalizedUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const platform = detectPortfolioPlatform(normalizedUrl);

    onLinksChange([
      ...links,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: normalizedUrl,
        label: labelDraft.trim(),
        platform,
      },
    ]);
    setUrlDraft('');
    setLabelDraft('');
    setFormError(null);
  };

  const removeLink = (id: string) => {
    onLinksChange(links.filter((link) => link.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700">Your portfolio</p>
        <p className="text-xs text-gray-500">
          Optional — share links to your Instagram, Facebook, or portfolio website instead of uploading files. You
          can add or edit more later.
        </p>
      </div>

      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link) => {
            const Icon = PLATFORM_ICON[link.platform];
            return (
              <div key={link.id} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <Icon className="h-5 w-5 text-gray-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {link.label || PORTFOLIO_PLATFORM_LABELS[link.platform]}
                  </p>
                  <a href={link.url} target="_blank" rel="noreferrer" className="truncate text-xs text-gray-500 hover:underline">
                    {link.url}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => removeLink(link.id)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3">
            {(() => {
              const Icon = PLATFORM_ICON[detectedPlatform];
              return <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />;
            })()}
            <input
              value={urlDraft}
              onChange={(event) => { setUrlDraft(event.target.value); setFormError(null); }}
              placeholder="https://instagram.com/yourhandle"
              className="w-full bg-transparent py-3 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={addLink}
            className="inline-flex items-center justify-center gap-1 rounded-xl border-2 border-gray-900 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-900 hover:text-white"
          >
            <Plus className="h-4 w-4" /> Add Link
          </button>
        </div>
        <input
          value={labelDraft}
          onChange={(event) => setLabelDraft(event.target.value)}
          placeholder="Label (optional) — e.g. Wedding Photography Portfolio"
          className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        {formError && <p className="mt-2 text-xs font-semibold text-red-600">{formError}</p>}
      </div>
    </div>
  );
}
