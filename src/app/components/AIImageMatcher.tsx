import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CloudUpload, ExternalLink, Info, Loader2, Sparkles, Star, X } from 'lucide-react';
import { Avatar } from '../../components/common/Avatar';
import { SocialLinksRow } from '../../components/common/SocialLinksRow';
import type { Gender } from '../../lib/database.types';
import { DataService } from '../../lib/dataService';
import type { SocialLink } from '../../lib/socialPlatforms';
import { FREELANCER_CATEGORY_LABELS } from '../../lib/categories';
import { buildClientQueryText, detectImageStyle, embedText } from '../../lib/aiMatching';

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 500;
const MAX_IMAGES = 6;

export interface AIMatcherResult {
  id: string;
  fullName: string;
  category: string;
  styles: string[];
  matchPercent: number;
  rating: number;
  profileImage: string | null;
  profileGender: Gender | null;
  location: string | null;
  socialLinks: SocialLink[];
}

interface AIImageMatcherProps { open: boolean; onClose: () => void; onResults: (results: AIMatcherResult[], note?: string) => void }
interface AIImageMatcherResultsProps { results: AIMatcherResult[]; note?: string | null; onReset: () => void }

function mapFreelancerRow(row: any): AIMatcherResult {
  const user = row.users || {};
  return {
    id: String(row.user_id || user.id || row.id),
    fullName: user.full_name || row.title || 'Creative Freelancer',
    category: row.title || 'Creative Professional',
    styles: Array.isArray(row.styles) ? row.styles : [],
    matchPercent: Math.round(Number(row.similarity || 0) * 100),
    rating: Number(user.rating || 0),
    profileImage: user.avatar_url || null,
    profileGender: user.gender || null,
    location: user.location || null,
    socialLinks: Array.isArray(row.social_links) ? row.social_links : [],
  };
}

