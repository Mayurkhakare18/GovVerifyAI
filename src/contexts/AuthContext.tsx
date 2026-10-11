/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseClientConfigured } from '../services/supabase/client';

export interface UserProfile {
  id: string;
  display_name: string | null;
  preferred_language: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  token: string | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; isUnconfirmed?: boolean }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null; requiresEmailConfirmation?: boolean }>;
  confirmEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (displayName?: string, preferredLanguage?: string) => Promise<{ error: string | null }>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch verified profile from /api/v1/profile
  const fetchProfile = async (authToken: string) => {
    try {
      const res = await fetch('/api/v1/profile', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
        }
      }
    } catch (err) {
      console.warn('Could not fetch server profile:', err);
    }
  };

  useEffect(() => {
    if (!isSupabaseClientConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    // 1. Check existing session on mount
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      const accessToken = initialSession?.access_token ?? null;
      setToken(accessToken);

      if (accessToken) {
        fetchProfile(accessToken);
      }
      setIsLoading(false);
    });

    // 2. Subscribe to auth state updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        const accessToken = newSession?.access_token ?? null;
        setToken(accessToken);

        if (accessToken) {
          await fetchProfile(accessToken);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const confirmEmail = async (emailToConfirm: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/v1/auth/confirm-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToConfirm.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || 'Email confirmation failed.' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error confirming email.' };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null; isUnconfirmed?: boolean }> => {
    if (!isSupabaseClientConfigured || !supabase) {
      return {
        error:
          'Supabase environment is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable authentication.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // If error is "Email not confirmed", try auto-confirming via backend and retry sign in
        if (error.message.toLowerCase().includes('email not confirmed')) {
          const confirmRes = await confirmEmail(email.trim());
          if (confirmRes.success) {
            const retry = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (!retry.error && retry.data.session) {
              setSession(retry.data.session);
              setUser(retry.data.user);
              setToken(retry.data.session.access_token);
              await fetchProfile(retry.data.session.access_token);
              return { error: null };
            }
          }
          return {
            error:
              'Email not confirmed. We attempted automatic confirmation, but please confirm your email or disable "Confirm email" in your Supabase project settings.',
            isUnconfirmed: true,
          };
        }
        return { error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        setToken(data.session.access_token);
        await fetchProfile(data.session.access_token);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Network error during sign in.' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ error: string | null; requiresEmailConfirmation?: boolean }> => {
    if (!isSupabaseClientConfigured || !supabase) {
      return {
        error:
          'Supabase environment is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable registration.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName?.trim() || email.split('@')[0],
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      // Check if email confirmation is required by Supabase project settings
      let requiresEmailConfirmation = Boolean(data.user && !data.session);

      if (requiresEmailConfirmation && data.user?.email) {
        // Attempt immediate auto-confirmation via backend admin API
        const confirmRes = await confirmEmail(data.user.email);
        if (confirmRes.success) {
          // Immediately sign in so the user experiences zero friction
          const autoSignIn = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (!autoSignIn.error && autoSignIn.data.session) {
            setSession(autoSignIn.data.session);
            setUser(autoSignIn.data.user);
            setToken(autoSignIn.data.session.access_token);
            await fetchProfile(autoSignIn.data.session.access_token);
            return { error: null, requiresEmailConfirmation: false };
          }
        }
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        setToken(data.session.access_token);
        await fetchProfile(data.session.access_token);
      }

      return { error: null, requiresEmailConfirmation };
    } catch (err: any) {
      return { error: err.message || 'Network error during sign up.' };
    }
  };

  const signOut = async (): Promise<void> => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setUser(null);
    setToken(null);
    setProfile(null);
  };

  const updateProfile = async (
    displayName?: string,
    preferredLanguage?: string
  ): Promise<{ error: string | null }> => {
    if (!token) {
      return { error: 'You must be signed in to update your profile.' };
    }

    try {
      const res = await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          display_name: displayName,
          preferred_language: preferredLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { error: data.message || 'Failed to update profile.' };
      }

      setProfile(data.profile);
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Network error updating profile.' };
    }
  };

  const refreshSession = async (): Promise<void> => {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.access_token) {
        setToken(data.session.access_token);
        await fetchProfile(data.session.access_token);
      }
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      token,
      profile,
      isAuthenticated: Boolean(user && session),
      isLoading,
      isConfigured: isSupabaseClientConfigured,
      signIn,
      signUp,
      confirmEmail,
      signOut,
      updateProfile,
      refreshSession,
    }),
    [user, session, token, profile, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
