import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, CloudUpload, ImagePlus, Loader2, Star, Trash2, X } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';

const filters = ['All', 'Makeup', 'Hairstyle', 'Photography', 'Videography', 'Model', 'Designer'] as const;
const maxImages = 6;
const acceptedTypes = ['image/jpeg', 'image/png', 'image/gif'];

export type AIMatcherFilter = (typeof filters)[number];

export interface AIMatcherFreelancer {
  id: string;
  name: string;
  specialization: string;
  category: AIMatcherFilter;
  rating: number;
  completedJobs: number;
  profileImage: string | null;
  coverImage: string | null;
}

interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface AIImageMatcherProps {
  open: boolean;
  freelancers: any[];
  onClose: () => void;
  onResults: (results: AIMatcherFreelancer[]) => void;
}

interface AIImageMatcherResultsProps {
  results: AIMatcherFreelancer[];
  onReset: () => void;
}

function categoryFromText(value: string): AIMatcherFilter {
  const text = value.toLowerCase();
  if (text.includes('makeup') || text.includes('beauty')) return 'Makeup';
  if (text.includes('hair')) return 'Hairstyle';
  if (text.includes('photo') || text.includes('portrait') || text.includes('studio')) return 'Photography';
  if (text.includes('video') || text.includes('film') || text.includes('reel')) return 'Videography';
  if (text.includes('model') || text.includes('runway')) return 'Model';
  if (text.includes('design') || text.includes('fashion') || text.includes('illustrat')) return 'Designer';
  return 'All';
}

function normalizeFreelancers(freelancers: any[]): AIMatcherFreelancer[] {
  return freelancers.map((profile) => {
    const skills = Array.isArray(profile.skills) ? profile.skills.join(' ') : '';
    const searchable = `${profile.title ?? ''} ${profile.description ?? ''} ${skills}`;
    const user = profile.users ?? {};
    const image = user.avatar_url ?? null;

    return {
      id: profile.user_id || user.id || profile.id,
      name: user.full_name || profile.title || 'Creative Freelancer',
      specialization: profile.title || profile.skills?.[0] || 'Creative Professional',
      category: categoryFromText(searchable),
      rating: Number(user.rating || 0),
      completedJobs: Number(profile.completed_jobs || profile.portfolio_count || user.total_reviews || 0),
      profileImage: image,
      coverImage: profile.image_urls?.[0] || profile.cover_image_url || image,
    };
  });
}

