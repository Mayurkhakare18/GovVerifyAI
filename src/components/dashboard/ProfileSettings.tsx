/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Light Citizen Profile & Settings
 * Displays user identity, language preferences, security credentials status,
 * and working sign-out controls.
 */

import React, { useState } from 'react';
import {
  User,
  Mail,
  Globe,
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Lock,
  Database,
  ArrowRight,
  Shield,
  Save,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, Link } from '../../contexts/RouterContext';
import { SUPPORTED_LANGUAGES } from '../../config';

export const ProfileSettings: React.FC = () => {
  const { user, profile, updateProfile, signOut } = useAuth();
  const { navigate } = useRouter();

  const [displayName, setDisplayName] = useState<string>(
    profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || ''
  );
  const [preferredLanguage, setPreferredLanguage] = useState<string>(
    profile?.preferred_language || 'English'
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const { error } = await updateProfile(displayName, preferredLanguage);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error);
    } else {
      setSuccessMessage('Profile and preferences updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-3xl mx-auto">
      {/* Header Bar */}
      <div className="pb-4 border-b border-[#E4E7EC]">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF1FF] border border-[#D1E9FF] text-[#2457C5] text-xs font-bold mb-2">
          <Settings className="w-3.5 h-3.5" />
          <span>Account Preferences</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#182230] tracking-tight">
          Profile & Citizen Settings
        </h1>
        <p className="text-xs sm:text-sm text-[#667085] mt-1">
          Manage your display identity, regional language preference, and row-level security status.
        </p>
      </div>

      {/* Account Identity Card */}
      <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 shadow-xs space-y-4">
        <h2 className="text-xs font-bold text-[#667085] uppercase tracking-wider flex items-center gap-2">
          <User className="w-4 h-4 text-[#2457C5]" />
          <span>Citizen Account Identity</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#E4E7EC] space-y-1">
            <span className="text-[11px] font-semibold text-[#667085]">Email Address</span>
            <div className="text-sm font-bold text-[#182230] flex items-center gap-2">
              <span className="truncate">{user?.email}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ECFDF3] text-[#027A48] border border-[#D1FADF] shrink-0">
                Verified
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#E4E7EC] space-y-1">
            <span className="text-[11px] font-semibold text-[#667085]">Citizen Account ID</span>
            <div className="text-xs font-mono text-[#475467] truncate">
              {user?.id || 'Authenticated Session'}
            </div>
          </div>
        </div>
      </div>

      {/* Editable Preferences Form */}
      <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 shadow-xs space-y-5">
        <h2 className="text-xs font-bold text-[#667085] uppercase tracking-wider flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#2457C5]" />
          <span>Display & Language Preferences</span>
        </h2>

        {successMessage && (
          <div className="p-3 rounded-xl bg-[#ECFDF3] border border-[#D1FADF] text-xs font-semibold text-[#027A48] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-xs font-semibold text-[#B42318] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="display-name" className="text-xs font-bold text-[#344054]">
              Citizen Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name or preferred nickname"
              maxLength={60}
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[#F7F9FC] border border-[#E4E7EC] rounded-xl text-[#182230] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#2457C5] focus:bg-white transition-all"
            />
            <p className="text-[11px] text-[#667085]">Used for greetings and saved verification exports.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pref-lang" className="text-xs font-bold text-[#344054]">
              Preferred Regional Language
            </label>
            <select
              id="pref-lang"
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[#F7F9FC] border border-[#E4E7EC] rounded-xl text-[#182230] focus:outline-none focus:ring-2 focus:ring-[#2457C5]"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.name}>
                  {lang.name} ({lang.native})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#667085]">
              Verification summaries will align with your language preference where official translations exist.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-[#2457C5] hover:bg-[#1D46A6] text-white rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Security & Access Protection Card */}
      <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 shadow-xs space-y-4">
        <h2 className="text-xs font-bold text-[#667085] uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#2457C5]" />
          <span>Security & Data Isolation</span>
        </h2>

        <div className="space-y-2 text-xs text-[#475467] leading-relaxed">
          <div className="flex items-center gap-2 font-semibold text-[#182230]">
            <CheckCircle2 className="w-4 h-4 text-[#027A48]" />
            <span>Row-Level Security (RLS) Active</span>
          </div>
          <p className="text-[11px] text-[#667085]">
            Your inquiry history and profile fields are isolated to your account. No other citizen or third party can access your saved reports. Server API keys (Tavily, Gemini) are kept exclusively in server-side memory.
          </p>
        </div>

        <div className="pt-3 border-t border-[#F2F4F7] flex items-center justify-between">
          <span className="text-xs text-[#667085]">Session Management</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA] hover:bg-[#FEE4E2] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out of Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
