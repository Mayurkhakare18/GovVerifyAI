/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 8: Language Context & State Management
 * Coordinates global language switching, user profile persistence,
 * browser fallback detection, and instant reactive translation.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  SupportedLanguage,
  SUPPORTED_I18N_LANGUAGES,
  LanguageOption,
  getTranslation,
  normalizeLanguageCode,
} from '../i18n';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'govverify_language';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  languages: LanguageOption[];
  currentLanguageOption: LanguageOption;
  isDevanagari: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, updateProfile, isAuthenticated } = useAuth();

  // Initialize language from stored preferences or browser
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return normalizeLanguageCode(stored);
      // Browser language check
      if (typeof navigator !== 'undefined' && navigator.language) {
        return normalizeLanguageCode(navigator.language);
      }
    } catch {
      // LocalStorage blocked
    }
    return 'en';
  });

  // Sync with user's authenticated profile preference if available
  useEffect(() => {
    if (isAuthenticated && profile?.preferred_language) {
      const profileLang = normalizeLanguageCode(profile.preferred_language);
      if (profileLang !== language) {
        setLanguageState(profileLang);
        try {
          localStorage.setItem(STORAGE_KEY, profileLang);
        } catch {}
      }
    }
  }, [isAuthenticated, profile?.preferred_language]);

  // Update HTML lang attribute on change
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      if (language === 'hi' || language === 'mr') {
        document.documentElement.classList.add('font-devanagari');
      } else {
        document.documentElement.classList.remove('font-devanagari');
      }
    }
  }, [language]);

  const setLanguage = useCallback(
    async (newLang: SupportedLanguage) => {
      setLanguageState(newLang);
      try {
        localStorage.setItem(STORAGE_KEY, newLang);
      } catch {}

      // Persist to user profile if logged in
      if (isAuthenticated && updateProfile) {
        const langMap: Record<SupportedLanguage, string> = {
          en: 'English',
          hi: 'Hindi',
          mr: 'Marathi',
        };
        try {
          await updateProfile(undefined, langMap[newLang]);
        } catch {
          // Non-fatal profile persistence error
        }
      }
    },
    [isAuthenticated, updateProfile]
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      return getTranslation(language, key, params);
    },
    [language]
  );

  const currentLanguageOption = useMemo(
    () =>
      SUPPORTED_I18N_LANGUAGES.find((l) => l.code === language) || SUPPORTED_I18N_LANGUAGES[0],
    [language]
  );

  const isDevanagari = language === 'hi' || language === 'mr';

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      languages: SUPPORTED_I18N_LANGUAGES,
      currentLanguageOption,
      isDevanagari,
    }),
    [language, setLanguage, t, currentLanguageOption, isDevanagari]
  );

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
