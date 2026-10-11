/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  LogIn,
  UserPlus,
  User,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  Globe,
  Settings,
  Info,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from '../../contexts/RouterContext';
import { SUPPORTED_LANGUAGES } from '../../config';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'signin' | 'signup' | 'profile';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'signin',
}) => {
  const {
    user,
    profile,
    isAuthenticated,
    isConfigured,
    signIn,
    signUp,
    resendConfirmationEmail,
    signOut,
    updateProfile,
  } = useAuth();
  const { currentPath, intendedDestination, setIntendedDestination, navigate } = useRouter();

  const [tab, setTab] = useState<'signin' | 'signup' | 'profile'>(
    isAuthenticated ? 'profile' : initialTab
  );

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [preferredLang, setPreferredLang] = useState(profile?.preferred_language || 'English');
  const [editDisplayName, setEditDisplayName] = useState(profile?.display_name || '');

  // Status / error states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial tab when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsEmailUnconfirmed(false);
      setTab(isAuthenticated ? 'profile' : initialTab);
      if (profile) {
        setEditDisplayName(profile.display_name || '');
        setPreferredLang(profile.preferred_language || 'English');
      }
    }
  }, [isOpen, initialTab, isAuthenticated, profile]);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEmailUnconfirmed(false);
    setIsSubmitting(true);

    const { error, isUnconfirmed } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error);
      if (isUnconfirmed || error.toLowerCase().includes('email not confirmed')) {
        setIsEmailUnconfirmed(true);
      }
    } else {
      setSuccessMessage('Successfully signed in.');
      setTimeout(() => {
        onClose();
        const dest = intendedDestination || '/app';
        setIntendedDestination(null);
        if (!currentPath.startsWith('/app')) {
          navigate(dest);
        }
      }, 700);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage('Requesting verification email...');

    const res = await resendConfirmationEmail(email);
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMessage(
        `Verification email sent to ${email}! Please check your inbox (and spam folder) and click the link to confirm your account.`
      );
    } else {
      setErrorMessage(
        res.error || 'Failed to resend confirmation email. Please verify your email address.'
      );
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    const { error, requiresEmailConfirmation, isDuplicateEmail } = await signUp(
      email,
      password,
      displayName
    );
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error);
      if (isDuplicateEmail) {
        // Clear password and smoothly switch to signin tab so the citizen can log in directly
        setPassword('');
        setTimeout(() => {
          setTab('signin');
        }, 2500);
      }
    } else if (requiresEmailConfirmation) {
      setSuccessMessage(
        `Account created successfully! Please check your email inbox at ${email} for the verification link before signing in.`
      );
      // Clear password and switch to sign in tab with preserved email
      setPassword('');
      setTimeout(() => {
        setTab('signin');
      }, 3000);
    } else {
      setSuccessMessage('Account created and signed in successfully!');
      setTimeout(() => {
        onClose();
        const dest = intendedDestination || '/app';
        setIntendedDestination(null);
        if (!currentPath.startsWith('/app')) {
          navigate(dest);
        }
      }, 700);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const { error } = await updateProfile(editDisplayName, preferredLang);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error);
    } else {
      setSuccessMessage('Profile updated successfully.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
    if (currentPath.startsWith('/app')) {
      navigate('/');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-brand-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-brand-border bg-brand-bg-subtle">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 shrink-0 rounded-lg overflow-hidden flex items-center justify-center">
              <img
                src="/govverify-icon.png"
                alt="GovVerify AI"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 id="auth-modal-title" className="text-base font-bold text-brand-navy">
              {isAuthenticated
                ? 'Citizen Profile & Preferences'
                : tab === 'signin'
                ? 'Sign In to GovVerify AI'
                : 'Create Citizen Account'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-1 rounded-lg text-brand-slate hover:text-brand-navy hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Unconfigured Supabase Banner (honest civic technical status) */}
        {!isConfigured && (
          <div className="p-4 mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Supabase Environment Setup Required</span>
            </div>
            <p className="leading-relaxed text-amber-800/90">
              To connect real authentication and persistent PostgreSQL tables, add{' '}
              <code className="px-1 py-0.5 bg-amber-100 rounded font-mono text-[11px]">SUPABASE_URL</code> and{' '}
              <code className="px-1 py-0.5 bg-amber-100 rounded font-mono text-[11px]">SUPABASE_PUBLISHABLE_KEY</code> to your environment.
            </p>
          </div>
        )}

        {/* Tab Selector (when not authenticated) */}
        {!isAuthenticated && (
          <div className="flex border-b border-brand-border px-6 pt-3 bg-white">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                tab === 'signin'
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-brand-slate hover:text-brand-navy'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all ${
                tab === 'signup'
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-brand-slate hover:text-brand-navy'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register / Get Started</span>
            </button>
          </div>
        )}

        {/* Feedback banners */}
        <div className="px-6 pt-4 space-y-2">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
              {isEmailUnconfirmed && (
                <div className="mt-1 pt-2 border-t border-rose-200/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-rose-600 font-medium">Need a new verification link?</span>
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isSubmitting}
                    className="px-2.5 py-1 text-[11px] font-bold bg-brand-blue hover:bg-brand-blue-hover text-white rounded-md shadow-xs transition-colors disabled:opacity-50"
                  >
                    Resend Email
                  </button>
                </div>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1 leading-relaxed">{successMessage}</div>
            </div>
          )}
        </div>

        {/* Tab 1: SIGN IN FORM */}
        {!isAuthenticated && tab === 'signin' && (
          <form onSubmit={handleSignIn} className="p-6 pt-3 space-y-4">
            <div>
              <label className="block text-xs font-bold text-brand-navy mb-1.5">
                Citizen Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-brand-slate absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-brand-slate absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center text-[11px] text-brand-slate-light">
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => setTab('signup')}
                className="font-bold text-brand-blue hover:underline"
              >
                Create an account
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: SIGN UP FORM */}
        {!isAuthenticated && tab === 'signup' && (
          <form onSubmit={handleSignUp} className="p-6 pt-3 space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-brand-navy mb-1">
                Full Name / Display Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-brand-slate absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-brand-slate absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-navy mb-1">
                Create Password (min. 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-brand-slate absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <span>Creating account...</span>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register Account</span>
                </>
              )}
            </button>

            <div className="pt-1 text-center text-[11px] text-brand-slate-light">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setTab('signin')}
                className="font-bold text-brand-blue hover:underline"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: AUTHENTICATED PROFILE VIEW */}
        {isAuthenticated && user && (
          <div className="p-6 pt-3 space-y-4">
            <div className="p-3.5 bg-brand-bg-subtle rounded-xl border border-brand-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-brand-slate uppercase">Account Identity</span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                  Authenticated
                </span>
              </div>
              <div className="text-sm font-bold text-brand-navy">{user.email}</div>
              <div className="text-[10px] text-brand-slate-light font-mono truncate">
                User ID: {user.id}
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-brand-navy mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-navy mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-brand-slate" />
                  Preferred Regional Language
                </label>
                <select
                  value={preferredLang}
                  onChange={(e) => setPreferredLang(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue bg-white"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.name}>
                      {lang.native} ({lang.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Update Profile</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-brand-slate hover:text-brand-navy text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-brand-bg-subtle border-t border-brand-border flex items-center justify-between text-[11px] text-brand-slate-light">
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3 text-brand-blue" />
            Row-Level Security Active
          </span>
          <span>Phase 2 Database</span>
        </div>
      </div>
    </div>
  );
};
