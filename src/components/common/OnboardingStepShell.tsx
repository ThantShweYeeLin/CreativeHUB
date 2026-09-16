import { type ReactNode } from 'react';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { PageBackdrop } from './PageBackdrop';

interface OnboardingStepShellProps {
  eyebrow: string;
  title: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  error?: string | null;
  onBack?: () => void;
  backLabel?: string;
  onSkip?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  isContinueLoading?: boolean;
  maxWidthClassName?: string;
  children: ReactNode;
}

export function OnboardingStepShell({
  eyebrow,
  title,
  description,
  stepIndex,
  totalSteps,
  error,
  onBack,
  backLabel,
  onSkip,
  onContinue,
  continueLabel,
  isContinueLoading,
  maxWidthClassName = 'max-w-3xl',
  children,
}: OnboardingStepShellProps) {
  const isLastStep = stepIndex === totalSteps;

  return (
    <div className="relative min-h-screen py-8">
      <PageBackdrop />
      <div className={`relative z-10 mx-auto w-full px-4 ${maxWidthClassName}`}>
        {onBack ? (
          <button
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
          >
            <ChevronLeft className="h-4 w-4" />
            {backLabel}
          </button>
        ) : (
          <div className="mb-6 h-[22px]" />
        )}

        <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-[0_20px_60px_rgba(56,189,248,0.25)] md:p-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{eyebrow}</p>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">{title}</h1>
          <p className="mb-8 text-sm text-gray-600">{description}</p>

          <div className="mb-8 flex items-center gap-2">
            {Array.from({ length: totalSteps }, (_, index) => (
              <div key={index} className={`h-2 w-full rounded-full ${stepIndex >= index + 1 ? 'bg-gradient-to-r from-sky-500 to-blue-600' : 'bg-sky-100'}`} />
            ))}
          </div>

          {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {children}

          <div className="mt-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-700"
                >
                  Skip this step
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onContinue}
              disabled={isContinueLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-sky-500/30 transition-all hover:shadow-lg disabled:opacity-60"
            >
              {isContinueLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isLastStep ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : null}
              {continueLabel || (isLastStep ? 'Finish' : 'Continue')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
