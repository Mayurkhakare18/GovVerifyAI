/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ClientSupabaseConfigStatus {
  isConfigured: boolean;
  hasUrl: boolean;
  hasPublishableKey: boolean;
  url: string;
  publishableKey: string;
  diagnostic: string;
}

/**
 * Detects public Supabase client configuration across all supported conventions:
 * 1. Client Vite-prefixed: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY
 * 2. Sovereign / Vercel integration: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY
 * Strictly excludes server-only secrets (SUPABASE_SECRET_KEY, service_role).
 */
export function detectClientSupabaseConfig(
  customEnv?: Record<string, string | undefined>
): ClientSupabaseConfigStatus {
  const env =
    customEnv ||
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env) ||
    (typeof process !== 'undefined' ? process.env : {}) ||
    {};

  const url =
    (typeof env.VITE_SUPABASE_URL === 'string' && env.VITE_SUPABASE_URL.trim()) ||
    (typeof env.SUPABASE_URL === 'string' && env.SUPABASE_URL.trim()) ||
    '';

  const publishableKey =
    (typeof env.VITE_SUPABASE_ANON_KEY === 'string' && env.VITE_SUPABASE_ANON_KEY.trim()) ||
    (typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string' && env.VITE_SUPABASE_PUBLISHABLE_KEY.trim()) ||
    (typeof env.SUPABASE_PUBLISHABLE_KEY === 'string' && env.SUPABASE_PUBLISHABLE_KEY.trim()) ||
    (typeof env.SUPABASE_ANON_KEY === 'string' && env.SUPABASE_ANON_KEY.trim()) ||
    '';

  const hasUrl = Boolean(url && url.startsWith('http'));
  const hasPublishableKey = Boolean(publishableKey && publishableKey.length > 10);
  const isConfigured = hasUrl && hasPublishableKey;

  let diagnostic = 'Supabase client is configured.';
  if (!hasUrl && !hasPublishableKey) {
    diagnostic = 'Both Supabase URL and Publishable/Anon key are missing in the browser environment.';
  } else if (!hasUrl) {
    diagnostic = 'Supabase URL is missing or invalid in the browser environment.';
  } else if (!hasPublishableKey) {
    diagnostic = 'Supabase Publishable/Anon key is missing or invalid in the browser environment.';
  }

  return {
    isConfigured,
    hasUrl,
    hasPublishableKey,
    url,
    publishableKey,
    diagnostic,
  };
}

const initialConfig = detectClientSupabaseConfig();

export let isSupabaseClientConfigured = initialConfig.isConfigured;

export let supabase: SupabaseClient | null = isSupabaseClientConfigured
  ? createClient(initialConfig.url, initialConfig.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

type ConfigListener = (configured: boolean, client: SupabaseClient | null) => void;
const configListeners: ConfigListener[] = [];

export function subscribeToClientConfigChange(listener: ConfigListener): () => void {
  configListeners.push(listener);
  return () => {
    const idx = configListeners.indexOf(listener);
    if (idx !== -1) configListeners.splice(idx, 1);
  };
}

/**
 * Dynamically configures the client Supabase instance at runtime
 * (e.g., when hydrated via /api/v1/auth/config).
 */
export function configureClientSupabase(url: string, publishableKey: string): SupabaseClient | null {
  if (!url || !url.startsWith('http') || !publishableKey || publishableKey.length <= 10) {
    return null;
  }

  // Defense-in-depth: Strictly reject attempts to configure the browser client with a service role or secret key
  if (
    publishableKey.includes('service_role') ||
    publishableKey.startsWith('sb_secret_') ||
    publishableKey.startsWith('sk_')
  ) {
    console.error('[Security] Rejected configuration attempt with privileged key.');
    return null;
  }

  // Prevent redundant recreation if already configured with matching parameters
  if (supabase && isSupabaseClientConfigured) {
    return supabase;
  }

  supabase = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  isSupabaseClientConfigured = true;

  for (const listener of configListeners) {
    try {
      listener(true, supabase);
    } catch (err) {
      console.warn('Error in config change listener:', err);
    }
  }

  return supabase;
}

export function getClientSupabase(): SupabaseClient {
  if (!supabase) {
    const status = detectClientSupabaseConfig();
    throw new Error(
      `SUPABASE_NOT_CONFIGURED: ${status.diagnostic} Set VITE_SUPABASE_URL (or SUPABASE_URL) and VITE_SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) in your environment.`
    );
  }
  return supabase;
}
