import { hasSupabaseConfig, supabase } from './supabase';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { Gender } from './database.types';

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  role: 'freelancer' | 'client';
  gender: Gender;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string | undefined;
  fullName: string | null;
  avatar_url: string | null;
  role: 'freelancer' | 'client';
  gender: Gender | null;
  emailConfirmedAt: string | null;
  onboardingCompleted: boolean;
}

class AuthService {
  private toFriendlyAuthError(error: any, fallback: string) {
    const raw = String(error?.message || fallback);
    const lower = raw.toLowerCase();

    if (lower.includes('invalid login credentials')) {
      return new Error('Incorrect email or password. Please try again.');
    }

    if (lower.includes('invalid email')) {
      return new Error('Invalid email format. Please enter a valid email address.');
    }

    if (lower.includes('password should be at least')) {
      return new Error('Password is too short. Use at least 6 characters.');
    }

    if (lower.includes('user already registered') || lower.includes('already been registered')) {
      return new Error('This email is already registered. Please sign in instead.');
    }

    if (lower.includes('provider is not enabled') || lower.includes('unsupported provider')) {
      return new Error('This sign-in provider is not enabled yet. Please use email and password.');
    }

    return new Error(raw);
  }

  private async ensureUserProfile(authUser: User) {
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileLookupError) {
      return { data: null, error: this.toFriendlyAuthError(profileLookupError, 'Failed to load profile') };
    }

    if (existingProfile) {
      return { data: existingProfile, error: null };
    }

    const metadata = (authUser.user_metadata || {}) as { full_name?: string; name?: string; avatar_url?: string };
    const fullName = metadata.full_name || metadata.name || authUser.email?.split('@')[0] || 'CreativeHUB User';

