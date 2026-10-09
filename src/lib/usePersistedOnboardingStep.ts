import { useEffect, useState } from 'react';

// Remembers which onboarding step a signed-in user was on, so a reload
// lands back where they left off instead of always restarting at step 1 -
// the step INDEX itself used to be pure client-side state, reset to 1 on
// every mount. Keyed by user id, not a fixed key, so a shared/public
// browser never shows one account's progress to whoever signs in next.
//
// IMPORTANT: this only remembers the step NUMBER, never the field values
// entered on it - neither onboarding wizard saves anything to the server
// until its final submit, so every other piece of state (category, skills,
// selected options, ...) is still wiped by the reload this is meant to
// survive. Resuming straight to, say, "Skills" with `category` back to
// null leaves the wizard on a step whose own prerequisite silently isn't
// there any more, which only surfaces as a confusing failure at the very
// end ("Select a freelancer category before finishing"). `maxResumeStep`
// exists for exactly that: pass the last step whose requirement has no
// such hidden dependency (for BecomeFreelancerPage, that's Specialty) so a
// stale resume value never lands past it. Leave it unset for a wizard
// where every step's fields are independent/optional (ClientOnboardingPage).
//
// Hydration is deliberately async (a useEffect, not the useState
// initializer): `user` from useAuth() isn't guaranteed to be populated
// synchronously on first render, and reading localStorage before it is
// would silently always "miss" and start at step 1. Writes are withheld
// until after that first hydration so they never clobber a real saved
// step with the initial default while still waiting on it.
export function usePersistedOnboardingStep(
  storageKey: string,
  userId: string | undefined,
  totalSteps: number,
  maxResumeStep: number = totalSteps
) {
  const [step, setStep] = useState(1);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (hasHydrated || !userId) return;
    try {
      const saved = Number(localStorage.getItem(`${storageKey}:${userId}`));
      if (Number.isInteger(saved) && saved >= 1 && saved <= totalSteps) setStep(Math.min(saved, maxResumeStep));
    } catch {
      // Private browsing / storage disabled - the wizard still works, it
      // just won't resume after a reload.
    }
    setHasHydrated(true);
  }, [hasHydrated, storageKey, userId, totalSteps, maxResumeStep]);

  useEffect(() => {
    if (!hasHydrated || !userId) return;
    try {
      localStorage.setItem(`${storageKey}:${userId}`, String(step));
    } catch {
      // ignore - same private-browsing case as above
    }
  }, [hasHydrated, storageKey, userId, step]);

  return [step, setStep] as const;
}

/** Call once the wizard actually completes, so a later unrelated run of it doesn't start mid-way through. */
export function clearPersistedOnboardingStep(storageKey: string, userId: string | undefined) {
  if (!userId) return;
  try {
    localStorage.removeItem(`${storageKey}:${userId}`);
  } catch {
    // ignore
  }
}
