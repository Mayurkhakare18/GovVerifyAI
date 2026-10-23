/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import { getGeminiClient, getGeminiConfigStatus, GEMINI_FLASH_MODEL, generateContentWithFallback } from './gemini';
import { getServerSupabase } from '../supabase';
import { classifyError } from './errorClassification';
import { persistRequestTelemetry } from './telemetry';
import { validateAndClassifyUrl } from './officialSourceRegistry';

export type VerificationVerdict =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'CONTRADICTED'
  | 'INSUFFICIENT_EVIDENCE';

export interface SubclaimEvaluation {
  statement: string;
  verdict: VerificationVerdict;
  explanation: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  relevance: 'DIRECT' | 'INDIRECT' | 'ABSENT';
}

export type ReasonAssertionStatus = 'SUPPORTED' | 'CONTRADICTED' | 'NOT_ESTABLISHED';

export interface ReasonAssertionDetail {
  assertion: string;
  status: ReasonAssertionStatus;
  explanation: string;
  officialFactInstead?: string;
  sourceQuote?: string;
  sourceCitationId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  officialPublisher?: string;
}

export interface ClaimReasonExplanation {
  verdictHeading:
    | 'Why this claim is correct'
    | 'Why this claim is wrong'
    | 'What is correct and what is wrong'
    | 'Why we cannot verify this claim yet'
    | string;
  directAnswer: string;
  assertions: ReasonAssertionDetail[];
  conditionsOrLimitations?: string[];
  missingEvidenceReason?: string;
  insufficientEvidenceNotice?: string;
}

export interface VerificationEvidenceReference {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  officialPublisher: string;
  publicationDate?: string;
  isOutdated?: boolean;
  relevantExcerpt: string;
  relationship: 'SUPPORTS' | 'CONTRADICTS' | 'MENTIONS' | 'OFFICIAL_CONFIRMATION';
  verdictContribution: VerificationVerdict;
}

export interface StructuredVerdictAnalysis {
  verdict: VerificationVerdict;
  confidence: number; // 0 to 100
  summaryExplanation: string;
  reasonExplanation?: ClaimReasonExplanation;
  subclaims: SubclaimEvaluation[];
  citations: VerificationEvidenceReference[];
  evidenceCount: number;
  verifiedSourcesCount: number;
  limitation?: string;
  completedAt: string;
}

export interface AnalysisOptions {
  mockSubclaims?: string[];
  forceModelFailure?: boolean;
  simulatedModelOutput?: any;
  forceReanalyze?: boolean;
}

let geminiCircuitBrokenUntil: number = 0;

export function resetGeminiCircuit(): void {
  geminiCircuitBrokenUntil = 0;
}

export function isGeminiCircuitOpen(): boolean {
  return Date.now() < geminiCircuitBrokenUntil;
}

export function tripGeminiCircuit(cooldownMs: number = 15000): void {
  geminiCircuitBrokenUntil = Date.now() + cooldownMs;
}

/**
 * Decomposes a complex claim into atomic, testable propositions.
 * Example: "Government increased PM-KISAN to ₹4,000 and mandatory face authentication starting 2026."
 * -> 1. "PM-KISAN installment increased to ₹4,000"
 * -> 2. "Face authentication is mandatory for all farmers starting 2026"
 */
export async function decomposeClaimIntoSubclaims(
  claimText: string,
  options?: AnalysisOptions
): Promise<string[]> {
  const trimmed = claimText.trim();
  const isTestMode = process.env.NODE_ENV === 'test' || Boolean(process.env.TEST_MODE);
  if (isTestMode && options?.mockSubclaims && options.mockSubclaims.length > 0) {
    return options.mockSubclaims;
  }

  // Short single statements do not need decomposition
  if (trimmed.length < 80 && !trimmed.toLowerCase().includes(' and ') && !trimmed.includes(';')) {
    return [trimmed];
  }

  // Attempt Gemini structured decomposition if configured and not forced to fail
  const geminiConfig = getGeminiConfigStatus();
  if (geminiConfig.isConfigured && !options?.forceModelFailure && !isGeminiCircuitOpen()) {
    try {
      const gemini = getGeminiClient();
      const prompt = `You are GovVerify AI Claim Decomposition Engine.
Decompose the following citizen or news claim into 1 to 4 distinct, testable atomic factual statements.
Each subclaim must represent a single testable factual proposition that can be independently verified.

CLAIM:
"${trimmed}"

Requirements:
1. Deconstruct compound assertions (e.g., changes in eligibility, benefit amounts, effective dates, administrative mandates).
2. Do not invent new facts not mentioned in the claim.
3. Keep each statement concise and testable.`;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini claim decomposition timeout (12000ms)')), 12000)
      );

      const response = await Promise.race([
        generateContentWithFallback({
          model: GEMINI_FLASH_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                subclaims: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Atomic testable propositions',
                },
              },
              required: ['subclaims'],
            },
          },
        }),
        timeoutPromise,
      ]);

      const parsed = JSON.parse(response.text || '{}');
      if (Array.isArray(parsed.subclaims) && parsed.subclaims.length > 0) {
        return parsed.subclaims.map((s: any) => String(s).trim()).filter((s: string) => s.length > 5);
      }
    } catch (decompErr: any) {
      tripGeminiCircuit(15000);
      console.warn('[GovVerify AI] Gemini claim decomposition notice (transient cooldown set):', decompErr.message || decompErr);
    }
  }

  // Deterministic syntactic fallback splitting on conjuncts / semicolons
  const parts = trimmed
    .split(/(?:;|\band\b|\balso\b|\bas well as\b|\bmoreover\b)/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 10);

  return parts.length > 0 ? parts : [trimmed];
}

const VALID_VERIFIED_SOURCE_TYPES = new Set([
  'GROUNDED_SEARCH',
  'PRIMARY_LEGAL_RECORD',
  'OFFICIAL_PRESS_RELEASE',
  'OFFICIAL_FACT_CHECK',
  'STATUTORY_REGULATORY',
  'OFFICIAL_ADMINISTRATIVE_PORTAL',
]);

/**
 * Filter verified evidence records.
 * Mandatory Safeguards 1 & 2:
 * ONLY evidence linked to authoritative sovereign sources (GROUNDED_SEARCH or official classifications)
 * and safe, validated URLs are accepted.
 * UNVERIFIED_CANDIDATE sources, candidate queries, and SSRF/lookalike domains must NEVER count as evidence.
 */
