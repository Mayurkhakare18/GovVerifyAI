/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Citizen-Friendly Verdict & Explanation Formatter
 * Translates canonical verification engine states into everyday plain language
 * for citizens without technical or algorithmic jargon.
 */

export type CanonicalVerdict =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'CONTRADICTED'
  | 'INSUFFICIENT_EVIDENCE';

export const CANONICAL_VERDICTS: readonly CanonicalVerdict[] = [
  'SUPPORTED',
  'PARTIALLY_SUPPORTED',
  'CONTRADICTED',
  'INSUFFICIENT_EVIDENCE',
];

export function isCanonicalVerdict(verdict: unknown): verdict is CanonicalVerdict {
  return (
    typeof verdict === 'string' &&
    (CANONICAL_VERDICTS as readonly string[]).includes(verdict)
  );
}

export interface CitizenVerdictConfig {
  verdict: CanonicalVerdict;
  label: string;
  statement: string;
  badgeClass: string;
  pillClass: string;
  borderClass: string;
  dotColor: string;
  shortMeaning: string;
  nextStepsAdvice: string[];
}

export const CITIZEN_VERDICTS: Record<CanonicalVerdict, CitizenVerdictConfig> = {
  SUPPORTED: {
    verdict: 'SUPPORTED',
    label: 'Supported',
    statement: 'The available evidence supports this claim.',
    badgeClass: 'bg-[#EBFDF2] text-[#0B7A48] border-[#C6F5D5]',
    pillClass: 'bg-[#EBFDF2] text-[#0B7A48] border-[#C6F5D5]',
    borderClass: 'border-[#C6F5D5]',
    dotColor: '#12B76A',
    shortMeaning:
      'Official information supports the key facts in this claim. Receiving any benefits depends on meeting the scheme\'s statutory eligibility and verification requirements.',
    nextStepsAdvice: [
      'Check the official portal link below if you wish to apply or verify individual eligibility.',
      'Always use official government web addresses (.gov.in or .nic.in) for applications and payments.',
      'Copy or share this fact check to help others stay informed with verified facts.',
    ],
  },
  PARTIALLY_SUPPORTED: {
    verdict: 'PARTIALLY_SUPPORTED',
    label: 'Partly True / Conditional',
    statement: 'Some parts are correct, but there are important conditions.',
    badgeClass: 'bg-[#FEF7C3] text-[#B54708] border-[#FEDF89]',
    pillClass: 'bg-[#FEF7C3] text-[#B54708] border-[#FEDF89]',
    borderClass: 'border-[#FEDF89]',
    dotColor: '#F79009',
    shortMeaning:
      'Some parts of this statement match verified government programs, but important conditions, prerequisites, or eligibility limits apply.',
    nextStepsAdvice: [
      'Read the detailed breakdown below to see which specific points are confirmed and which are not.',
      'Consult the primary ministry guidelines before making financial or administrative decisions.',
      'Submit a narrower question if you need to verify a specific condition.',
    ],
  },
  CONTRADICTED: {
    verdict: 'CONTRADICTED',
    label: 'Contradicted',
    statement: 'Reliable evidence contradicts this claim.',
    badgeClass: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
    pillClass: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
    borderClass: 'border-[#FECDCA]',
    dotColor: '#F04438',
    shortMeaning:
      'Authoritative government records, gazettes, or official clarifications directly contradict this statement. Beware of false claims or unauthorized demands.',
    nextStepsAdvice: [
      'Do not forward or act upon viral messages repeating this claim.',
      'Beware of unofficial websites asking for registration fees or personal documents.',
      'Refer to Press Information Bureau (PIB Fact Check) or the nodal ministry for authentic alerts.',
    ],
  },
  INSUFFICIENT_EVIDENCE: {
    verdict: 'INSUFFICIENT_EVIDENCE',
    label: 'Insufficient Evidence',
    statement: 'We couldn\'t verify this claim with the available evidence.',
    badgeClass: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
    pillClass: 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]',
    borderClass: 'border-[#D0D5DD]',
    dotColor: '#667085',
    shortMeaning:
      'We could not find sufficient authoritative government gazettes or notifications to confirm or refute this claim. This does not mean the claim is false, but reliable official proof is currently unavailable.',
    nextStepsAdvice: [
      'Try searching with the specific department or ministry name if known.',
      'Check whether the announcement is local, municipal, or yet to be notified formally in the Gazette.',
      'Submit a more specific claim with exact scheme names, dates, or states.',
    ],
  },
};

/**
 * Returns citizen-friendly config for any verdict string, with safe fallback.
 */
export function getCitizenVerdict(verdictStr?: string | null): CitizenVerdictConfig {
  if (!verdictStr) {
    return CITIZEN_VERDICTS.INSUFFICIENT_EVIDENCE;
  }
  const normalized = verdictStr.toUpperCase() as CanonicalVerdict;
  return CITIZEN_VERDICTS[normalized] || CITIZEN_VERDICTS.INSUFFICIENT_EVIDENCE;
}

/**
 * Formats a plain-language explanation removing technical implementation jargon.
 */
export function cleanCitizenExplanation(rawText?: string | null): string {
  if (!rawText || typeof rawText !== 'string') {
    return 'Official verification completed. Please review the detailed evidence excerpts below.';
  }

  let cleaned = rawText
    .replace(/atomic propositions?/gi, 'specific points')
    .replace(/decomposed subclaims?/gi, 'parts of the claim')
    .replace(/semantic decomposition/gi, 'claim breakdown')
    .replace(/grounding pipeline/gi, 'source discovery')
    .replace(/google search grounding/gi, 'official government web search')
    .replace(/tavily search grounding/gi, 'authoritative government web search')
    .replace(/retrieved chunks?/gi, 'retrieved documents')
    .replace(/corpus/gi, 'collection')
    .replace(/provenance metadata/gi, 'source records');

  return cleaned.trim();
}

/**
 * Classifies an evidence source into citizen-friendly trust tiers.
 */
export function getCitizenSourceTrustBadge(domain: string, sourceType?: string): {
  label: string;
  isOfficial: boolean;
  pillClass: string;
  dotColor: string;
} {
  const d = domain.toLowerCase();

  if (d.endsWith('.gov.in') || d.endsWith('.nic.in') || d === 'india.gov.in' || d === 'mygov.in') {
    return {
      label: 'Official Government Portal',
      isOfficial: true,
      pillClass: 'bg-[#ECFDF3] text-[#027A48] border-[#D1FADF]',
      dotColor: '#12B76A',
    };
  }

  if (
    d.endsWith('rbi.org.in') ||
    d.endsWith('sebi.gov.in') ||
    d.endsWith('sci.gov.in') ||
    d.endsWith('nta.ac.in') ||
    d.endsWith('ugc.ac.in')
  ) {
    return {
      label: 'Apex Statutory Institution',
      isOfficial: true,
      pillClass: 'bg-[#EAF1FF] text-[#2457C5] border-[#D1E9FF]',
      dotColor: '#2457C5',
    };
  }

  if (d.includes('ddnews') || d.includes('newsonair') || d.includes('pib')) {
    return {
      label: 'Official Public Information Service',
      isOfficial: true,
      pillClass: 'bg-[#ECFDF3] text-[#027A48] border-[#D1FADF]',
      dotColor: '#12B76A',
    };
  }

  return {
    label: 'External Reference',
    isOfficial: false,
    pillClass: 'bg-[#F2F4F7] text-[#475467] border-[#EAECF0]',
    dotColor: '#98A2B3',
  };
}
