export const APP_CONFIG = {
  brandName: 'GovVerify AI',
  tagline: 'Verify. Know. Trust.',
  primaryHeadline: 'Verify Government Information with Confidence.',
  supportingText:
    'Check claims about government schemes, scholarships, benefits, policies, and announcements using authoritative sources. Get clear explanations and evidence references in simple language.',
  version: 'Phase 1.0 (Foundation & Civic Interface)',
  limits: {
    minClaimChars: 15,
    maxClaimChars: 1000,
    maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
    maxFileSizeDisplay: '10 MB',
    allowedMimeTypes: ['application/pdf'],
    allowedExtensions: ['.pdf'],
  },
  futureStack: {
    database: 'Supabase PostgreSQL',
    authentication: 'Supabase Auth',
    aiIntegration: 'Google Gemini 2.5 API',
    sourceRetrieval: 'Tavily Search API',
    documentExtraction: 'Native PDF OCR & Parser Pipeline',
  },
  disclaimer:
    'GovVerify AI is an independent civic technology initiative designed to help Indian citizens cross-reference public information against official government sources. It is not an official government portal, agency, or ministry. Always refer to official gazettes and portals ending in .gov.in or .nic.in for formal administrative actions.',
} as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
] as const;