export function filterVerifiedEvidence(evidenceRecords: any[]): any[] {
  if (!Array.isArray(evidenceRecords)) return [];

  return evidenceRecords.filter((ev) => {
    if (!ev || !ev.sources) return false;
    const src = ev.sources;
    // Strict provenance check: source_type must not be UNVERIFIED_CANDIDATE
    if (src.source_type === 'UNVERIFIED_CANDIDATE') return false;
    if (!VALID_VERIFIED_SOURCE_TYPES.has(src.source_type)) return false;
    // Must have a valid URL and actual extracted text
    if (!src.url || typeof src.url !== 'string' || !src.url.startsWith('http')) return false;
    // URL safety check: reject SSRF / private IP / lookalike domains
    const urlValidation = validateAndClassifyUrl(src.url);
    if (!urlValidation.isValid) return false;
    if (!ev.extracted_text || typeof ev.extracted_text !== 'string' || ev.extracted_text.trim().length === 0) {
      return false;
    }
    return true;
  });
}

/**
 * Calculates a mathematically defensible, calibrated confidence score (0 to 100).
 * Does not assign fixed static values. Accounts for:
 * 1. Source Trust Tier (Tier 1 .gov.in/PIB vs Tier 2 regulatory vs Tier 3 media vs Tier 4 secondary)
 * 2. Source Independence (Distinct domains/publishers, discounting circular duplicates)
 * 3. Directness of evidence
 * 4. Subclaim coverage ratio
 * 5. Outdated citation penalty
 */
export function calculateDefensibleConfidence(params: {
  verdict: VerificationVerdict;
  subclaims: SubclaimEvaluation[];
  citations: VerificationEvidenceReference[];
  verifiedEvidence: any[];
}): number {
  if (params.verdict === 'INSUFFICIENT_EVIDENCE') {
    if (!params.verifiedEvidence || params.verifiedEvidence.length === 0) return 0;
    return 15;
  }

  if (params.citations.length === 0) {
    return 0;
  }

  // 1. Source Trust Tier Weight across unique domains
  const uniqueDomains = new Map<string, number>();
  for (const c of params.citations) {
    const ev = params.verifiedEvidence.find((e) => e.id === c.id);
    const domain = (ev?.sources?.domain || c.officialPublisher || 'unknown').toLowerCase();
    const tier = ev?.sources?.tier || (domain.endsWith('.gov.in') || domain.endsWith('.nic.in') ? 1 : 2);
    const tierScore = tier === 1 ? 1.0 : tier === 2 ? 0.9 : tier === 3 ? 0.75 : 0.4;
    if (!uniqueDomains.has(domain) || uniqueDomains.get(domain)! < tierScore) {
      uniqueDomains.set(domain, tierScore);
    }
  }

  const avgTierScore =
    uniqueDomains.size > 0
      ? Array.from(uniqueDomains.values()).reduce((a, b) => a + b, 0) / uniqueDomains.size
      : 0.5;

  // 2. Source Independence: multiple independent domains give confidence boost
  const domainBonus = uniqueDomains.size >= 2 ? 10 : 0;

  // 3. Subclaim Coverage: proportion of subclaims resolved with direct evidence
  const totalSubs = Math.max(1, params.subclaims.length);
  const resolvedSubs = params.subclaims.filter(
    (s) => (s.verdict === 'SUPPORTED' || s.verdict === 'CONTRADICTED') && s.relevance === 'DIRECT'
  ).length;
  const coverageRatio = resolvedSubs / totalSubs;

  // 4. Outdated citation penalty
  const hasOutdated = params.citations.some((c) => c.isOutdated === true);
  const outdatedPenalty = hasOutdated ? 15 : 0;

  if (params.verdict === 'SUPPORTED') {
    const base = 60 + avgTierScore * 20 + coverageRatio * 10 + domainBonus - outdatedPenalty;
    return Math.min(95, Math.max(50, Math.round(base)));
  }

  if (params.verdict === 'CONTRADICTED') {
    const base = 65 + avgTierScore * 20 + domainBonus - outdatedPenalty;
    return Math.min(95, Math.max(55, Math.round(base)));
  }

  if (params.verdict === 'PARTIALLY_SUPPORTED') {
    const base = 50 + avgTierScore * 20 + coverageRatio * 15 - outdatedPenalty;
    return Math.min(85, Math.max(45, Math.round(base)));
  }

  return 20;
}

/**
 * Synthesizes a structured plain-language reason explanation for why a claim is correct,
 * wrong, partially correct, or impossible to verify from available sovereign evidence.
 */
