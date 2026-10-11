/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseClientConfigured } from '../services/supabase/client';
import { resolveApiUrl } from '../utils/apiUrl';

export interface UserProfile {
  id: string;
  display_name: string | null;
  preferred_language: string;
  created_at?: string;
  updated_at?: string;
}

export interface SignUpResult {
  error: string | null;
  requiresEmailConfirmation?: boolean;
  isDuplicateEmail?: boolean;
}

export interface SignInResult {
  error: string | null;
  isUnconfirmed?: boolean;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  token: string | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, displayName?: string) => Promise<SignUpResult>;
  resendConfirmationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
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

  // Fetch verified profile directly from Supabase (RLS protected), with API route fallback
  const fetchProfile = async (authToken: string, userId?: string) => {
    try {
      const targetId = userId || user?.id;

      // 1. Direct query via client Supabase with RLS (auth.uid() = id)
      if (supabase && targetId) {
        const { data: profileRow, error: profileErr } = await supabase
          .from('profiles')
          .select('id, display_name, preferred_language, created_at, updated_at')
          .eq('id', targetId)
          .maybeSingle();

        if (!profileErr && profileRow) {
          setProfile(profileRow);
          return;
        }
      }

      // 2. Fallback to API route if direct query yielded no row
      const apiUrl = resolveApiUrl('/api/v1/profile');
      const res = await fetch(apiUrl, {
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
      console.warn('Could not fetch user profile:', err);
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
        fetchProfile(accessToken, initialSession?.user?.id);
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
          await fetchProfile(accessToken, newSession?.user?.id);
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

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    if (!isSupabaseClientConfigured || !supabase) {
      return {
        error:
          'Supabase environment is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment to enable authentication.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg = error.message || '';
        const isUnconfirmed = msg.toLowerCase().includes('email not confirmed');

        let sanitizedErrorMessage = error.message;
        if (isUnconfirmed) {
          sanitizedErrorMessage =
            'Your email address has not been confirmed yet. Please verify your email via the confirmation link sent to your inbox, or request a new verification link.';
        } else if (msg.toLowerCase().includes('invalid login credentials')) {
          sanitizedErrorMessage =
            'Invalid login credentials. Please verify your email and password, or create an account if you have not registered yet.';
        }

        return {
          error: sanitizedErrorMessage,
          isUnconfirmed,
        };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        setToken(data.session.access_token);
        await fetchProfile(data.session.access_token, data.user?.id);
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
  ): Promise<SignUpResult> => {
    if (!isSupabaseClientConfigured || !supabase) {
      return {
        error:
          'Supabase environment is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment to enable registration.',
      };
    }

    try {
      const trimmedEmail = email.trim();
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            display_name: displayName?.trim() || trimmedEmail.split('@')[0],
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      // 1. Detect existing / duplicate email:
      // Supabase returns an empty identities array [] when the email is already registered.
      const isDuplicateEmail = Boolean(
        data.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      );

      if (isDuplicateEmail) {
        return {
          error:
            'An account with this email address already exists. Please sign in with your password, or use password recovery if you have forgotten it.',
          isDuplicateEmail: true,
          requiresEmailConfirmation: false,
        };
      }

      // 2. Check if email confirmation is required:
      // When email confirmation is enabled on Supabase, data.user exists but data.session is null.
      const requiresEmailConfirmation = Boolean(data.user && !data.session);

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        setToken(data.session.access_token);
        await fetchProfile(data.session.access_token, data.user?.id);
      }

      return {
        error: null,
        requiresEmailConfirmation,
        isDuplicateEmail: false,
      };
    } catch (err: any) {
      return { error: err.message || 'Network error during sign up.' };
    }
  };

  const resendConfirmationEmail = async (
    emailToConfirm: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseClientConfigured || !supabase) {
      return { success: false, error: 'Supabase client is not configured.' };
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToConfirm.trim(),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to resend confirmation email.' };
    }
  };

  // Kept for backward compatibility with existing tests and interfaces
  const confirmEmail = async (emailToConfirm: string): Promise<{ success: boolean; error?: string }> => {
    return resendConfirmationEmail(emailToConfirm);
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
      // 1. Direct update via Supabase Client (RLS protected: auth.uid() = id)
      if (supabase && user?.id) {
        const updatePayload: Record<string, any> = {};
        if (displayName !== undefined) updatePayload.display_name = displayName;
        if (preferredLanguage !== undefined) updatePayload.preferred_language = preferredLanguage;

        const { data: updated, error: directErr } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', user.id)
          .select()
          .maybeSingle();

        if (!directErr && updated) {
          setProfile(updated);
          return { error: null };
        }
      }

      // 2. Fallback to API endpoint
      const apiUrl = resolveApiUrl('/api/v1/profile');
      const res = await fetch(apiUrl, {
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
        await fetchProfile(data.session.access_token, data.session?.user?.id);
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
      resendConfirmationEmail,
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
