export const PRONOUN_OPTIONS = ['she/her', 'he/him', 'they/them', 'Prefer not to say', 'Custom'] as const;

// Pronouns not set, or explicitly "Prefer not to say", should never be shown
// on the public profile.
export function shouldDisplayPronouns(pronouns?: string | null): pronouns is string {
  return Boolean(pronouns && pronouns.trim() && pronouns !== 'Prefer not to say');
}