export function AIImageMatcher({ open, onClose, onResults }: AIImageMatcherProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [dragging, setDragging] = useState(false);

  const [images, setImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<'idle' | 'analyzing' | 'matching'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const trimmedDescription = description.trim();
  const descriptionProvided = trimmedDescription.length > 0;
  const descriptionLengthOk = !descriptionProvided || (trimmedDescription.length >= DESCRIPTION_MIN && trimmedDescription.length <= DESCRIPTION_MAX);
  const canSubmit = !!category && descriptionLengthOk && (descriptionProvided || images.length > 0) && !isSubmitting;

  const revokeAllPreviews = (list: { previewUrl: string }[]) => {
    list.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  };

  const reset = () => {
    revokeAllPreviews(images);
    setCategory('');
    setDescription('');
    setImages([]);
    setImageError(null);
    setIsSubmitting(false);
    setSubmitStage('idle');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const removeImage = (index: number) => {
    setImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  };

  const addFiles = (fileList: FileList | File[]) => {
    setImageError(null);
    const incoming = Array.from(fileList);
    const invalid = incoming.some((file) => !acceptedTypes.includes(file.type));
    if (invalid) {
      setImageError('Only JPG, PNG, WebP, and GIF images are supported.');
      return;
    }

    setImages((current) => {
      const room = MAX_IMAGES - current.length;
      if (room <= 0) {
        setImageError(`You can add up to ${MAX_IMAGES} images.`);
        return current;
      }
      const accepted = incoming.slice(0, room);
      if (incoming.length > accepted.length) {
        setImageError(`Only the first ${accepted.length} image(s) were added — up to ${MAX_IMAGES} images total.`);
      }
      return [...current, ...accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))];
    });
  };

  const handleFindMatches = async () => {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);

    try {
      let effectiveDescription = trimmedDescription;
      let mismatchNote: string | undefined;

      if (images.length > 0) {
        setSubmitStage('analyzing');
        try {
          const { detections } = await detectImageStyle(images.map((image) => image.file));
          const top = detections[0];
          if (top?.style) {
            effectiveDescription = effectiveDescription
              ? `${effectiveDescription}\n\nReference image context: ${top.style} style.`
              : `${top.style} style, based on ${images.length > 1 ? 'uploaded reference images' : 'an uploaded reference image'}.`;
          }
          if (top?.category && top.category !== category) {
            mismatchNote = `Your reference ${images.length > 1 ? 'images look' : 'image looks'} more like ${top.category}, but results below are matched within ${category} since that's what you selected — the ${images.length > 1 ? 'images were' : 'image was'} only used as style inspiration.`;
          }
        } catch (imageAnalysisError) {
          // Image analysis is optional context — a slow or failed classification
          // should never block the search itself, only fall back to text-only.
          mismatchNote =
            imageAnalysisError instanceof Error
              ? `${imageAnalysisError.message} Matching continues using your description only.`
              : 'Unable to analyze your image(s) — matching continues using your description only.';
        }
      }

      setSubmitStage('matching');
      const queryText = buildClientQueryText({ category, description: effectiveDescription });
      const embedding = await embedText(queryText);
      const { data, error: matchError } = await DataService.matchFreelancersByStyle(category, embedding);
      if (matchError) {
        throw new Error((matchError as any).message || 'Unable to find matches right now.');
      }

      const results = (data || []).map(mapFreelancerRow);
      onResults(results, mismatchNote);
      handleClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to find matches right now.');
      setIsSubmitting(false);
      setSubmitStage('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 md:px-6">
          <div>
            <h2 className="text-xl font-bold text-gray-950 md:text-2xl">AI Match Finder</h2>
            <p className="mt-1 text-sm text-gray-600">Describe the style you want, or upload inspiration — we'll rank freelancers by how closely their profile matches.</p>
          </div>
          <button onClick={handleClose} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-gray-500 hover:bg-gray-100" aria-label="Close AI Match Finder">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-5 py-5 md:px-6">
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-950">1. What professional are you looking for?</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select a category</option>
                {FREELANCER_CATEGORY_LABELS.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-950">2. Describe your desired style</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="e.g. Soft Korean-inspired bridal makeup with dewy skin, natural pink tones, and an elegant romantic feeling."
                className="min-h-[100px] w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className={!descriptionLengthOk ? 'font-semibold text-red-600' : 'text-gray-400'}>
                  {!descriptionProvided
                    ? `Tell us about the style, mood, colors, occasion, or look you want (min ${DESCRIPTION_MIN} characters).`
                    : !descriptionLengthOk && trimmedDescription.length < DESCRIPTION_MIN
                    ? `A little more detail helps — at least ${DESCRIPTION_MIN} characters.`
                    : !descriptionLengthOk
                    ? `Keep it under ${DESCRIPTION_MAX} characters.`
                    : ''}
                </span>
                <span className="text-gray-400">{trimmedDescription.length}/{DESCRIPTION_MAX}</span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-950">3. Add inspiration images <span className="font-normal text-gray-400">(optional)</span></label>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = '';
                }}
              />

              {images.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {images.map((image, index) => (
                    <div key={image.previewUrl} className="group relative h-16 w-16 flex-shrink-0">
                      <img src={image.previewUrl} alt={`Inspiration ${index + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gray-900 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label={`Remove image ${index + 1}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
                  className={`flex min-h-[100px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-6 text-center ${dragging ? 'border-gray-950 bg-gray-50' : 'border-gray-300 bg-white hover:border-gray-500 hover:bg-gray-50'}`}
                >
                  <CloudUpload className="mb-2 h-6 w-6 text-gray-500" />
                  <p className="text-sm font-semibold text-gray-900">{images.length > 0 ? 'Add another image' : 'Upload reference images'}</p>
                  <p className="mt-1 text-xs text-gray-500">JPG, PNG, WebP, or GIF — up to {MAX_IMAGES}</p>
                </button>
              )}

              {imageError && <p className="mt-2 text-xs font-semibold text-red-600">{imageError}</p>}
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void handleFindMatches()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gray-900 to-black px-4 py-3.5 text-sm font-bold text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {submitStage === 'analyzing' ? 'Analyzing your image...' : submitStage === 'matching' ? 'Finding your match...' : 'Find My Creative Match'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIImageMatcherResults({ results, note, onReset }: AIImageMatcherResultsProps) {
  const navigate = useNavigate();
  const sorted = useMemo(() => [...results].sort((a, b) => b.matchPercent - a.matchPercent), [results]);

  return (
    <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg md:p-6">
      <div className="mb-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500">AI Match Finder</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950 md:text-3xl">✨ Best Semantic Matches</h2>
          <p className="mt-1 text-sm text-gray-600">{sorted.length} freelancer{sorted.length === 1 ? '' : 's'} found.</p>
        </div>
        <button onClick={onReset} className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700">Start new match</button>
      </div>
      {note && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{note}</span>
        </div>
      )}
      <p className="mb-5 flex items-start gap-1.5 text-xs text-gray-500">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        Semantic Match shows how closely each freelancer's profile matches your request — it's a similarity measure, not a guarantee of quality or suitability.
      </p>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">
          No freelancers matched that category yet. Try a broader description or check back later.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((result) => (
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

              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-950 px-3 py-1 text-xs font-bold text-white">
                <Sparkles className="h-3 w-3" /> {result.matchPercent}% Semantic Match
              </div>

              {result.styles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {result.styles.map((style) => (
                    <span key={style} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                      {style}
                    </span>
                  ))}
                </div>
              )}

              <SocialLinksRow links={result.socialLinks} className="mt-4 flex flex-wrap gap-2" />

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
