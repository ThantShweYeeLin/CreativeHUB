import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, type AuthUser } from '../lib/authService';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Gender } from '../lib/database.types';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: 'freelancer' | 'client',
    gender: Gender,
    phone?: string,
    avatarFile?: File | null,
    country?: string,
    city?: string
  ) => Promise<AuthUser>;
  signIn: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string, redirectTo: string) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'facebook', redirectTo: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Check current user on mount
    authService.getCurrentUser().then(({ user: currentUser }) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Listen for auth changes
    const subscription = authService.onAuthStateChange((newUser) => {
      setUser(newUser);
    });

    return () => {
      subscription?.data?.subscription?.unsubscribe();
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'freelancer' | 'client',
    gender: Gender,
    phone?: string,
    avatarFile?: File | null,
    country?: string,
    city?: string
  ) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { user: newUser, error } = await authService.signUp({
      email,
      password,
      fullName,
      role,
      gender,
      phone,
      avatarFile,
      country,
      city,
    });

    if (error || !newUser) {
      throw error || new Error('Sign up failed.');
    }

    setUser(newUser);
    return newUser;
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { user: signedInUser, error } = await authService.signIn({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    setUser(signedInUser);
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      setUser(null);
      return;
    }

    const { error } = await authService.signOut();
    if (error) {
      throw error;
    }
    setUser(null);
  };

  const requestPasswordReset = async (email: string, redirectTo: string) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await authService.requestPasswordReset(email, redirectTo);
    if (error) {
      throw error;
    }
  };

  const signInWithOAuth = async (provider: 'google' | 'facebook', redirectTo: string) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await authService.signInWithOAuth(provider, redirectTo);
    if (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        requestPasswordReset,
        signInWithOAuth,
        signOut,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
