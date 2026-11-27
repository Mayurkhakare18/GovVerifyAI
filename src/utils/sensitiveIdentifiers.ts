/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Sensitive Identifiers & Prompt Sanitization Utility
 * Pure client- and server-safe regex validation.
 * Zero external Node.js dependencies.
 */

/**
 * Checks for sensitive personal identifiers (Aadhaar, PAN, Bank, OTP, Password)
 * and returns localized privacy refusal message if detected.
 */
export function checkSensitiveIdentifierViolation(
  text: string,
  lang: 'en' | 'hi' | 'mr' = 'en'
): { isViolated: boolean; refusalMessage?: string } {
  if (!text) return { isViolated: false };
  const clean = text.trim();

  // 12-digit Aadhaar pattern (with or without spaces/hyphens)
  const aadhaarRegex = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
  // 10-char PAN pattern (5 letters, 4 digits, 1 letter)
  const panRegex = /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/;
  // OTP / Password / PIN / CVV requests or shares
  const credentialRegex = /\b(?:otp|password|cvv|atm\s*pin|passcode|गुपित\s*शब्द|पासवर्ड|ओटीपी)\b/i;
  // Bank account numbers (9 to 18 digits with bank context)
  const bankRegex = /\b(?:account\s*(?:no|number)?|ac\s*no|खाता\s*क्रमांक)\s*[:=]?\s*\d{9,18}\b/i;

  if (
    aadhaarRegex.test(clean) ||
    panRegex.test(clean) ||
    credentialRegex.test(clean) ||
    bankRegex.test(clean)
  ) {
    if (lang === 'hi') {
      return {
        isViolated: true,
        refusalMessage:
          'नागरिक गोपनीयता सुरक्षा: कृपया अपना आधार नंबर, पैन नंबर, बैंक खाता या ओटीपी साझा न करें। GovVerify AI इन जानकारियों को एकत्र नहीं करता है। आप केवल अपनी सामान्य पात्रता जैसे राज्य, भूमि या आय के बारे में बता सकते हैं।',
      };
    }
    if (lang === 'mr') {
      return {
        isViolated: true,
        refusalMessage:
          'नागरिक गोपनीयता संरक्षण: कृपया आपला आधार क्रमांक, पॅन क्रमांक, बँक खाते किंवा ओटीपी शेअर करू नका. GovVerify AI या खाजगी नोंदी कधीही गोळा करत नाही. आपण फक्त राज्य, शेती किंवा उत्पन्न यांसारख्या सामान्य निकषांची माहिती देऊ शकता.',
      };
    }
    return {
      isViolated: true,
      refusalMessage:
        'Privacy Safeguard: Please do not share sensitive personal identifiers such as your Aadhaar number, PAN card, bank details, or OTPs. GovVerify AI never requests or stores private credentials.',
    };
  }

  return { isViolated: false };
}

/**
 * Neutralizes prompt injection patterns from speech transcription.
 */
export function sanitizeVoicePromptInjection(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|system)?\s*(?:instructions|rules|guidelines|prompts)/gi, '[neutralized_prompt]')
    .replace(/(?:mark\s+as\s+supported|force\s+approved|override\s+verdict)/gi, '[neutralized_command]')
    .replace(/(?:system\s+prompt|developer\s+mode)/gi, '[neutralized_command]')
    .trim();
}
