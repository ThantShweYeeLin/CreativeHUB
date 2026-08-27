import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CloudUpload, ExternalLink, Globe, Instagram, Loader2, Music2, Pencil, Sparkles, Star, X } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import type { Gender } from '../../lib/database.types';
import { DataService } from '../../lib/dataService';
import { parseSocialLinks, toSocialUrl, type SocialLinks } from '../../lib/socialLinks';

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000/api';

export interface AIMatcherResult {
  id: string;
  fullName: string;
  category: string;
  styles: string[];
  matchedStyle: string | null;
  rating: number;
  profileImage: string | null;
  profileGender: Gender | null;
  location: string | null;
  socialLinks: SocialLinks;
}

// The set of categories/styles the AI was allowed to choose from — read live
// from freelancer_profiles by the server, so "Change" only ever offers
// values that real freelancers on CreativeHUB actually have.
type Taxonomy = Record<string, string[]>;
interface Detection { category: string; style: string | null }
type Step = 'upload' | 'analyzing' | 'confirm' | 'searching';

interface AIImageMatcherProps { open: boolean; onClose: () => void; onResults: (results: AIMatcherResult[]) => void }
interface AIImageMatcherResultsProps { results: AIMatcherResult[]; onReset: () => void }

function mapFreelancerRow(row: any, style: string | null): AIMatcherResult {
  const user = row.users || {};
  const styles: string[] = Array.isArray(row.styles) ? row.styles : [];
  return {
    id: String(row.user_id || user.id || row.id),
    fullName: user.full_name || row.title || 'Creative Freelancer',
    category: row.title || 'Creative Professional',
    styles,
    matchedStyle: style && styles.includes(style) ? style : null,
    rating: Number(user.rating || 0),
    profileImage: user.avatar_url || null,
    profileGender: user.gender || null,
    location: user.location || null,
    socialLinks: parseSocialLinks(row.description),
  };
}