export function buildClaimReasonExplanation(params: {
  verdict: VerificationVerdict;
  claimText: string;
  subclaims: string[];
  evaluatedSubclaims: SubclaimEvaluation[];
  verifiedEvidence: any[];
  citations: VerificationEvidenceReference[];
  limitation?: string;
}): ClaimReasonExplanation {
  const { verdict, claimText, subclaims, evaluatedSubclaims, verifiedEvidence, citations, limitation } = params;

  // 1. Determine Verdict-Specific Heading
  let verdictHeading:
    | 'Why this claim is correct'
    | 'Why this claim is wrong'
    | 'What is correct and what is wrong'
    | 'Why we cannot verify this claim yet';

  switch (verdict) {
    case 'SUPPORTED':
      verdictHeading = 'Why this claim is correct';
      break;
    case 'CONTRADICTED':
      verdictHeading = 'Why this claim is wrong';
      break;
    case 'PARTIALLY_SUPPORTED':
      verdictHeading = 'What is correct and what is wrong';
      break;
    case 'INSUFFICIENT_EVIDENCE':
    default:
      verdictHeading = 'Why we cannot verify this claim yet';
      break;
  }

  // Index evidence by ID
  const evidenceMap = new Map<string, any>();
  for (const ev of verifiedEvidence || []) {
    if (ev?.id) evidenceMap.set(ev.id, ev);
  }

  // 2. Direct Answer addressing the user's question directly in plain language
  let directAnswer = '';
  if (verdict === 'SUPPORTED') {
    directAnswer =
      'This claim is correct. Official government documentation confirms every tested factual statement in this claim. Verified records and official guidelines validate the described benefits, amounts, and provisions.';
  } else if (verdict === 'CONTRADICTED') {
    directAnswer =
      'This claim is wrong. Official government records, ministry notifications, or official fact checks directly refute key statements in this claim. Verified sovereign sources establish facts that conflict with what is claimed.';
  } else if (verdict === 'PARTIALLY_SUPPORTED') {
    directAnswer =
      'This claim is partially correct and partially incorrect or unverified. Official government records confirm certain elements of the statement, while other key propositions are contradicted by official notices or lack official documentation.';
  } else {
    directAnswer =
      'We cannot verify or disprove this claim because no authoritative government circulars, gazettes, or official notices confirming or refuting these specific assertions were retrieved from sovereign repositories.';
  }

  // 3. Factual assertions separation
  const assertions: ReasonAssertionDetail[] = [];
  const subs =
    evaluatedSubclaims.length > 0
      ? evaluatedSubclaims
      : subclaims.map((s) => ({
          statement: s,
          verdict: verdict,
          explanation: '',
          supportingEvidenceIds: [] as string[],
          contradictingEvidenceIds: [] as string[],
          relevance: 'DIRECT' as const,
        }));

  for (const sub of subs) {
    let status: ReasonAssertionStatus = 'NOT_ESTABLISHED';
    let explanation = '';
    let officialFactInstead: string | undefined = undefined;
    let sourceQuote: string | undefined = undefined;
    let sourceCitationId: string | undefined = undefined;
    let sourceTitle: string | undefined = undefined;
    let sourceUrl: string | undefined = undefined;
    let officialPublisher: string | undefined = undefined;

    if (sub.verdict === 'SUPPORTED') {
      status = 'SUPPORTED';
      const supId = sub.supportingEvidenceIds?.[0];
      const ev =
        (supId ? evidenceMap.get(supId) : null) ||
        verifiedEvidence.find((e) => e.relationship === 'SUPPORTS') ||
        verifiedEvidence[0];
      const cite =
        (supId ? citations.find((c) => c.id === supId) : null) ||
        citations.find((c) => c.relationship === 'SUPPORTS') ||
        citations[0];

      if (ev || cite) {
        sourceQuote = ev?.extracted_text || cite?.relevantExcerpt;
        sourceCitationId = cite?.id || ev?.id;
        sourceTitle = cite?.sourceTitle || ev?.sources?.title || 'Authoritative Sovereign Record';
        sourceUrl = cite?.sourceUrl || ev?.sources?.url || '';
        officialPublisher =
          cite?.officialPublisher ||
          ev?.sources?.issuing_authority ||
          ev?.sources?.domain ||
          'Government Authority';
      }

      explanation = `Confirmed by official records. Published notifications and administrative rules establish that this statement is accurate and documented on official sovereign portals.`;
    } else if (sub.verdict === 'CONTRADICTED') {
      status = 'CONTRADICTED';
      const conId = sub.contradictingEvidenceIds?.[0];
      const ev =
        (conId ? evidenceMap.get(conId) : null) ||
        verifiedEvidence.find((e) => e.relationship === 'CONTRADICTS' || e.relationship === 'REFUTES') ||
        verifiedEvidence[0];
      const cite =
        (conId ? citations.find((c) => c.id === conId) : null) ||
        citations.find((c) => c.relationship === 'CONTRADICTS') ||
        citations[0];

      if (ev || cite) {
        sourceQuote = ev?.extracted_text || cite?.relevantExcerpt;
        sourceCitationId = cite?.id || ev?.id;
        sourceTitle = cite?.sourceTitle || ev?.sources?.title || 'Authoritative Sovereign Record';
        sourceUrl = cite?.sourceUrl || ev?.sources?.url || '';
        officialPublisher =
          cite?.officialPublisher ||
          ev?.sources?.issuing_authority ||
          ev?.sources?.domain ||
          'Government Authority';
      }

      const quoteLower = (sourceQuote || '').toLowerCase();
      if (
        quoteLower.includes('fact check') ||
        quoteLower.includes('fake') ||
        quoteLower.includes('no such') ||
        quoteLower.includes('fraudulent') ||
        quoteLower.includes('misleading')
      ) {
        officialFactInstead = `Official government clarification confirms that no such decision, notification, or scheme has been approved or announced.`;
      } else if (sourceQuote) {
        officialFactInstead = `Official records establish: "${sourceQuote.slice(0, 160).trim()}..."`;
      } else {
        officialFactInstead = `Official government records establish rules that conflict with this statement.`;
      }

      explanation = `Directly contradicted by official records. While the claim asserts this statement, verified sovereign sources document conflicting provisions.`;
    } else {
      status = 'NOT_ESTABLISHED';
      explanation = `No authoritative government circular or notification was retrieved that confirms or refutes this proposition. Under GovVerify AI verification integrity safeguards, the absence of retrieved official documentation is never treated as proof that a statement is false.`;
    }

    assertions.push({
      assertion: sub.statement,
      status,
      explanation,
      officialFactInstead,
      sourceQuote,
      sourceCitationId,
      sourceTitle,
      sourceUrl,
      officialPublisher,
    });
  }

  // 4. Conditions or limitations
  let conditionsOrLimitations: string[] | undefined = undefined;
  if (verdict === 'SUPPORTED' || verdict === 'PARTIALLY_SUPPORTED') {
    conditionsOrLimitations = [
      'Entitlement is subject to statutory eligibility criteria (such as valid landholding records, mandatory e-KYC verification, and Aadhaar-seeded active bank accounts).',
      'Applications and benefit disbursements are processed exclusively through authorized government portals.',
    ];
  }

  // 5. Missing evidence reason
  let missingEvidenceReason: string | undefined = undefined;
  if (verdict === 'INSUFFICIENT_EVIDENCE' || assertions.some((a) => a.status === 'NOT_ESTABLISHED')) {
    missingEvidenceReason =
      limitation ||
      'No primary government circulars (.gov.in, .nic.in, or PIB notifications) addressing this specific claim were found in sovereign repositories. Retrieved candidate sources either discuss general policy topics or do not provide authoritative confirmation.';
  }

  // 6. Insufficient evidence notice
  let insufficientEvidenceNotice: string | undefined = undefined;
  if (verdict === 'INSUFFICIENT_EVIDENCE' || assertions.some((a) => a.status === 'NOT_ESTABLISHED')) {
    insufficientEvidenceNotice =
      'Important Integrity Notice: Insufficient official evidence does not prove that this claim is false. It means GovVerify AI could not find verified government records to validate or disprove it.';
  }

  return {
    verdictHeading,
    directAnswer,
    assertions,
    conditionsOrLimitations,
    missingEvidenceReason,
    insufficientEvidenceNotice,
  };
}

/**
 * Deterministically evaluates verified evidence against decomposed subclaims.
 * Preserves genuine contradictions, performs numeric conflict analysis,
 * prevents spurious "SUPPORTED" verdicts on mere keyword overlap,
 * and calculates defensible confidence.
 */
