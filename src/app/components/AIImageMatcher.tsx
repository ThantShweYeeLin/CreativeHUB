import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CloudUpload, ExternalLink, ImagePlus, Loader2, Maximize2, Star, Trash2, X } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';

const maxImages = 6;
const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const bins = 4;

interface UploadedImage { id: string; file: File; previewUrl: string }
export interface AIMatcherResult { id: string; portfolioId: string; freelancerId: string; freelancerName: string; specialization: string; rating: number; profileImage: string | null; imageUrl: string; title: string; matchScore: number }
interface AIImageMatcherProps { open: boolean; freelancers: any[]; onClose: () => void; onResults: (results: AIMatcherResult[]) => void }
interface AIImageMatcherResultsProps { results: AIMatcherResult[]; onReset: () => void }

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => resolve(image); image.onerror = () => reject(new Error('Unable to read image')); image.src = source;
  });
}

async function visualSignature(source: string): Promise<number[] | null> {
  try {
    const image = await loadImage(source); const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 48;
    const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) return null;
    context.drawImage(image, 0, 0, 48, 48); const pixels = context.getImageData(0, 0, 48, 48).data; const histogram = new Array(bins ** 3).fill(0); let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 128) continue;
      const r = Math.min(bins - 1, Math.floor(pixels[i] * bins / 256)); const g = Math.min(bins - 1, Math.floor(pixels[i + 1] * bins / 256)); const b = Math.min(bins - 1, Math.floor(pixels[i + 2] * bins / 256));
      histogram[r * bins * bins + g * bins + b] += 1; count += 1;
    }
    return count ? histogram.map((value) => value / count) : null;
  } catch { return null; }
}

function similarity(left: number[], right: number[]) { return Math.max(0, Math.min(1, left.reduce((sum, value, i) => sum + Math.sqrt(value * right[i]), 0))); }

function getPortfolioImages(freelancers: any[]) {
  return freelancers.flatMap((profile) => {
    const user = profile.users || {}; const freelancerId = String(profile.user_id || user.id || '');
    return (profile.portfolios || []).flatMap((portfolio: any) => (Array.isArray(portfolio.image_urls) ? portfolio.image_urls : []).filter(Boolean).map((imageUrl: string, imageIndex: number) => ({
      id: `${portfolio.id}-${imageIndex}`, portfolioId: String(portfolio.id), freelancerId, freelancerName: user.full_name || profile.title || 'Creative Freelancer', specialization: profile.title || profile.skills?.[0] || 'Creative Professional', rating: Number(user.rating || 0), profileImage: user.avatar_url || null, imageUrl, title: portfolio.title || 'Portfolio work',
    })));
  }).filter((item) => item.freelancerId);
}

