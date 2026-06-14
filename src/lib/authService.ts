import { supabase } from './supabase';

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  role: 'freelancer' | 'client';
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
}

class AuthService {
  async signUp(data: SignUpData): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        return { user: null, error: authError as any };
      }

      if (!authData.user) {
        return { user: null, error: new Error('User creation failed') };
      }

      // Create user profile
      const { error: profileError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: data.email,
        full_name: data.fullName,
        role: data.role,
      });

      if (profileError) {
        // Clean up auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        return { user: null, error: new Error((profileError as any).message || 'Failed to create user profile') };
      }

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          fullName: data.fullName,
          avatar_url: null,
          role: data.role,
        },
        error: null,
      };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  async signIn(data: SignInData): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        return { user: null, error: authError as any };
      }

      if (!authData.user) {
        return { user: null, error: new Error('Sign in failed') };
      }

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        return { user: null, error: new Error((profileError as any).message || 'Failed to load profile') };
      }

      return {
        user: {
          id: userProfile.id,
          email: userProfile.email,
          fullName: userProfile.full_name,
          avatar_url: userProfile.avatar_url,
          role: userProfile.role,
        },
        error: null,
      };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error : new Error('Unknown error') };
    }
  }

  async signOut(): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.signOut();
    return { error: error ? (error as any) : null };
  }

  async getCurrentUser(): Promise<{ user: AuthUser | null; error: Error | null }> {
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        return { user: null, error: sessionError as any };
      }

      if (!data.session?.user) {
        return { user: null, error: null };
      }

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      if (profileError) {
        return { user: null, error: new Error((profileError as any).message || 'Failed to load profile') };
      }

      return {
        user: {
          id: userProfile.id,
          email: userProfile.email,
          fullName: userProfile.full_name,
          avatar_url: userProfile.avatar_url,
          role: userProfile.role,
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

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userProfile) {
          callback({
            id: userProfile.id,
            email: userProfile.email,
            fullName: userProfile.full_name,
            avatar_url: userProfile.avatar_url,
            role: userProfile.role,
          });
        }
      } else {
        callback(null);
      }
    });
  }
}

export const authService = new AuthService();