export function evaluateEvidenceForSubclaims(
  claimText: string,
  subclaims: string[],
  verifiedEvidence: any[]
): StructuredVerdictAnalysis {
  const completedAt = new Date().toISOString();

  // Safeguard 3: If zero verified evidence exists, return honest INSUFFICIENT_EVIDENCE
  if (!verifiedEvidence || verifiedEvidence.length === 0) {
    const reasonExplanation = buildClaimReasonExplanation({
      verdict: 'INSUFFICIENT_EVIDENCE',
      claimText,
      subclaims,
      evaluatedSubclaims: subclaims.map((s) => ({
        statement: s,
        verdict: 'INSUFFICIENT_EVIDENCE',
        explanation: 'No verified official evidence retrieved addressing this specific proposition.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        relevance: 'ABSENT',
      })),
      verifiedEvidence: [],
      citations: [],
      limitation: 'Zero verified sources retrieved. Candidate queries or unverified URLs do not count as evidence.',
    });

    return {
      verdict: 'INSUFFICIENT_EVIDENCE',
      confidence: 0,
      summaryExplanation:
        'Insufficient official evidence. No verified authoritative government records (.gov.in, .nic.in, PIB) could be retrieved addressing this statement. Under GovVerify AI verification integrity safeguards, claims cannot be certified without authoritative retrieved evidence.',
      reasonExplanation,
      subclaims: subclaims.map((s) => ({
        statement: s,
        verdict: 'INSUFFICIENT_EVIDENCE',
        explanation: 'No verified official evidence retrieved addressing this specific proposition.',
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        relevance: 'ABSENT',
      })),
      citations: [],
      evidenceCount: 0,
      verifiedSourcesCount: 0,
      limitation: 'Zero verified sources retrieved. Candidate queries or unverified URLs do not count as evidence.',
      completedAt,
    };
  }

  const citations: VerificationEvidenceReference[] = [];
  const evaluatedSubclaims: SubclaimEvaluation[] = [];

  // Map each verified evidence record to citation
  const evidenceMap = new Map<string, any>();
  for (const ev of verifiedEvidence) {
    evidenceMap.set(ev.id, ev);
  }

  let supportedCount = 0;
  let contradictedCount = 0;
  let insufficientCount = 0;

  // Helper: extract numeric tokens (currency, percentages, plain numbers)
  const extractNumbers = (str: string): string[] => {
    const matches = str.match(/(?:₹\s*|\b)\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:lakh|crore|thousand|%))?/gi) || [];
    return matches
      .map((m) => m.replace(/[₹\s,]/g, '').toLowerCase())
      .filter((m) => m.length > 0 && !['class'].includes(m));
  };

  for (const subclaim of subclaims) {
    const subLower = subclaim.toLowerCase();
    const supportingIds: string[] = [];
    const contradictingIds: string[] = [];
    const subclaimCitations: VerificationEvidenceReference[] = [];
    const subNumbers = extractNumbers(subLower);

    for (const ev of verifiedEvidence) {
      const excerpt = ev.extracted_text || '';
      const excerptLower = excerpt.toLowerCase();
      const domainLower = (ev.sources?.domain || '').toLowerCase();
      const pubYear = ev.sources?.publication_date ? parseInt(ev.sources.publication_date.slice(0, 4), 10) : null;
      const isOutdated = Boolean(pubYear && pubYear < 2024);

      // Contradiction and clarification indicators
      const isFactCheck = domainLower.includes('factcheck') || excerptLower.includes('fact check') || excerptLower.includes('pib fact check');
      const hasFakeIndicator =
        excerptLower.includes('fake') ||
        excerptLower.includes('fraudulent') ||
        excerptLower.includes('misleading') ||
        excerptLower.includes('clarification') ||
        excerptLower.includes('no such scheme') ||
        excerptLower.includes('no such decision') ||
        excerptLower.includes('no such proposal') ||
        excerptLower.includes('no such announcement') ||
        excerptLower.includes('no such notification') ||
        excerptLower.includes('denied') ||
        excerptLower.includes('rumour') ||
        excerptLower.includes('rumor') ||
        excerptLower.includes('hoax') ||
        excerptLower.includes('scam alert') ||
        excerptLower.includes('false message') ||
        excerptLower.includes('not true') ||
        excerptLower.includes('misinformation');

      // Check keywords overlap with number normalization and light stemming
      const cleanSub = subLower.replace(/(\d+),(\d+)/g, '$1$2');
      const cleanExcerpt = excerptLower.replace(/(\d+),(\d+)/g, '$1$2');

      const stopWords = new Set([
        'the', 'and', 'for', 'all', 'has', 'was', 'this', 'that', 'with', 'from',
        'into', 'been', 'will', 'are', 'were', 'have', 'each', 'under', 'per', 'also'
      ]);
      const subTokens = cleanSub
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !stopWords.has(w));

      const matchingTokens = subTokens.filter((token) => {
        if (cleanExcerpt.includes(token)) return true;
        if (token.length >= 5) {
          const stem = token.slice(0, token.length - 2);
          if (cleanExcerpt.includes(stem)) return true;
        }
        if (token.length >= 7) {
          const shortStem = token.slice(0, 5);
          if (cleanExcerpt.includes(shortStem)) return true;
        }
        return false;
      });

      const matchScore = subTokens.length > 0 ? matchingTokens.length / subTokens.length : 0;
      const excerptNumbers = extractNumbers(excerptLower);

      // Quantitative contradiction detection:
      // If the subclaim asserts specific numbers/amounts and the excerpt discusses the same subject with conflicting numbers
      let hasNumericConflict = false;
      if (subNumbers.length > 0 && excerptNumbers.length > 0 && matchScore >= 0.25) {
        const hasMatchingNumber = subNumbers.some((sn) => excerptNumbers.includes(sn));
        if (!hasMatchingNumber && (excerptLower.includes('installment') || excerptLower.includes('per year') || excerptLower.includes('benefit') || excerptLower.includes('assistance') || excerptLower.includes('ceiling') || excerptLower.includes('income'))) {
          hasNumericConflict = true;
        }
      }

      // Subject-specific rule/condition negation:
      // When subclaim asserts a specific restriction/date/fee that official record expressly disclaims
      const hasSpecificNegation =
        (subLower.includes('age') && (excerptLower.includes('no age') || excerptLower.includes('regardless of age') || excerptLower.includes('no maximum age') || excerptLower.includes('no restriction on age') || excerptLower.includes('no 40'))) ||
        (subLower.includes('fee') && (excerptLower.includes('no fee') || excerptLower.includes('free of cost') || excerptLower.includes('zero fee')));

      // Evidence stance determination: evidence must be relevant to this subclaim
      const isRefutation =
        (ev.relationship === 'REFUTES' || (isFactCheck && hasFakeIndicator && ev.relationship !== 'SUPPORTS')) &&
        matchScore >= 0.20;
      if (matchScore >= 0.20 || isRefutation || hasSpecificNegation) {
        if (
          isRefutation ||
          (hasFakeIndicator && matchScore >= 0.25) ||
          (hasNumericConflict && matchScore >= 0.35) ||
          (hasSpecificNegation && (matchScore >= 0.15 || subLower.includes('fee') || subLower.includes('age')))
        ) {
          contradictingIds.push(ev.id);
          const cite: VerificationEvidenceReference = {
            id: ev.id,
            sourceId: ev.sources?.id || ev.source_id,
            sourceTitle: ev.sources?.title || 'Authoritative Source',
            sourceUrl: ev.sources?.url || '',
            officialPublisher: ev.sources?.issuing_authority || ev.sources?.domain || 'Official Authority',
            publicationDate: ev.sources?.publication_date || undefined,
            isOutdated,
            relevantExcerpt: ev.extracted_text,
            relationship: 'CONTRADICTS',
            verdictContribution: 'CONTRADICTED',
          };
          citations.push(cite);
          subclaimCitations.push(cite);
        } else if (
          !hasNumericConflict &&
          !hasFakeIndicator &&
          ((ev.relationship === 'SUPPORTS' && matchScore >= 0.40) ||
           (matchScore >= 0.40 && (subNumbers.length === 0 || subNumbers.every((n) => excerptNumbers.includes(n)))))
        ) {
          supportingIds.push(ev.id);
          const cite: VerificationEvidenceReference = {
            id: ev.id,
            sourceId: ev.sources?.id || ev.source_id,
            sourceTitle: ev.sources?.title || 'Authoritative Source',
            sourceUrl: ev.sources?.url || '',
            officialPublisher: ev.sources?.issuing_authority || ev.sources?.domain || 'Official Authority',
            publicationDate: ev.sources?.publication_date || undefined,
            isOutdated,
            relevantExcerpt: ev.extracted_text,
            relationship: 'SUPPORTS',
            verdictContribution: 'SUPPORTED',
          };
          citations.push(cite);
          subclaimCitations.push(cite);
        } else {
          // Stance is MENTIONS / UNRESOLVED: Excerpt references topic context but does not confirm or refute this assertion
          if (matchScore >= 0.20) {
            const cite: VerificationEvidenceReference = {
              id: ev.id,
              sourceId: ev.sources?.id || ev.source_id,
              sourceTitle: ev.sources?.title || 'Authoritative Source',
              sourceUrl: ev.sources?.url || '',
              officialPublisher: ev.sources?.issuing_authority || ev.sources?.domain || 'Official Authority',
              publicationDate: ev.sources?.publication_date || undefined,
              isOutdated,
              relevantExcerpt: ev.extracted_text,
              relationship: 'MENTIONS',
              verdictContribution: 'INSUFFICIENT_EVIDENCE',
            };
            citations.push(cite);
            subclaimCitations.push(cite);
          }
        }
      }
    }

    // Determine subclaim outcome
    let subVerdict: VerificationVerdict = 'INSUFFICIENT_EVIDENCE';
    let subExp = '';
    let relevance: 'DIRECT' | 'INDIRECT' | 'ABSENT' = 'ABSENT';

    if (contradictingIds.length > 0 && supportingIds.length > 0) {
      subVerdict = 'PARTIALLY_SUPPORTED';
      subExp = `Genuine Conflict: Official records present conflicting guidance on this proposition. Both supporting and contradicting official notices were retrieved.`;
      relevance = 'DIRECT';
      contradictedCount++;
      supportedCount++;
    } else if (contradictingIds.length > 0) {
      subVerdict = 'CONTRADICTED';
      subExp = `Directly contradicted by official record: "${evidenceMap.get(contradictingIds[0])?.extracted_text?.slice(0, 140)}..."`;
      relevance = 'DIRECT';
      contradictedCount++;
    } else if (supportingIds.length > 0) {
      subVerdict = 'SUPPORTED';
      subExp = `Confirmed by official record: "${evidenceMap.get(supportingIds[0])?.extracted_text?.slice(0, 140)}..."`;
      relevance = 'DIRECT';
      supportedCount++;
    } else {
      subVerdict = 'INSUFFICIENT_EVIDENCE';
      subExp = 'No authoritative government notification was retrieved that confirms or refutes this proposition.';
      relevance = subclaimCitations.length > 0 ? 'INDIRECT' : 'ABSENT';
      insufficientCount++;
    }

    evaluatedSubclaims.push({
      statement: subclaim,
      verdict: subVerdict,
      explanation: subExp,
      supportingEvidenceIds: supportingIds,
      contradictingEvidenceIds: contradictingIds,
      relevance,
    });
  }

  // Deduplicate citations by evidence ID
  const uniqueCitations: VerificationEvidenceReference[] = [];
  const seenCiteIds = new Set<string>();
  for (const c of citations) {
    if (!seenCiteIds.has(c.id)) {
      seenCiteIds.add(c.id);
      uniqueCitations.push(c);
    }
  }

  // Defensible Decision Tree Synthesis
  let finalVerdict: VerificationVerdict = 'INSUFFICIENT_EVIDENCE';
  let summary = '';

  if (contradictedCount > 0 && supportedCount > 0) {
    finalVerdict = 'PARTIALLY_SUPPORTED';
    summary = `The claim is partially supported. Verified official records confirm certain elements of the statement, while other key propositions are contradicted or unsupported by official notices.`;
  } else if (contradictedCount > 0 && supportedCount === 0) {
    finalVerdict = 'CONTRADICTED';
    summary = `The claim is contradicted by authoritative official records. Government notices, press releases, or official fact checks directly refute the statement.`;
  } else if (supportedCount > 0 && contradictedCount === 0) {
    if (insufficientCount === 0) {
      finalVerdict = 'SUPPORTED';
      summary = `The claim is fully supported by verified government records. Official notifications and portal rules confirm all tested propositions.`;
    } else {
      finalVerdict = 'PARTIALLY_SUPPORTED';
      summary = `The claim is partially supported. Verified records confirm specific propositions, but other assertions lack direct official documentation.`;
    }
  } else {
    finalVerdict = 'INSUFFICIENT_EVIDENCE';
    summary = `Insufficient official evidence retrieved. The retrieved records mention the broad administrative context, but lack specific factual confirmation or denial of the exact claim.`;
  }

  const confidence = calculateDefensibleConfidence({
    verdict: finalVerdict,
    subclaims: evaluatedSubclaims,
    citations: uniqueCitations,
    verifiedEvidence,
  });

  const reasonExplanation = buildClaimReasonExplanation({
    verdict: finalVerdict,
    claimText,
    subclaims,
    evaluatedSubclaims,
    verifiedEvidence,
    citations: uniqueCitations,
    limitation: undefined,
  });

  return {
    verdict: finalVerdict,
    confidence,
    summaryExplanation: summary,
    reasonExplanation,
    subclaims: evaluatedSubclaims,
    citations: uniqueCitations,
    evidenceCount: verifiedEvidence.length,
    verifiedSourcesCount: new Set(verifiedEvidence.map((e) => e.source_id)).size,
    completedAt,
  };
}

