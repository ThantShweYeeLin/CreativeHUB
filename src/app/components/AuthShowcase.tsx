import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { MapPin, Star, Users } from 'lucide-react';
import logoImage from '../../imports/logo.png';
import { DataService, type AuthShowcaseData } from '../../lib/dataService';

interface AuthShowcaseProps {
  variant: 'login' | 'signup';
  headline: ReactNode;
  subtitle: string;
}

type Slide =
  | { kind: 'stats' }
  | { kind: 'testimonial'; index: number }
  | { kind: 'spotlight'; index: number };

const ROTATE_MS = 6000;

function useCountUp(target: number, active: boolean, durationMs = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);
  return value;
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K+`;
  if (n >= 50) return `${Math.floor(n / 10) * 10}+`;
  return `${n}`;
}

function entranceClass(dir: 1 | -1) {
  return dir === 1 ? 'zoom-in-95 slide-in-from-right-6' : 'zoom-in-95 slide-in-from-left-6';
}

export function AuthShowcase({ variant, headline, subtitle }: AuthShowcaseProps) {
  const [data, setData] = useState<AuthShowcaseData | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void DataService.getAuthShowcaseData().then(({ data: result }) => {
      if (!cancelled && result) setData(result);
    });
    return () => { cancelled = true; };
  }, []);

  const spotlights = data?.spotlights || [];

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [{ kind: 'stats' }];
    (data?.testimonials || []).forEach((_, index) => list.push({ kind: 'testimonial', index }));
    spotlights.forEach((_, index) => list.push({ kind: 'spotlight', index }));
    return list;
  }, [data, spotlights]);

  const boundedActive = activeSlide % slides.length;

  const timeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (paused || dragging || slides.length <= 1) return;
    timeoutRef.current = setInterval(() => {
      setDirection(1);
      setActiveSlide((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => { if (timeoutRef.current) clearInterval(timeoutRef.current); };
  }, [paused, dragging, slides.length]);

  const goToSlide = (index: number) => {
    setDirection(index >= boundedActive ? 1 : -1);
    setActiveSlide(index);
  };

  const step = (delta: 1 | -1) => {
    setDirection(delta);
    setActiveSlide((i) => (i + delta + slides.length) % slides.length);
  };

  const SWIPE_THRESHOLD = 50;

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (slides.length <= 1) return;
    dragStartX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    setDragOffset(e.clientX - dragStartX.current);
  };

  const endDrag = () => {
    if (dragStartX.current === null) return;
    if (dragOffset <= -SWIPE_THRESHOLD) step(1);
    else if (dragOffset >= SWIPE_THRESHOLD) step(-1);
    dragStartX.current = null;
    setDragOffset(0);
    setDragging(false);
  };

  const radialStyle = variant === 'login'
    ? 'radial-gradient(circle at 30% 50%, #ffffff 0%, transparent 60%), radial-gradient(circle at 80% 20%, #ffffff 0%, transparent 40%)'
    : 'radial-gradient(circle at 70% 50%, #ffffff 0%, transparent 60%), radial-gradient(circle at 20% 80%, #ffffff 0%, transparent 40%)';

  const slide = slides[boundedActive];
  const avatars = data?.avatars || [];
  const overflowCount = data ? Math.max(0, data.freelancerCount - avatars.length) : 0;

  return (
    <div
      className="hidden lg:flex lg:w-1/2 bg-gray-950 flex-col justify-between p-12 relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes authShowcaseFill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: radialStyle }} />
      <img src={logoImage} alt="CreativeHUB AI" className="h-14 w-14 rounded-full object-cover relative z-10" />

      <div className="relative z-10">
        <h1 className="text-5xl font-bold text-white leading-tight mb-6">{headline}</h1>
        <p className="text-gray-400 text-lg leading-relaxed max-w-sm mb-8">{subtitle}</p>

        <div
          className="min-h-[196px] touch-pan-y select-none"
          style={{
            cursor: slides.length > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
            transform: dragging ? `translateX(${dragOffset}px)` : 'translateX(0)',
            opacity: dragging ? Math.max(0.6, 1 - Math.abs(dragOffset) / 400) : 1,
            transition: dragging ? 'none' : 'transform 300ms ease-out, opacity 300ms ease-out',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {slide?.kind === 'stats' && (
            <div key={`stats-${boundedActive}`} className={`animate-in fade-in ${entranceClass(direction)} duration-700 ease-out`}>
              <StatsCard data={data} active />
              {avatars.length >= 2 && (
                <div className="flex gap-3 mt-5">
                  {avatars.slice(0, 5).map((a) => (
                    <AvatarTile key={a.avatarUrl} name={a.name} avatarUrl={a.avatarUrl} />
                  ))}
                  {overflowCount > 0 && (
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white text-xs font-semibold">
                      +{formatCount(overflowCount)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {slide?.kind === 'testimonial' && data?.testimonials[slide.index] && (
            <TestimonialCard key={`testimonial-${boundedActive}`} t={data.testimonials[slide.index]} dir={direction} />
          )}

          {slide?.kind === 'spotlight' && spotlights[slide.index] && (
            <SpotlightCard key={`spotlight-${boundedActive}`} s={spotlights[slide.index]} dir={direction} />
          )}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="relative z-10 flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToSlide(i)}
              aria-label={`Show slide ${i + 1}`}
              className="h-1 flex-1 max-w-12 rounded-full bg-white/15 overflow-hidden"
            >
              {i === boundedActive ? (
                <div
                  key={`fill-${boundedActive}`}
                  className="h-full bg-white rounded-full"
                  style={{
                    animation: `authShowcaseFill ${ROTATE_MS}ms linear forwards`,
                    animationPlayState: paused ? 'paused' : 'running',
                  }}
                />
              ) : i < boundedActive ? (
                <div className="h-full w-full bg-white/60 rounded-full" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsCard({ data, active }: { data: AuthShowcaseData | null; active: boolean }) {
  const freelancers = useCountUp(data?.freelancerCount || 0, active && !!data);
  const rating = data?.avgRating || 0;
  const totalReviews = data?.totalReviews || 0;

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 divide-y divide-white/10">
      <div className="flex items-center gap-3.5 px-5 py-4">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-xl font-bold text-white leading-tight">
            {data ? formatCount(freelancers) : '—'} <span className="font-medium text-gray-400 text-sm">freelancers ready to book</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3.5 px-5 py-4">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
        </div>
        <div>
          <div className="text-xl font-bold text-white leading-tight">
            {rating > 0 ? rating.toFixed(1) : '—'} <span className="font-medium text-gray-400 text-sm">
              {totalReviews > 0 ? `avg. rating from ${totalReviews} verified review${totalReviews === 1 ? '' : 's'}` : 'avg. rating · new platform'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AvatarTile({ name, avatarUrl }: { name: string; avatarUrl: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-white/10" title={name}>
      <img src={avatarUrl} alt={name} className="w-full h-full object-cover" onError={() => setBroken(true)} />
    </div>
  );
}

function SafeAvatar({ name, avatarUrl, className, ringClassName = '' }: { name: string; avatarUrl: string | null; className: string; ringClassName?: string }) {
  const [broken, setBroken] = useState(false);
  if (avatarUrl && !broken) {
    return <img src={avatarUrl} alt="" className={`${className} object-cover ${ringClassName}`} onError={() => setBroken(true)} />;
  }
  return (
    <div className={`${className} bg-white/10 flex items-center justify-center text-white text-xs font-semibold ${ringClassName}`}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function TestimonialCard({ t, dir }: { t: NonNullable<AuthShowcaseData['testimonials']>[number]; dir: 1 | -1 }) {
  return (
    <div className={`bg-white/5 rounded-2xl p-5 border border-white/10 min-h-[196px] flex flex-col justify-between animate-in fade-in ${entranceClass(dir)} duration-700 ease-out`}>
      <div>
        <div className="flex gap-0.5 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(t.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`} />
          ))}
        </div>
        <p className="text-white text-sm italic leading-relaxed line-clamp-5">"{t.comment}"</p>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <SafeAvatar name={t.reviewerName} avatarUrl={t.reviewerAvatar} className="w-9 h-9 rounded-full" />
        <div>
          <div className="text-white text-sm font-semibold">{t.reviewerName}</div>
          <div className="text-gray-500 text-xs">
            {t.revieweeName ? `Verified booking · worked with ${t.revieweeName}` : 'Verified booking'}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpotlightCard({ s, dir }: { s: NonNullable<AuthShowcaseData['spotlights']>[number]; dir: 1 | -1 }) {
  return (
    <div className={`bg-white/5 rounded-2xl p-5 border border-white/10 min-h-[196px] flex flex-col justify-between animate-in fade-in ${entranceClass(dir)} duration-700 ease-out`}>
      <div className="flex items-start gap-4">
        <SafeAvatar name={s.name} avatarUrl={s.avatarUrl} className="w-14 h-14 rounded-2xl flex-shrink-0" ringClassName="ring-2 ring-white/10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold truncate">{s.name}</span>
            {s.rating > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-400 flex-shrink-0">
                <Star className="w-3 h-3 fill-yellow-400" /> {s.rating.toFixed(1)}
              </span>
            )}
          </div>
          {s.title && <p className="text-gray-400 text-sm truncate mt-0.5">{s.title}</p>}
          {s.location && (
            <p className="text-gray-500 text-xs mt-1.5 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" /> {s.location}
            </p>
          )}
        </div>
      </div>

      {s.skills.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {s.skills.map((skill) => (
            <span key={skill} className="px-2.5 py-1 rounded-full bg-white/10 text-gray-200 text-xs">
              {skill}
            </span>
          ))}
        </div>
      )}

      <p className="text-gray-500 text-xs mt-4">Open for bookings on CreativeHUB</p>
    </div>
  );
}
