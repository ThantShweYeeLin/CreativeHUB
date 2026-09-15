import { Sparkles } from 'lucide-react';

// Shared light-blue decorative background used across pages that share
// ExplorePage's theme (gradient + drifting orbs + twinkling sparkles).
// Absolutely positioned and full-bleed (breaks out of MainLayout's padded
// max-width <main>), so drop it in as the first child of a `relative`
// wrapper around the page's own content, same as ExplorePage does.
export function PageBackdrop() {
  return (
    <>
      <div
        className="absolute inset-y-0 left-0 z-0 w-screen overflow-hidden"
        style={{
          marginLeft: 'calc(50% - 50vw)',
          background: 'linear-gradient(to bottom, #ffffff 0px, #ffffff 320px, #f0f9ff 560px, #e0f2fe 820px, #dbeafe 1100px, #dce6fb 1500px, #dfe1fa 1800px, #dfe1fa 100%)',
        }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-x-0 top-0 h-[32rem]"
          style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(125,211,252,0.35), transparent 70%)' }}
        />
        <div className="page-backdrop-orb absolute top-0 -left-28 h-[26rem] w-[26rem] rounded-full bg-gradient-to-br from-sky-300/45 to-cyan-200/30 blur-3xl" />
        <div className="page-backdrop-orb page-backdrop-orb-delay-1 absolute top-[20%] -right-36 h-[30rem] w-[30rem] rounded-full bg-gradient-to-br from-indigo-300/35 to-blue-200/25 blur-3xl" />
        <div className="page-backdrop-orb page-backdrop-orb-delay-2 absolute top-[45%] left-[15%] h-96 w-96 rounded-full bg-gradient-to-br from-teal-200/40 to-sky-300/25 blur-3xl" />
        <div className="page-backdrop-orb page-backdrop-orb-delay-1 absolute top-[65%] right-[20%] h-64 w-64 rounded-full bg-gradient-to-br from-cyan-200/35 to-white/10 blur-3xl" />
        <div className="page-backdrop-orb page-backdrop-orb-delay-2 absolute top-[85%] left-[8%] h-72 w-72 rounded-full bg-gradient-to-br from-indigo-300/40 to-violet-200/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: 'radial-gradient(circle, #0ea5e9 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        {[
          { top: '4%', left: '8%', size: 14, delay: '0s' },
          { top: '18%', left: '85%', size: 10, delay: '-1.8s' },
          { top: '34%', left: '6%', size: 12, delay: '-2.6s' },
          { top: '50%', left: '92%', size: 11, delay: '-0.6s' },
          { top: '66%', left: '15%', size: 13, delay: '-3.2s' },
          { top: '82%', left: '88%', size: 14, delay: '-2.1s' },
          { top: '96%', left: '20%', size: 12, delay: '-0.9s' },
        ].map((star, index) => (
          <Sparkles
            key={index}
            className="page-backdrop-sparkle absolute text-sky-300"
            style={{ top: star.top, left: star.left, width: star.size, height: star.size, animationDelay: star.delay }}
          />
        ))}
      </div>
      <style>{`
        @keyframes pageBackdropOrbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -30px) scale(1.08); }
          66% { transform: translate(-15px, 15px) scale(0.95); }
        }
        .page-backdrop-orb { animation: pageBackdropOrbFloat 14s ease-in-out infinite; }
        .page-backdrop-orb-delay-1 { animation-delay: -4s; }
        .page-backdrop-orb-delay-2 { animation-delay: -9s; }

        @keyframes pageBackdropSparkle {
          0%, 100% { opacity: 0.25; transform: scale(0.85) rotate(0deg); }
          50% { opacity: 0.9; transform: scale(1.15) rotate(20deg); }
        }
        .page-backdrop-sparkle { animation: pageBackdropSparkle 3.5s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .page-backdrop-orb, .page-backdrop-sparkle { animation: none !important; }
        }
      `}</style>
    </>
  );
}