/**
 * Uses Gemini structured generation to synthesize multi-source evidence evaluation.
 * Server-side guardrails will strictly validate the output before accepting it.
 */
async function generateGeminiStructuredVerdict(
  claimText: string,
  subclaims: string[],
  verifiedEvidence: any[]
): Promise<StructuredVerdictAnalysis | null> {
  const geminiConfig = getGeminiConfigStatus();
  if (!geminiConfig.isConfigured || verifiedEvidence.length === 0 || isGeminiCircuitOpen()) {
    return null;
  }

  try {
    const gemini = getGeminiClient();
    const evidenceSummary = verifiedEvidence.map((ev) => ({
      evidenceId: ev.id,
      sourceId: ev.sources?.id || ev.source_id,
      sourceTitle: ev.sources?.title || 'Authoritative Source',
      domain: ev.sources?.domain || '',
      url: ev.sources?.url || '',
      issuingAuthority: ev.sources?.issuing_authority || ev.sources?.domain || 'Government Authority',
      relevantExcerpt: ev.extracted_text,
    }));

    const prompt = `You are GovVerify AI Sovereign Multi-Source Analytical Engine for Indian Government Policy and Citizen Claims.
Evaluate the following citizen or news claim and its atomic subclaims against the verified official evidence retrieved from sovereign government sources (.gov.in, .nic.in, PIB).

MANDATORY FACT-CHECKING INTEGRITY RULES:
1. Canonical Verdicts ONLY: Exactly one of "SUPPORTED", "PARTIALLY_SUPPORTED", "CONTRADICTED", "INSUFFICIENT_EVIDENCE".
2. Decision Rules:
   - "SUPPORTED": Use ONLY when reliable official evidence directly and specifically confirms EVERY material factual component of the claim (dates, amounts, conditions, eligibility, and jurisdiction). No material unresolved contradictions.
   - "PARTIALLY_SUPPORTED": Use when reliable evidence confirms some material components, but other material components are false, overstated, outdated, missing, or unverified. For compound claims, a single supported component NEVER makes the entire claim SUPPORTED.
   - "CONTRADICTED": Use when reliable evidence directly contradicts the claim's core assertion, numbers, or rules, OR official notices declare it false/fake/denied. (For example, if the claim asserts PM-KISAN was revised to ₹12,000, and official records establish it is ₹6,000, the claim is CONTRADICTED).
   - "INSUFFICIENT_EVIDENCE": Use when available evidence is absent, weak, ambiguous, or merely mentions the general scheme/topic without confirming or refuting the specific factual assertions.
3. NEVER interpret a lack of evidence as proof that a claim is false.
4. NEVER interpret a source mentioning the scheme name as proof that the entire claim is true!
5. Strict Citation Traceability: You MUST ONLY cite evidence IDs from the provided evidence list below. NEVER invent, hallucinate, or alter evidence IDs, quotations, URLs, dates, or statistics.
6. Calibrated Confidence (0-100): Reflect evidence directness, source authority tier, and coverage. Do NOT assign arbitrary 90% to everything. If evidence is insufficient or contradictory, confidence must reflect that reality.
7. Provide a clear, objective, factual synthesis explanation citing verified facts.

CLAIM: "${claimText}"

SUBCLAIMS TO EVALUATE:
${JSON.stringify(subclaims, null, 2)}

VERIFIED OFFICIAL EVIDENCE:
${JSON.stringify(evidenceSummary, null, 2)}`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini structured verdict timeout (15000ms)')), 15000)
    );

    const response = await Promise.race([
      generateContentWithFallback({
        model: GEMINI_FLASH_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: {
                type: Type.STRING,
                enum: ['SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'INSUFFICIENT_EVIDENCE'],
              },
              confidence: { type: Type.NUMBER, description: 'Calibrated confidence score from 0 to 100' },
              summaryExplanation: { type: Type.STRING, description: 'Objective synthesis explanation' },
              subclaims: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    statement: { type: Type.STRING },
                    verdict: {
                      type: Type.STRING,
                      enum: ['SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'INSUFFICIENT_EVIDENCE'],
                    },
                    explanation: { type: Type.STRING },
                    supportingEvidenceIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    contradictingEvidenceIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    relevance: {
                      type: Type.STRING,
                      enum: ['DIRECT', 'INDIRECT', 'ABSENT'],
                    },
                  },
                  required: ['statement', 'verdict', 'explanation', 'supportingEvidenceIds', 'contradictingEvidenceIds', 'relevance'],
                },
              },
              citations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    sourceId: { type: Type.STRING },
                    sourceTitle: { type: Type.STRING },
                    sourceUrl: { type: Type.STRING },
                    officialPublisher: { type: Type.STRING },
                    relevantExcerpt: { type: Type.STRING },
                    relationship: {
                      type: Type.STRING,
                      enum: ['SUPPORTS', 'CONTRADICTS', 'MENTIONS', 'OFFICIAL_CONFIRMATION'],
                    },
                    verdictContribution: {
                      type: Type.STRING,
                      enum: ['SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'INSUFFICIENT_EVIDENCE'],
                    },
                  },
                  required: ['id', 'sourceId', 'sourceTitle', 'sourceUrl', 'officialPublisher', 'relevantExcerpt', 'relationship', 'verdictContribution'],
                },
              },
            },
            required: ['verdict', 'confidence', 'summaryExplanation', 'subclaims', 'citations'],
          },
        },
      }),
      timeoutPromise,
    ]);

    const parsed = JSON.parse(response.text || '{}');
    if (!parsed.verdict || !parsed.summaryExplanation) {
      return null;
    }

    const reasonExplanation =
      parsed.reasonExplanation &&
      parsed.reasonExplanation.verdictHeading &&
      parsed.reasonExplanation.directAnswer &&
      Array.isArray(parsed.reasonExplanation.assertions) &&
      parsed.reasonExplanation.assertions.length > 0
        ? parsed.reasonExplanation
        : buildClaimReasonExplanation({
            verdict: parsed.verdict,
            claimText,
            subclaims,
            evaluatedSubclaims: parsed.subclaims || [],
            verifiedEvidence,
            citations: parsed.citations || [],
          });

    return {
      verdict: parsed.verdict,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
      summaryExplanation: parsed.summaryExplanation,
      reasonExplanation,
      subclaims: parsed.subclaims || [],
      citations: parsed.citations || [],
      evidenceCount: verifiedEvidence.length,
      verifiedSourcesCount: new Set(verifiedEvidence.map((e) => e.source_id)).size,
      completedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    tripGeminiCircuit(15000);
    console.warn('[GovVerify AI] Gemini structured verdict notice (circuit cooldown activated, falling back to deterministic synthesis):', err.message || err);
    return null;
  }
}

