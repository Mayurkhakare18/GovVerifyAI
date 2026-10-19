/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  hasUrl: boolean;
  hasPublishableKey: boolean;
  hasSecretKey: boolean;
  message: string;
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const hasUrl = Boolean(SUPABASE_URL && SUPABASE_URL.startsWith('http'));
  const hasPublishableKey = Boolean(SUPABASE_PUBLISHABLE_KEY && SUPABASE_PUBLISHABLE_KEY.length > 10);
  const hasSecretKey = Boolean(SUPABASE_SECRET_KEY && SUPABASE_SECRET_KEY.length > 10);
  const isConfigured = hasUrl && (hasSecretKey || hasPublishableKey);

  let message = 'Supabase environment is active and configured.';
  if (!hasUrl && !hasPublishableKey && !hasSecretKey) {
    message = 'SUPABASE_NOT_CONFIGURED: SUPABASE_URL and API keys are missing in the environment.';
  } else if (!hasUrl) {
    message = 'SUPABASE_URL is missing or invalid.';
  } else if (!hasSecretKey && !hasPublishableKey) {
    message = 'Neither SUPABASE_SECRET_KEY nor SUPABASE_PUBLISHABLE_KEY is configured.';
  }

  return {
    isConfigured,
    hasUrl,
    hasPublishableKey,
    hasSecretKey,
    message,
  };
}

let serverClientInstance: SupabaseClient | null = null;
let publicClientInstance: SupabaseClient | null = null;

/**
 * Returns a privileged Supabase client for server-side operations
 * with enforced application authorization checks.
 */
export function getServerSupabase(): SupabaseClient {
  const status = getSupabaseConfigStatus();
  if (!status.isConfigured) {
    throw new Error(
      `DATABASE_UNCONFIGURED: Real Supabase database connection is not configured. ${status.message} Please configure SUPABASE_URL and SUPABASE_SECRET_KEY in your environment.`
    );
  }

  if (!serverClientInstance) {
    const keyToUse = SUPABASE_SECRET_KEY || SUPABASE_PUBLISHABLE_KEY;
    serverClientInstance = createClient(SUPABASE_URL, keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serverClientInstance;
}

/**
 * Returns standard client for public operations and session verification.
 */
export function getPublicSupabase(): SupabaseClient {
  const status = getSupabaseConfigStatus();
  if (!status.isConfigured) {
    throw new Error(
      `DATABASE_UNCONFIGURED: Supabase client is not configured. ${status.message}`
    );
  }

  if (!publicClientInstance) {
    const keyToUse = SUPABASE_PUBLISHABLE_KEY || SUPABASE_SECRET_KEY;
    publicClientInstance = createClient(SUPABASE_URL, keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return publicClientInstance;
}

/**
 * Safely exposes only the public Supabase URL and public publishable/anon key.
 * Strictly never exposes SUPABASE_SECRET_KEY, service_role keys, database passwords, or JWT secrets.
 */
export function getPublicSupabaseCredentials(): { supabaseUrl: string; publishableKey: string } {
  const isKeySafe =
    SUPABASE_PUBLISHABLE_KEY &&
    !SUPABASE_PUBLISHABLE_KEY.includes('service_role') &&
    !SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_') &&
    !SUPABASE_PUBLISHABLE_KEY.startsWith('sk_');

  return {
    supabaseUrl: SUPABASE_URL,
    publishableKey: isKeySafe ? SUPABASE_PUBLISHABLE_KEY : '',
  };
}

/**
 * Validates a Bearer token from the Authorization header against Supabase Auth.
 * Never accepts client-supplied user IDs without cryptographic validation.
 */
export async function validateUserToken(authHeader?: string): Promise<User | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  const status = getSupabaseConfigStatus();
  if (!status.isConfigured) {
    throw new Error('Supabase is not configured to validate tokens.');
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}