    const { data: createdProfile, error: createError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        email: authUser.email || '',
        full_name: fullName,
        avatar_url: metadata.avatar_url || null,
        role: 'client',
        gender: 'prefer_not_to_say',
      })
      .select('*')
      .single();

    if (createError) {
      return { data: null, error: this.toFriendlyAuthError(createError, 'Failed to complete your profile setup.') };
    }

    return { data: createdProfile, error: null };
  }

  async signUp(data: SignUpData): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      if (!hasSupabaseConfig) {
        return { user: null, error: new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.') };
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        return { user: null, error: this.toFriendlyAuthError(authError, 'Unable to sign up.') };
      }

      if (!authData.user) {
        return { user: null, error: new Error('User creation failed') };
      }

      // Ensure the user session is active before creating the profile row.
      let session = authData.session;
      if (!session?.user) {
        const { data: sessionResponse, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          return { user: null, error: new Error((sessionError as any).message || 'Unable to verify session after sign up') };
        }
        session = sessionResponse.session;
      }

      if (!session?.user) {
        return { user: null, error: new Error('Please confirm your email before signing in to complete registration.') };
      }

      // Create (or, if a database trigger already created a row for this
      // auth user, overwrite) the user profile with the details chosen on
      // the sign-up form.
      const { error: profileError } = await supabase.from('users').upsert({
        id: authData.user.id,
        email: data.email,
        full_name: data.fullName,
        role: data.role,
        gender: data.gender,
      });

      if (profileError) {
        return { user: null, error: this.toFriendlyAuthError(profileError, 'Failed to create user profile') };
      }

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          fullName: data.fullName,
          avatar_url: null,
          role: data.role,
          gender: data.gender,
          emailConfirmedAt: session.user.email_confirmed_at ?? null,
          onboardingCompleted: false,
        },
        error: null,
      };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  async signIn(data: SignInData): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      if (!hasSupabaseConfig) {
        return { user: null, error: new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.') };
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        return { user: null, error: this.toFriendlyAuthError(authError, 'Unable to sign in.') };
      }

      if (!authData.user) {
        return { user: null, error: new Error('Sign in failed') };
      }

      const { data: userProfile, error: profileError } = await this.ensureUserProfile(authData.user);

      if (profileError || !userProfile) {
        return { user: null, error: profileError || new Error('Unable to load your profile.') };
      }

      return {
        user: {
          id: userProfile.id,
          email: userProfile.email,
          fullName: userProfile.full_name,
          avatar_url: userProfile.avatar_url,
          role: userProfile.role,
          gender: userProfile.gender ?? null,
          emailConfirmedAt: authData.user.email_confirmed_at ?? null,
          onboardingCompleted: Boolean((userProfile as any).onboarding_completed),
        },
        error: null,
      };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  async checkEmailExists(email: string): Promise<{ exists: boolean; error: Error | null }> {
    try {
      const normalized = email.trim();
      if (!normalized) {
        return { exists: false, error: new Error('Email is required.') };
      }

      const { data, error } = await supabase
        .from('users')
        .select('id')
        .ilike('email', normalized)
        .limit(1);

      if (error) {
        return { exists: false, error: this.toFriendlyAuthError(error, 'Unable to validate email.') };
      }

      return { exists: (data || []).length > 0, error: null };
    } catch (error) {
      return { exists: false, error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        return { error: this.toFriendlyAuthError(error, 'Unable to send password reset email.') };
      }
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  async signInWithOAuth(provider: 'google' | 'facebook', redirectTo: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });

      if (error) {
        return { error: this.toFriendlyAuthError(error, `Unable to continue with ${provider}.`) };
      }

      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  async signOut(): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.signOut();
    return { error: error ? (error as any) : null };
  }

  async getCurrentUser(): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      if (!hasSupabaseConfig) {
        return { user: null, error: null };
      }

      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        return { user: null, error: sessionError as any };
      }

      if (!data.session?.user) {
        return { user: null, error: null };
      }

      const { data: userProfile, error: profileError } = await this.ensureUserProfile(data.session.user);

      if (profileError || !userProfile) {
        return { user: null, error: profileError || new Error('Failed to load profile') };
      }

      return {
        user: {
          id: userProfile.id,
          email: userProfile.email,
          fullName: userProfile.full_name,
          avatar_url: userProfile.avatar_url,
          role: userProfile.role,
          gender: userProfile.gender ?? null,
          emailConfirmedAt: data.session.user.email_confirmed_at ?? null,
          onboardingCompleted: Boolean((userProfile as any).onboarding_completed),
        },
        error: null,
      };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  async updateProfile(userId: string, updates: { fullName?: string; bio?: string; avatar_url?: string }) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    return { data, error };
  }

  async updateEmail(email: string) {
    const { data, error } = await supabase.auth.updateUser({ email });
    return { data, error };
  }

  // Permanently deletes the signed-in user's account. The anon key can't
  // delete an auth.users row itself, so this calls the backend's
  // service-role-backed endpoint with the current session's access token —
  // the server re-derives the caller's own id from that token rather than
  // trusting a client-supplied id (see server/src/routes/account.ts).
  async deleteAccount(): Promise<{ error: Error | null }> {
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        return { error: new Error((sessionError as any).message || 'Unable to verify session.') };
      }
      if (!data.session?.access_token) {
        return { error: new Error('You need to be signed in to delete your account.') };
      }

      const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000/api';
      const response = await fetch(`${apiBase}/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        return { error: new Error(body?.message || 'Unable to delete account.') };
      }

      await supabase.auth.signOut();
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Unable to delete account.') };
    }
  }

  async updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({ password });
    return { data, error };
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    if (!hasSupabaseConfig) {
      return null;
    }

    return supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        const { data: userProfile } = await this.ensureUserProfile(session.user);

        if (userProfile) {
          callback({
            id: userProfile.id,
            email: userProfile.email,
            fullName: userProfile.full_name,
            avatar_url: userProfile.avatar_url,
            role: userProfile.role,
            gender: userProfile.gender ?? null,
            emailConfirmedAt: session.user.email_confirmed_at ?? null,
            onboardingCompleted: Boolean((userProfile as any).onboarding_completed),
          });
        }
      } else {
        callback(null);
      }
    });
  }
}

export const authService = new AuthService();
