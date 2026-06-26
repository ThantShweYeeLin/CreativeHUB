import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, type AuthUser } from '../lib/authService';
import { isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: 'freelancer' | 'client') => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
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

  const signUp = async (email: string, password: string, fullName: string, role: 'freelancer' | 'client') => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { user: newUser, error } = await authService.signUp({
      email,
      password,
      fullName,
      role,
    });

    if (error) {
      throw error;
    }

    setUser(newUser);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
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
