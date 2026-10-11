/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || (typeof process !== 'undefined' ? process.env : {}) || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const isSupabaseClientConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl.startsWith('http') &&
  supabaseAnonKey &&
  supabaseAnonKey.length > 10
);

export const supabase: SupabaseClient | null = isSupabaseClientConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getClientSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'SUPABASE_NOT_CONFIGURED: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured in environment variables to use client authentication.'
    );
  }
  return supabase;
}