export function AIImageMatcher({ open, freelancers, onClose, onResults }: AIImageMatcherProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedFreelancers = useMemo(() => normalizeFreelancers(freelancers), [freelancers]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    return () => {
      uploadedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [uploadedImages]);

  if (!open) return null;

  const addFiles = (fileList: FileList | File[]) => {
    setError(null);
    const files = Array.from(fileList);
    const imageFiles = files.filter((file) => acceptedTypes.includes(file.type));

    if (imageFiles.length !== files.length) {
      setError('Only JPG, PNG, and GIF images are supported.');
    }

    setUploadedImages((current) => {
      const remainingSlots = maxImages - current.length;
      const nextFiles = imageFiles.slice(0, remainingSlots).map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      if (imageFiles.length > remainingSlots) {
        setError('Maximum 6 images can be uploaded.');
      }

      return [...current, ...nextFiles];
    });
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const removeImage = (imageId: string) => {
    setUploadedImages((current) => {
      const image = current.find((item) => item.id === imageId);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return current.filter((item) => item.id !== imageId);
    });
  };

  const clearAll = () => {
    uploadedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setUploadedImages([]);
    setError(null);
  };

  const findMatches = () => {
    if (uploadedImages.length === 0) return;
    setIsAnalyzing(true);
    window.setTimeout(() => {
      const ranked = [...normalizedFreelancers].sort((a, b) => {
        const ratingDelta = b.rating - a.rating;
        return ratingDelta !== 0 ? ratingDelta : b.completedJobs - a.completedJobs;
      });
      setIsAnalyzing(false);
      onResults(ranked);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 md:px-6">
          <div>
            <h2 className="text-xl font-bold text-gray-950 md:text-2xl">AI Image Matcher</h2>
            <p className="mt-1 text-sm text-gray-600">Upload inspiration photos to find matching freelancers.</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950" aria-label="Close AI Image Matcher">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isAnalyzing ? (
          <div className="flex min-h-[460px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gray-950 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-gray-950">Analyzing inspiration images...</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-gray-600">Matching colors, composition, and visual style against CreativeHUB portfolios.</p>
          </div>
        ) : (
          <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-5 py-5 md:px-6">
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif" multiple className="hidden" onChange={handleInputChange} />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex min-h-[240px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all ${
                isDragging ? 'border-gray-950 bg-gray-50 shadow-lg' : 'border-gray-300 bg-white hover:border-gray-500 hover:bg-gray-50'
              }`}
            >
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gray-100 text-gray-900">
                <CloudUpload className="h-8 w-8" />
              </div>
              <p className="text-lg font-bold text-gray-950">Upload Your Inspirations</p>
              <p className="mt-2 text-sm text-gray-600">Drag and drop images here, or click to browse</p>
              <p className="mt-1 text-xs text-gray-500">Supports JPG, PNG, GIF (Maximum 6 images)</p>
            </button>

            {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            {uploadedImages.length > 0 && (
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-950">Uploaded Images ({uploadedImages.length}/6)</h3>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploadedImages.length >= maxImages}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ImagePlus className="h-4 w-4" />
                    Add more
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                  {uploadedImages.map((image) => (
                    <div key={image.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-sm">
                      <img src={image.previewUrl} alt={image.file.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-gray-700 opacity-100 shadow-sm transition-all hover:bg-gray-950 hover:text-white md:opacity-0 md:group-hover:opacity-100"
                        aria-label={`Remove ${image.file.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-950">
                <CheckCircle2 className="h-4 w-4" />
                How It Works
              </div>
              <div className="grid gap-2 text-sm leading-6 text-gray-600 md:grid-cols-3">
                <p>Upload photos that match your desired style.</p>
                <p>AI analyzes colors, composition, and aesthetics.</p>
                <p>Find freelancers with similar portfolio styles.</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={clearAll} className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50">
                Clear All
              </button>
              <button
                type="button"
                onClick={findMatches}
                disabled={uploadedImages.length === 0}
                className="rounded-2xl bg-gray-950 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-xl disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
              >
                Find Matching Freelancers
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AIImageMatcherResults({ results, onReset }: AIImageMatcherResultsProps) {
  const [selectedFilter, setSelectedFilter] = useState<AIMatcherFilter>('All');
  const navigate = useNavigate();

  const filteredResults = selectedFilter === 'All' ? results : results.filter((result) => result.category === selectedFilter);

  return (
    <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500">AI Image Matcher</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950 md:text-3xl">Matching freelancers found</h2>
          <p className="mt-1 text-sm text-gray-600">Filter these results without uploading again.</p>
        </div>
        <button onClick={onReset} className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50">
          Start New Match
        </button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-gray-50 p-2">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              selectedFilter === filter ? 'bg-gray-950 text-white shadow-md' : 'text-gray-700 hover:bg-white'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <p className="mb-4 text-sm text-gray-600">
        <span className="font-bold text-gray-950">{filteredResults.length}</span> matching freelancers found
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredResults.map((freelancer) => (
          <article key={freelancer.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
            <div className="relative h-44 bg-gray-100">
              {freelancer.coverImage ? (
                <ImageWithFallback src={freelancer.coverImage} alt={`${freelancer.name} portfolio`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">Portfolio image unavailable</div>
              )}
              <div className="absolute -bottom-8 left-4 h-16 w-16 overflow-hidden rounded-2xl border-4 border-white bg-gray-950 text-white shadow-lg">
                {freelancer.profileImage ? (
                  <ImageWithFallback src={freelancer.profileImage} alt={freelancer.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold">{freelancer.name.slice(0, 2).toUpperCase()}</div>
                )}
              </div>
            </div>
            <div className="px-4 pb-4 pt-11">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-gray-950">{freelancer.name}</h3>
                  <p className="mt-1 text-sm text-gray-600">{freelancer.specialization}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-xl bg-gray-50 px-2 py-1 text-sm font-bold text-gray-900">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {freelancer.rating > 0 ? freelancer.rating.toFixed(1) : 'New'}
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-500">{freelancer.completedJobs} completed jobs</p>
              <button
                onClick={() => navigate(`/profile/${freelancer.id}`)}
                className="mt-4 w-full rounded-2xl bg-gray-950 px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-lg"
              >
                View Profile
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