export function AIImageMatcher({ open, freelancers, onClose, onResults }: AIImageMatcherProps) {
  const inputRef = useRef<HTMLInputElement | null>(null); const [uploaded, setUploaded] = useState<UploadedImage[]>([]); const [dragging, setDragging] = useState(false); const [analyzing, setAnalyzing] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!open) return; const listener = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener); }, [open, onClose]);
  useEffect(() => () => uploaded.forEach((image) => URL.revokeObjectURL(image.previewUrl)), [uploaded]);
  if (!open) return null;
  const addFiles = (list: FileList | File[]) => {
    setError(null); const files = Array.from(list); const images = files.filter((file) => acceptedTypes.includes(file.type));
    if (images.length !== files.length) setError('Only JPG, PNG, WebP, and GIF images are supported.');
    setUploaded((current) => { const remaining = maxImages - current.length; if (images.length > remaining) setError('Maximum 6 images can be uploaded.'); return [...current, ...images.slice(0, remaining).map((file) => ({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, file, previewUrl: URL.createObjectURL(file) }))]; });
  };
  const findMatches = async () => {
    if (!uploaded.length) return; setAnalyzing(true); setError(null);
    try {
      const inputSignatures = (await Promise.all(uploaded.map((image) => visualSignature(image.previewUrl)))).filter(Boolean) as number[][];
      if (!inputSignatures.length) throw new Error('We could not analyze the selected image. Please try another.');
      const candidates = getPortfolioImages(freelancers);
      const comparisons = await Promise.all(candidates.map(async (candidate) => ({ candidate, signature: await visualSignature(candidate.imageUrl) })));
      const ranked = comparisons
        .filter((item): item is { candidate: ReturnType<typeof getPortfolioImages>[number]; signature: number[] } => Boolean(item.signature))
        .map(({ candidate, signature }) => ({ ...candidate, matchScore: Math.max(...inputSignatures.map((input) => similarity(input, signature))) }))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 24);
      if (!ranked.length) throw new Error('No readable portfolio images were found yet. Ask freelancers to add portfolio photos and try again.');
      onResults(ranked); onClose();
    } catch (matchError) { setError(matchError instanceof Error ? matchError.message : 'Unable to find image matches.'); } finally { setAnalyzing(false); }
  };
  const removeImage = (id: string) => setUploaded((current) => { const image = current.find((item) => item.id === id); if (image) URL.revokeObjectURL(image.previewUrl); return current.filter((item) => item.id !== id); });
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 md:px-6"><div><h2 className="text-xl font-bold text-gray-950 md:text-2xl">AI Portfolio Matcher</h2><p className="mt-1 text-sm text-gray-600">Upload inspiration and find visually similar freelancer portfolio photos.</p></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 hover:bg-gray-100" aria-label="Close matcher"><X className="h-5 w-5" /></button></div>{analyzing ? <div className="flex min-h-[460px] flex-col items-center justify-center px-6 py-12 text-center"><div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gray-950 text-white"><Loader2 className="h-8 w-8 animate-spin" /></div><h3 className="text-xl font-bold text-gray-950">Comparing portfolio images...</h3><p className="mt-2 text-sm text-gray-600">Analyzing visual color and style across freelancer work.</p></div> : <div className="max-h-[calc(92vh-88px)] overflow-y-auto px-5 py-5 md:px-6"><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} /><button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }} className={`flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center ${dragging ? 'border-gray-950 bg-gray-50' : 'border-gray-300 bg-white hover:border-gray-500 hover:bg-gray-50'}`}><div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gray-100"><CloudUpload className="h-8 w-8" /></div><p className="text-lg font-bold text-gray-950">Upload an inspiration image</p><p className="mt-2 text-sm text-gray-600">Drag and drop, or click to browse</p><p className="mt-1 text-xs text-gray-500">JPG, PNG, WebP, GIF · up to 6 images</p></button>{error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{uploaded.length > 0 && <div className="mt-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-gray-950">Images ({uploaded.length}/6)</h3><button type="button" onClick={() => inputRef.current?.click()} disabled={uploaded.length >= maxImages} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"><ImagePlus className="h-4 w-4" />Add more</button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">{uploaded.map((image) => <div key={image.id} className="relative aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"><img src={image.previewUrl} alt={image.file.name} className="h-full w-full object-cover" /><button type="button" onClick={() => removeImage(image.id)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-gray-700 shadow-sm"><Trash2 className="h-4 w-4" /></button></div>)}</div></div>}<p className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600">Your inspiration remains in this browser. We compare its visual color signature with public portfolio photos, then show the closest matches.</p><div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5"><button type="button" onClick={() => setUploaded([])} className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700">Clear all</button><button type="button" onClick={() => void findMatches()} disabled={!uploaded.length} className="rounded-2xl bg-gray-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300">Find similar portfolio photos</button></div></div>}</div></div>;
}

export function AIImageMatcherResults({ results, onReset }: AIImageMatcherResultsProps) {
  const navigate = useNavigate(); const [selected, setSelected] = useState<AIMatcherResult | null>(null);
  return <section className="mb-12 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg md:p-6"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold text-gray-500">AI Portfolio Matcher</p><h2 className="mt-1 text-2xl font-bold text-gray-950 md:text-3xl">Similar portfolio photos</h2><p className="mt-1 text-sm text-gray-600">{results.length} visual matches from freelancer portfolios.</p></div><button onClick={onReset} className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700">Start new match</button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{results.map((result) => <article key={result.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><button onClick={() => setSelected(result)} className="group relative block h-52 w-full bg-gray-100"><ImageWithFallback src={result.imageUrl} alt={result.title} className="h-full w-full object-cover" /><span className="absolute right-3 top-3 rounded-xl bg-black/70 px-2.5 py-1 text-xs font-bold text-white">{Math.round(result.matchScore * 100)}% similar</span><Maximize2 className="absolute inset-0 m-auto h-6 w-6 text-white opacity-0 group-hover:opacity-100" /></button><div className="p-4"><p className="truncate font-bold text-gray-950">{result.title}</p><div className="mt-3 flex items-center gap-3"><ImageWithFallback src={result.profileImage || ''} alt="" className="h-9 w-9 rounded-full object-cover" /><div className="min-w-0"><p className="truncate text-sm font-bold text-gray-900">{result.freelancerName}</p><p className="truncate text-xs text-gray-500">{result.specialization}</p></div><span className="ml-auto flex items-center gap-1 text-xs font-bold"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />{result.rating ? result.rating.toFixed(1) : 'New'}</span></div><button onClick={() => navigate(`/profile/${result.freelancerId}`)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white">View freelancer profile <ExternalLink className="h-4 w-4" /></button></div></article>)}</div>{selected && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" onClick={() => setSelected(null)}><div className="max-h-[92vh] max-w-5xl overflow-auto rounded-2xl bg-white" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between px-4 py-3"><div><p className="font-bold text-gray-950">{selected.title}</p><p className="text-sm text-gray-500">by {selected.freelancerName}</p></div><button onClick={() => setSelected(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-gray-100"><X className="h-5 w-5" /></button></div><ImageWithFallback src={selected.imageUrl} alt={selected.title} className="max-h-[72vh] w-full object-contain bg-gray-100" /><button onClick={() => navigate(`/profile/${selected.freelancerId}`)} className="m-4 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white">Visit {selected.freelancerName}'s profile</button></div></div>}</section>;
}