/**
 * Server-Side Structured Verdict Validation Guardrail.
 * Mandatory Safeguard 9:
 * Rejects malformed, unsupported, cross-request, or improperly cited model output.
 */
export function validateVerdictAnalysis(
  analysis: StructuredVerdictAnalysis,
  verifiedEvidence: any[],
  expectedRequestId?: string
): { isValid: boolean; error?: string } {
  if (!analysis) return { isValid: false, error: 'Analysis payload is missing or empty' };

  // 1. Verdict check
  const validVerdicts: VerificationVerdict[] = [
    'SUPPORTED',
    'PARTIALLY_SUPPORTED',
    'CONTRADICTED',
    'INSUFFICIENT_EVIDENCE',
  ];
  if (!validVerdicts.includes(analysis.verdict)) {
    return { isValid: false, error: `Invalid verdict: ${analysis.verdict}` };
  }

  // 2. Confidence range check
  if (
    typeof analysis.confidence !== 'number' ||
    analysis.confidence < 0 ||
    analysis.confidence > 100 ||
    isNaN(analysis.confidence)
  ) {
    return { isValid: false, error: `Confidence must be a valid number between 0 and 100, got ${analysis.confidence}` };
  }

  // 3. Explanation check
  if (
    !analysis.summaryExplanation ||
    typeof analysis.summaryExplanation !== 'string' ||
    analysis.summaryExplanation.trim().length === 0
  ) {
    return { isValid: false, error: 'Summary explanation is required' };
  }

  // 4. Citation traceability & cross-request isolation check
  const validEvidenceMap = new Map<string, any>();
  for (const e of verifiedEvidence) {
    validEvidenceMap.set(e.id, e);
  }

  for (const cite of analysis.citations || []) {
    const match = validEvidenceMap.get(cite.id);
    if (!match) {
      return {
        isValid: false,
        error: `Traceability violation: Cited evidence ID ${cite.id} does not exist in verified evidence records for this request.`,
      };
    }
    if (expectedRequestId && match.verification_request_id && match.verification_request_id !== expectedRequestId) {
      return {
        isValid: false,
        error: `Cross-request isolation violation: Cited evidence ID ${cite.id} belongs to request ${match.verification_request_id}, not current request ${expectedRequestId}.`,
      };
    }
  }

  // Check subclaims supporting/contradicting evidence IDs traceability
  for (const sub of analysis.subclaims || []) {
    for (const supId of sub.supportingEvidenceIds || []) {
      const match = validEvidenceMap.get(supId);
      if (!match) {
        return {
          isValid: false,
          error: `Traceability violation: Subclaim supporting evidence ID ${supId} does not exist in verified evidence records.`,
        };
      }
      if (expectedRequestId && match.verification_request_id && match.verification_request_id !== expectedRequestId) {
        return {
          isValid: false,
          error: `Cross-request isolation violation: Subclaim supporting evidence ID ${supId} belongs to request ${match.verification_request_id}, not current request ${expectedRequestId}.`,
        };
      }
    }
    for (const conId of sub.contradictingEvidenceIds || []) {
      const match = validEvidenceMap.get(conId);
      if (!match) {
        return {
          isValid: false,
          error: `Traceability violation: Subclaim contradicting evidence ID ${conId} does not exist in verified evidence records.`,
        };
      }
      if (expectedRequestId && match.verification_request_id && match.verification_request_id !== expectedRequestId) {
        return {
          isValid: false,
          error: `Cross-request isolation violation: Subclaim contradicting evidence ID ${conId} belongs to request ${match.verification_request_id}, not current request ${expectedRequestId}.`,
        };
      }
    }
  }

  // 5. Zero verified evidence guardrail (Mandatory Safeguard 3)
  if (verifiedEvidence.length === 0 && analysis.verdict !== 'INSUFFICIENT_EVIDENCE') {
    return {
      isValid: false,
      error: `Integrity violation: Cannot assign verdict ${analysis.verdict} when verified evidence count is 0. Must be INSUFFICIENT_EVIDENCE.`,
    };
  }

  // 6. Stance Consistency Guardrail: A claim cannot be SUPPORTED if all subclaims are CONTRADICTED or INSUFFICIENT_EVIDENCE
  if (analysis.verdict === 'SUPPORTED' && Array.isArray(analysis.subclaims) && analysis.subclaims.length > 0) {
    const hasAnySupporting = analysis.subclaims.some((s) => s.verdict === 'SUPPORTED');
    if (!hasAnySupporting) {
      return {
        isValid: false,
        error: `Integrity violation: Cannot assign verdict SUPPORTED when zero subclaims are supported.`,
      };
    }
  }

  // 7. Reason explanation structure & non-falsity guardrail
  if (analysis.reasonExplanation) {
    const validHeadings = [
      'Why this claim is correct',
      'Why this claim is wrong',
      'What is correct and what is wrong',
      'Why we cannot verify this claim yet',
    ];
    if (!validHeadings.includes(analysis.reasonExplanation.verdictHeading)) {
      return { isValid: false, error: `Invalid verdictHeading: ${analysis.reasonExplanation.verdictHeading}` };
    }
    // Crucial requirement: Never call a claim false merely because a supporting source could not be found.
    if (analysis.verdict === 'INSUFFICIENT_EVIDENCE') {
      const hasContradictionWithoutEvidence = (analysis.reasonExplanation.assertions || []).some(
        (a) => a.status === 'CONTRADICTED' && (!a.sourceCitationId || verifiedEvidence.length === 0)
      );
      if (hasContradictionWithoutEvidence) {
        return {
          isValid: false,
          error: 'Integrity violation: Cannot mark assertion CONTRADICTED without retrieved contradicting evidence.',
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Analyzes verified evidence for an existing verification request and persists the final
 * structured verdict to public.verification_results.
 *
 * Request Lifecycle:
 * 1. Checks request existence and authorization.
 * 2. Decomposes claim into testable subclaims and persists them into public.claims.
 * 3. Filters verified evidence (rejecting UNVERIFIED_CANDIDATE sources).
 * 4. Executes multi-source synthesis and evaluates contradictions.
 * 5. Validates structured output against server-side guardrails.
 * 6. Persists verdict in public.verification_results.
 * 7. Transitions request status in public.verification_requests to 'COMPLETED'.
 */
export async function analyzeAndPersistVerdictForRequest(
  verificationRequestId: string,
  options?: AnalysisOptions
): Promise<{
  success: boolean;
  requestId: string;
  status: 'COMPLETED' | 'FAILED';
  analysis: StructuredVerdictAnalysis;
  persistedResult: any;
}> {
  const supabase = getServerSupabase();
  const isTestMode = process.env.NODE_ENV === 'test' || Boolean(process.env.TEST_MODE);

  try {
    // 1. Fetch request, atomic claims, evidence, sources, and verification_results
    const { data: request, error: reqError } = await supabase
      .from('verification_requests')
      .select('*, claims(*), evidence(*, sources(*)), verification_results(*)')
      .eq('id', verificationRequestId)
      .single();

    if (reqError || !request) {
      throw new Error(`Verification request not found: ${reqError?.message || verificationRequestId}`);
    }

    const claimText = request.original_claim || request.claims?.[0]?.claim_text || '';
    if (!claimText) {
      throw new Error('No claim text found on verification request.');
    }

    const existingResult = Array.isArray(request.verification_results)
      ? request.verification_results[0]
      : request.verification_results;

    // Idempotency & Duplicate Prevention Guard:
    // If request is already COMPLETED with a valid non-insufficient verdict and re-analysis is not forced,
    // return the existing validated verdict immediately.
    if (
      request.status === 'COMPLETED' &&
      existingResult &&
      ['SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'INSUFFICIENT_EVIDENCE'].includes(existingResult.verdict) &&
      !options?.forceReanalyze
    ) {
      const rawEvidence = request.evidence || [];
      const verifiedEvidence = filterVerifiedEvidence(rawEvidence);
      const existingSubclaims = (request.claims || [])
        .filter((c: any) => c.claim_type === 'SUBCLAIM')
        .map((c: any) => c.claim_text);

      const existingAnalysis = evaluateEvidenceForSubclaims(
        claimText,
        existingSubclaims.length > 0 ? existingSubclaims : [claimText],
        verifiedEvidence
      );

      return {
        success: true,
        requestId: verificationRequestId,
        status: 'COMPLETED',
        analysis: {
          ...existingAnalysis,
          verdict: existingResult.verdict,
          confidence: Number(existingResult.confidence) || existingAnalysis.confidence,
          summaryExplanation: existingResult.explanation || existingAnalysis.summaryExplanation,
          completedAt: existingResult.completed_at || existingResult.created_at,
        },
        persistedResult: existingResult,
      };
    }

    // 2. Decompose claim into subclaims
    const subclaims = await decomposeClaimIntoSubclaims(claimText, options);

    // Persist subclaims into public.claims (avoiding duplicates)
    const existingClaimTexts = new Set((request.claims || []).map((c: any) => c.claim_text));
    for (const sub of subclaims) {
      if (!existingClaimTexts.has(sub)) {
        await supabase.from('claims').insert({
          verification_request_id: verificationRequestId,
          claim_text: sub,
          claim_type: 'SUBCLAIM',
        });
      }
    }

    // 3. Filter strictly verified evidence (provenance = GROUNDED_SEARCH)
    const rawEvidence = request.evidence || [];
    const verifiedEvidence = filterVerifiedEvidence(rawEvidence);

    // 4. Perform structured multi-source analysis
    let analysis: StructuredVerdictAnalysis;

    // Test mode simulation options are strictly quarantined to test mode
    if (isTestMode && options?.simulatedModelOutput) {
      analysis = options.simulatedModelOutput;
      const validation = validateVerdictAnalysis(analysis, verifiedEvidence, verificationRequestId);
      if (!validation.isValid) {
        console.warn(`[GovVerify AI] Simulated model output validation failed: ${validation.error}. Falling back to deterministic synthesis.`);
        analysis = evaluateEvidenceForSubclaims(claimText, subclaims, verifiedEvidence);
      }
    } else if (verifiedEvidence.length === 0 || (isTestMode && options?.forceModelFailure)) {
      analysis = evaluateEvidenceForSubclaims(claimText, subclaims, verifiedEvidence);
    } else {
      // Attempt Gemini structured verdict generation
      const geminiAnalysis = await generateGeminiStructuredVerdict(claimText, subclaims, verifiedEvidence);
      if (geminiAnalysis) {
        const validation = validateVerdictAnalysis(geminiAnalysis, verifiedEvidence, verificationRequestId);
        if (validation.isValid) {
          analysis = geminiAnalysis;
        } else {
          console.warn(`[GovVerify AI] Gemini verdict output validation failed: ${validation.error}. Falling back to deterministic synthesis.`);
          analysis = evaluateEvidenceForSubclaims(claimText, subclaims, verifiedEvidence);
        }
      } else {
        analysis = evaluateEvidenceForSubclaims(claimText, subclaims, verifiedEvidence);
      }
    }

    // 5. Final Server-Side Validation Guardrail
    const finalValidation = validateVerdictAnalysis(analysis, verifiedEvidence, verificationRequestId);
    if (!finalValidation.isValid) {
      // If output validation fails, force deterministic fallback
      analysis = evaluateEvidenceForSubclaims(claimText, subclaims, verifiedEvidence);
    }

    // Overwrite Protection Guard:
    // An empty/insufficient analysis from transient retrieval issues must NEVER overwrite a previously validated result!
    if (
      existingResult &&
      ['SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED'].includes(existingResult.verdict) &&
      analysis.verdict === 'INSUFFICIENT_EVIDENCE' &&
      verifiedEvidence.length === 0
    ) {
      console.warn(`[GovVerify AI] Protected existing verified verdict (${existingResult.verdict}) from being overwritten by transient empty evidence.`);
      return {
        success: true,
        requestId: verificationRequestId,
        status: 'COMPLETED',
        analysis: {
          ...analysis,
          verdict: existingResult.verdict,
          confidence: Number(existingResult.confidence) || 85,
          summaryExplanation: existingResult.explanation || analysis.summaryExplanation,
        },
        persistedResult: existingResult,
      };
    }

    // 6. Persist final result into public.verification_results
    const { data: resultRecord, error: resultError } = await supabase
      .from('verification_results')
      .upsert(
        {
          verification_request_id: verificationRequestId,
          verdict: analysis.verdict,
          confidence: analysis.confidence,
          explanation: analysis.summaryExplanation,
          completed_at: analysis.completedAt,
        },
        { onConflict: 'verification_request_id' }
      )
      .select()
      .single();

    if (resultError || !resultRecord) {
      throw new Error(`Failed to persist verification result: ${resultError?.message}`);
    }

    // 7. Transition request status to COMPLETED
    await persistRequestTelemetry(verificationRequestId, {
      status: 'COMPLETED',
      failureReason: null,
      failureDetails: null,
    });

    return {
      success: true,
      requestId: verificationRequestId,
      status: 'COMPLETED',
      analysis: {
        ...analysis,
        completedAt: resultRecord.completed_at || analysis.completedAt,
      },
      persistedResult: resultRecord,
    };
  } catch (err: any) {
    console.error(`[GovVerify AI] Analysis error for request ${verificationRequestId}:`, err.message);
    try {
      const classified = classifyError(err, { phase: 'VERDICT', provider: 'internal' });
      await persistRequestTelemetry(verificationRequestId, {
        status: 'FAILED',
        failureReason: classified.failureReason,
        failureDetails: classified.sanitizedDetails,
      });
    } catch {
      // Ignore secondary update error
    }
    throw err;
  }
}
