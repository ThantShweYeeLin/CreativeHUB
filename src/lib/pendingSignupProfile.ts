// Hands the just-typed name and a local avatar preview from the sign-up form
// straight to the onboarding page it redirects to, without waiting on any
// async round trip. The mandatory-onboarding gate mounts that page the
// instant the auth session exists — before signUp()'s own avatar upload has
// necessarily finished, and before a Supabase-side trigger that mirrors
// auth.users into public.users (with an email-derived fallback name) has
// necessarily settled — so neither a fresh DB read nor the auth context's
// user object can be trusted as the very first paint's data source. A plain
// module-level handoff, populated synchronously before signUp() is even
// called, sidesteps that race entirely.
//
// Deliberately a plain (non-consuming) getter/setter rather than a "consume
// once and clear" pair: onboarding pages read it as a useState lazy
// initializer, which React (in StrictMode dev builds) calls twice per mount
// — a destructive "take" would return null on the second call and silently
// lose the value. Leaving it in place until the next sign-up overwrites it
// is a harmless few bytes, not a real leak.
let pending: { fullName: string; avatarPreviewUrl: string | null } | null = null;

export function setPendingSignupProfile(data: { fullName: string; avatarPreviewUrl: string | null }) {
  pending = data;
}

export function getPendingSignupProfile() {
  return pending;
}
