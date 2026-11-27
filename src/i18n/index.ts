/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 8: Centralized Internationalization (i18n) Engine
 * Provides language lookup, nested key resolution, fallback to English,
 * and parameterized string interpolation for English, Hindi, and Marathi.
 */

import { SupportedLanguage, SUPPORTED_I18N_LANGUAGES, TranslationDictionary } from './types';
import { en } from './translations/en';
import { hi } from './translations/hi';
import { mr } from './translations/mr';

export * from './types';
export { en, hi, mr };

export const translations: Record<SupportedLanguage, TranslationDictionary> = {
  en,
  hi,
  mr,
};

/**
 * Resolves a nested dot-notation key (e.g. "schemes.popularPills.farmerSupport")
 * in the selected language with fallback to English.
 */
export function getTranslation(
  lang: SupportedLanguage = 'en',
  key: string,
  params?: Record<string, string | number>
): string {
  const selectedDict = translations[lang] || translations.en;
  let val = resolveNestedKey(selectedDict, key);

  if (val === undefined && lang !== 'en') {
    val = resolveNestedKey(translations.en, key);
  }

  if (val === undefined) {
    return key;
  }

  if (typeof val !== 'string') {
    return String(val);
  }

  if (params) {
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
      val
    );
  }

  return val;
}

function resolveNestedKey(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

export function isValidLanguage(code: any): code is SupportedLanguage {
  return code === 'en' || code === 'hi' || code === 'mr';
}

export function normalizeLanguageCode(code?: string): SupportedLanguage {
  if (!code) return 'en';
  const lower = code.trim().toLowerCase();
  if (
    lower === 'hi' ||
    lower.startsWith('hi-') ||
    lower.startsWith('hindi') ||
    lower === 'हिन्दी'
  ) {
    return 'hi';
  }
  if (
    lower === 'mr' ||
    lower.startsWith('mr-') ||
    lower.startsWith('marathi') ||
    lower.startsWith('mar') ||
    lower === 'मराठी'
  ) {
    return 'mr';
  }
  return 'en';
}
