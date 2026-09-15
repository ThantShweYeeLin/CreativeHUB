import logoImage from '../../imports/logo.png';

// Shown only while the app is resolving the auth session on first load
// (App.tsx's `if (loading)` gate) - not reused for route-to-route lazy-chunk
// transitions, which stay on the plain spinner so normal navigation doesn't
// replay a full splash animation every time.
export function BootSplash() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50">
      <div className="boot-orb absolute -top-24 -left-24 h-96 w-96 rounded-full bg-gradient-to-br from-sky-300/40 to-cyan-200/30 blur-3xl" aria-hidden="true" />
      <div className="boot-orb boot-orb-delay absolute bottom-[-6rem] right-[-4rem] h-96 w-96 rounded-full bg-gradient-to-br from-blue-300/40 to-indigo-200/25 blur-3xl" aria-hidden="true" />

      <div className="relative flex flex-col items-center gap-5">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="boot-pulse absolute inset-0 rounded-full bg-sky-300/50 blur-xl" aria-hidden="true" />
          <div className="boot-ring absolute inset-0 rounded-full border-2 border-dashed border-sky-300" aria-hidden="true" />
          <img
            src={logoImage}
            alt="CreativeHUB"
            className="boot-logo-pop relative h-20 w-20 rounded-full object-cover shadow-xl"
          />
        </div>
        <p className="boot-text-in text-lg font-bold tracking-wide text-gray-900">CreativeHUB</p>
      </div>

      <style>{`
        @keyframes bootLogoPop {
          0% { opacity: 0; transform: scale(0.6); }
          60% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        .boot-logo-pop { animation: bootLogoPop 0.7s cubic-bezier(0.22,1,0.36,1) both; }

        @keyframes bootPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.15); }
        }
        .boot-pulse { animation: bootPulse 2s ease-in-out infinite; }

        @keyframes bootRingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .boot-ring { animation: bootRingSpin 3s linear infinite; }

        @keyframes bootTextIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .boot-text-in { animation: bootTextIn 0.6s ease-out 0.3s both; }

        @keyframes bootOrbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(16px, -18px) scale(1.06); }
        }
        .boot-orb { animation: bootOrbFloat 8s ease-in-out infinite; }
        .boot-orb-delay { animation-delay: -4s; }

        @media (prefers-reduced-motion: reduce) {
          .boot-logo-pop, .boot-pulse, .boot-ring, .boot-text-in, .boot-orb {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