export function AIImageMatcher({ open, onClose, onResults }: AIImageMatcherProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({});
  const [isEditing, setIsEditing] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStep('upload');
    setDetection(null);
    setTaxonomy({});
    setIsEditing(false);
    setCategory(null);
    setStyle(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const analyze = async (file: File) => {
    setStep('analyzing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch(`${API_BASE}/ai-matcher/detect`, { method: 'POST', body: formData });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.message || 'Unable to analyze the image right now.');
      }

      setDetection({ category: body.category, style: body.style ?? null });
      setTaxonomy(body.taxonomy ?? {});
      setCategory(body.category);
      setStyle(body.style ?? null);
      setIsEditing(false);
      setStep('confirm');
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : 'Unable to analyze the image right now.');
      setStep('upload');
    }
  };

  const addFile = (fileList: FileList | File[]) => {
    setError(null);
    const file = Array.from(fileList)[0];
    if (!file) return;
    if (!acceptedTypes.includes(file.type)) {
      setError('Only JPG, PNG, WebP, and GIF images are supported.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    void analyze(file);
  };

  const findFreelancers = async () => {
    if (!category) return;
    setStep('searching');
    setError(null);

    const { data, error: searchError } = await DataService.searchFreelancersByCategoryAndStyle(category, style);
    if (searchError) {
      setError((searchError as any).message || 'Unable to search freelancers.');
      setStep('confirm');
      return;
    }

    const results = (data || []).map((row: any) => mapFreelancerRow(row, style));
    onResults(results);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 md:px-6">
          <div>
            <h2 className="text-xl font-bold text-gray-950 md:text-2xl">AI Matcher</h2>
            <p className="mt-1 text-sm text-gray-600">Upload an inspiration photo and we'll find freelancers who do that style.</p>
          </div>
          <button onClick={handleClose} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100" aria-label="Close matcher">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-5 py-5 md:px-6">
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {step === 'upload' && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  if (event.target.files) addFile(event.target.files);
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); setDragging(false); addFile(event.dataTransfer.files); }}
                className={`flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center ${dragging ? 'border-gray-950 bg-gray-50' : 'border-gray-300 bg-white hover:border-gray-500 hover:bg-gray-50'}`}
              >
                <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gray-100">
                  <CloudUpload className="h-8 w-8" />
                </div>
                <p className="text-lg font-bold text-gray-950">Upload an inspiration image</p>
                <p className="mt-2 text-sm text-gray-600">Drag and drop, or click to browse</p>
                <p className="mt-1 text-xs text-gray-500">JPG, PNG, WebP, or GIF</p>
              </button>
            </>
          )}

          {step === 'analyzing' && (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-8 text-center">
              {previewUrl && <img src={previewUrl} alt="Inspiration upload" className="mb-5 h-32 w-32 rounded-2xl object-cover" />}
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gray-950 text-white">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-gray-950">Analyzing your photo...</h3>
              <p className="mt-2 text-sm text-gray-600">Detecting category and style.</p>
            </div>
          )}

          {(step === 'confirm' || step === 'searching') && detection && category && (
            <div>
              <div className="flex flex-col gap-5 sm:flex-row">
                {previewUrl && <img src={previewUrl} alt="Inspiration upload" className="h-40 w-40 flex-shrink-0 rounded-2xl object-cover" />}
                <div className="flex-1">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-950">
                    <Sparkles className="h-4 w-4" /> AI Detected
                  </div>

                  {!isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Category</p>
                        <p className="text-lg font-bold text-gray-950">{category}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Style</p>
                        <p className="text-lg font-bold text-gray-950">{style || 'No exact style match'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="mt-2 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="h-4 w-4" /> Change
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm text-gray-600">Category</label>
                        <select
                          value={category}
                          onChange={(event) => { setCategory(event.target.value); setStyle(null); }}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold"
                        >
                          {Object.keys(taxonomy).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-gray-600">Style</label>
                        <select
                          value={style ?? ''}
                          onChange={(event) => setStyle(event.target.value || null)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold"
                        >
                          <option value="">Any style</option>
                          {(taxonomy[category] ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={() => void findFreelancers()}
                  disabled={step === 'searching'}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gray-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {step === 'searching' && <Loader2 className="h-4 w-4 animate-spin" />}
                  Find Freelancers
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SocialButton({ platform, value, icon: Icon, label }: { platform: keyof SocialLinks; value?: string; icon: typeof Instagram; label: string }) {
  if (!value) return null;
  return (
    <a
      href={toSocialUrl(platform, value)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

export function AIImageMatcherResults({ results, onReset }: AIImageMatcherResultsProps) {
  const navigate = useNavigate();

  return (
    <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500">AI Matcher</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950 md:text-3xl">Matching Freelancers</h2>
          <p className="mt-1 text-sm text-gray-600">{results.length} freelancer{results.length === 1 ? '' : 's'} found.</p>
        </div>
        <button onClick={onReset} className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700">Start new match</button>
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">
          No freelancers matched that category and style yet. Try a broader style or check back later.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((result) => (
            <article key={result.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar src={result.profileImage || ''} alt={result.fullName} gender={result.profileGender} sizeClassName="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-gray-950">{result.fullName}</p>
                  <p className="truncate text-sm text-gray-600">{result.category}</p>
                </div>
                {result.rating > 0 && (
                  <span className="flex flex-shrink-0 items-center gap-1 text-xs font-bold">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />{result.rating.toFixed(1)}
                  </span>
                )}
              </div>

              {result.styles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {result.styles.map((style) => (
                    <span
                      key={style}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style === result.matchedStyle ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      {style}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <SocialButton platform="instagram" value={result.socialLinks.instagram} icon={Instagram} label="Instagram" />
                <SocialButton platform="tiktok" value={result.socialLinks.tiktok} icon={Music2} label="TikTok" />
                <SocialButton platform="behance" value={result.socialLinks.behance} icon={ExternalLink} label="Behance" />
                <SocialButton platform="website" value={result.socialLinks.website} icon={Globe} label="Website" />
              </div>

              <button
                onClick={() => navigate(`/profile/${result.id}`)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white"
              >
                View Profile <ExternalLink className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
