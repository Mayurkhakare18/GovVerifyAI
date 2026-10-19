import { APP_CONFIG } from '../../config';
import { isSupabaseClientConfigured } from '../supabase/client';

export interface UserSession {
  user: {
    id: string;
    email: string;
    fullName?: string;
  } | null;
  isAuthenticated: boolean;
}

/**
 * Authentication Service Client for Phase 2.
 */
class AuthApiService {
  public isAuthReady(): boolean {
    return isSupabaseClientConfigured;
  }

  public getStatusMessage(): string {
    if (isSupabaseClientConfigured) {
      return `Supabase Auth is configured and active.`;
    }
    return `Supabase Auth requires VITE_SUPABASE_URL (or SUPABASE_URL) and VITE_SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) in environment variables.`;
  }
}

export const authApi = new AuthApiService();
