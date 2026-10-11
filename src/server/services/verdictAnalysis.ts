/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import { getGeminiClient, getGeminiConfigStatus, GEMINI_FLASH_MODEL, generateContentWithFallback } from './gemini';
import { getServerSupabase } from '../supabase';
import { classifyError } from './errorClassification';
import { persistRequestTelemetry } from './telemetry';

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

let geminiCircuitBroken = false;

export function resetGeminiCircuit(): void {
  geminiCircuitBroken = false;
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
  if (options?.mockSubclaims && options.mockSubclaims.length > 0) {
    return options.mockSubclaims;
  }

  // Short single statements do not need decomposition
  if (trimmed.length < 80 && !trimmed.toLowerCase().includes(' and ') && !trimmed.includes(';')) {
    return [trimmed];
  }

  // Attempt Gemini structured decomposition if configured and not forced to fail
  const geminiConfig = getGeminiConfigStatus();
  if (geminiConfig.isConfigured && !options?.forceModelFailure && !geminiCircuitBroken) {
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
        setTimeout(() => reject(new Error('Gemini claim decomposition timeout (2000ms)')), 2000)
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
      geminiCircuitBroken = true;
      console.warn('[GovVerify AI] Gemini claim decomposition notice (circuit breaker activated):', decompErr.message || decompErr);
    }
  }

  // Deterministic syntactic fallback splitting on conjuncts / semicolons
  const parts = trimmed
    .split(/(?:;|\band\b|\balso\b|\bas well as\b|\bmoreover\b)/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 10);

  return parts.length > 0 ? parts : [trimmed];
}

/**
 * Filter verified evidence records.
 * Mandatory Safeguards 1 & 2:
 * ONLY evidence linked to sources with source_type = 'GROUNDED_SEARCH' and valid URL are accepted.
 * UNVERIFIED_CANDIDATE sources and candidate queries must NEVER count as evidence.
 */
export function filterVerifiedEvidence(evidenceRecords: any[]): any[] {
  if (!Array.isArray(evidenceRecords)) return [];

  return evidenceRecords.filter((ev) => {
    if (!ev || !ev.sources) return false;
    const src = ev.sources;
    // Strict provenance check: source_type must be GROUNDED_SEARCH
    if (src.source_type === 'UNVERIFIED_CANDIDATE') return false;
    if (src.source_type !== 'GROUNDED_SEARCH') return false;
    // Must have a valid URL and actual extracted text
    if (!src.url || typeof src.url !== 'string' || !src.url.startsWith('http')) return false;
    if (!ev.extracted_text || typeof ev.extracted_text !== 'string' || ev.extracted_text.trim().length === 0) {
      return false;
    }
    return true;
  });
}

/**
 * Deterministically evaluates verified evidence against decomposed subclaims.
 * Preserves genuine contradictions and calculates defensible verdicts.
 */
export function evaluateEvidenceForSubclaims(
  claimText: string,
  subclaims: string[],
  verifiedEvidence: any[]
): StructuredVerdictAnalysis {
  const completedAt = new Date().toISOString();

  // Safeguard 3: If zero verified evidence exists, return honest INSUFFICIENT_EVIDENCE
  if (!verifiedEvidence || verifiedEvidence.length === 0) {
    return {
      verdict: 'INSUFFICIENT_EVIDENCE',
      confidence: 0,
      summaryExplanation:
        'Insufficient official evidence. No verified authoritative government records (.gov.in, .nic.in, PIB) could be retrieved addressing this statement. Under GovVerify AI verification integrity safeguards, claims cannot be certified without authoritative retrieved evidence.',
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

  // Evaluate each subclaim against verified evidence
  let supportedCount = 0;
  let contradictedCount = 0;
  let insufficientCount = 0;

  for (const subclaim of subclaims) {
    const subLower = subclaim.toLowerCase();
    const supportingIds: string[] = [];
    const contradictingIds: string[] = [];

    // Check evidence items
    for (const ev of verifiedEvidence) {
      const excerptLower = (ev.extracted_text || '').toLowerCase();
      const domainLower = (ev.sources?.domain || '').toLowerCase();

      // Check for contradiction keywords
      const isFactCheck = domainLower.includes('factcheck') || excerptLower.includes('fact check');
      const hasFakeIndicator =
        excerptLower.includes('fake') ||
        excerptLower.includes('fraudulent') ||
        excerptLower.includes('misleading') ||
        excerptLower.includes('clarification') ||
        excerptLower.includes('no such') ||
        excerptLower.includes('denied') ||
        excerptLower.includes('rumour') ||
        excerptLower.includes('rumor');

      // Check keywords overlap with number normalization and light stemming
      const cleanSub = subLower.replace(/(\d+),(\d+)/g, '$1$2');
      const cleanExcerpt = excerptLower.replace(/(\d+),(\d+)/g, '$1$2');

      const stopWords = new Set(['the', 'and', 'for', 'all', 'has', 'was', 'this', 'that', 'with', 'from', 'into']);
      const subTokens = cleanSub
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !stopWords.has(w));

      const matchingTokens = subTokens.filter((token) => {
        if (cleanExcerpt.includes(token)) return true;
        // Check stem/prefix for words longer than 4 chars (e.g. doubl -> doubled/doubling)
        if (token.length >= 5) {
          const stem = token.slice(0, token.length - 2);
          if (cleanExcerpt.includes(stem)) return true;
        }
        return false;
      });

      const matchScore = subTokens.length > 0 ? matchingTokens.length / subTokens.length : 0;

      // Evidence stance determination: evidence must be relevant to this subclaim
      if (matchScore >= 0.25) {
        const pubYear = ev.sources?.publication_date ? parseInt(ev.sources.publication_date.slice(0, 4), 10) : null;
        const isOutdated = Boolean(pubYear && pubYear < 2024);

        if (hasFakeIndicator || ev.relationship === 'REFUTES') {
          contradictingIds.push(ev.id);
          citations.push({
            id: ev.id,
            sourceId: ev.sources.id,
            sourceTitle: ev.sources.title,
            sourceUrl: ev.sources.url,
            officialPublisher: ev.sources.issuing_authority || ev.sources.domain,
            publicationDate: ev.sources.publication_date || undefined,
            isOutdated,
            relevantExcerpt: ev.extracted_text,
            relationship: 'CONTRADICTS',
            verdictContribution: 'CONTRADICTED',
          });
        } else if (matchScore >= 0.35 || ev.relationship === 'SUPPORTS' || ev.relationship === 'OFFICIAL_CONFIRMATION') {
          supportingIds.push(ev.id);
          citations.push({
            id: ev.id,
            sourceId: ev.sources.id,
            sourceTitle: ev.sources.title,
            sourceUrl: ev.sources.url,
            officialPublisher: ev.sources.issuing_authority || ev.sources.domain,
            publicationDate: ev.sources.publication_date || undefined,
            isOutdated,
            relevantExcerpt: ev.extracted_text,
            relationship: 'SUPPORTS',
            verdictContribution: 'SUPPORTED',
          });
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
      relevance = 'ABSENT';
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
  let confidence = 0;
  let summary = '';

  if (contradictedCount > 0 && supportedCount > 0) {
    finalVerdict = 'PARTIALLY_SUPPORTED';
    confidence = 80;
    summary = `The claim is partially supported. Verified official records confirm certain elements of the statement, while other key propositions are contradicted or unsupported by official notices.`;
  } else if (contradictedCount > 0 && supportedCount === 0) {
    finalVerdict = 'CONTRADICTED';
    confidence = 90;
    summary = `The claim is contradicted by authoritative official records. Government notices, press releases, or official fact checks directly refute the statement.`;
  } else if (supportedCount > 0 && contradictedCount === 0) {
    if (insufficientCount === 0) {
      finalVerdict = 'SUPPORTED';
      confidence = 90;
      summary = `The claim is fully supported by verified government records. Official notifications and portal rules confirm all tested propositions.`;
    } else {
      finalVerdict = 'PARTIALLY_SUPPORTED';
      confidence = 70;
      summary = `The claim is partially supported. Verified records confirm specific propositions, but other assertions lack direct official documentation.`;
    }
  } else {
    finalVerdict = 'INSUFFICIENT_EVIDENCE';
    confidence = 20;
    summary = `Insufficient official evidence retrieved. The retrieved records mention the broad administrative context, but lack specific factual confirmation or denial of the exact claim.`;
  }

  return {
    verdict: finalVerdict,
    confidence,
    summaryExplanation: summary,
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
  if (!geminiConfig.isConfigured || verifiedEvidence.length === 0 || geminiCircuitBroken) {
    return null;
  }

  try {
    const gemini = getGeminiClient();
    const evidenceSummary = verifiedEvidence.map((ev) => ({
      evidenceId: ev.id,
      sourceId: ev.sources?.id,
      sourceTitle: ev.sources?.title,
      domain: ev.sources?.domain,
      url: ev.sources?.url,
      issuingAuthority: ev.sources?.issuing_authority,
      relevantExcerpt: ev.extracted_text,
    }));

    const prompt = `You are GovVerify AI Multi-Source Analytical Engine for Indian Government Policy and Citizen Claims.
Evaluate the following claim and its atomic subclaims against the verified official evidence retrieved from sovereign government sources (.gov.in, .nic.in, PIB).

MANDATORY INTEGRITY RULES:
1. Allowed verdicts: "SUPPORTED", "PARTIALLY_SUPPORTED", "CONTRADICTED", "INSUFFICIENT_EVIDENCE".
2. You MUST ONLY cite evidence IDs from the provided evidence list below. NEVER invent, hallucinate, or alter evidence IDs, quotations, URLs, dates, or statistics.
3. If official notices or PIB fact checks contradict the claim, you MUST preserve that contradiction and mark the claim as "CONTRADICTED" (or "PARTIALLY_SUPPORTED" if other subclaims are confirmed).
4. If verified evidence is missing or does not address a subclaim, mark that subclaim as "INSUFFICIENT_EVIDENCE". Do NOT assume truth without proof.
5. Provide a clear, objective, factual explanation.

CLAIM: "${claimText}"

SUBCLAIMS TO EVALUATE:
${JSON.stringify(subclaims, null, 2)}

VERIFIED OFFICIAL EVIDENCE:
${JSON.stringify(evidenceSummary, null, 2)}`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini structured verdict timeout (2000ms)')), 2000)
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
            confidence: { type: Type.NUMBER, description: 'Confidence score from 0 to 100' },
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

    return {
      verdict: parsed.verdict,
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
      summaryExplanation: parsed.summaryExplanation,
      subclaims: parsed.subclaims || [],
      citations: parsed.citations || [],
      evidenceCount: verifiedEvidence.length,
      verifiedSourcesCount: new Set(verifiedEvidence.map((e) => e.source_id)).size,
      completedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    geminiCircuitBroken = true;
    console.warn('[GovVerify AI] Gemini structured verdict notice (circuit breaker activated, falling back to deterministic synthesis):', err.message || err);
    return null;
  }
}

/**
 * Server-Side Structured Verdict Validation Guardrail.
 * Mandatory Safeguard 9:
 * Rejects malformed, unsupported, or improperly cited model output.
 */
export function validateVerdictAnalysis(
  analysis: StructuredVerdictAnalysis,
  verifiedEvidence: any[]
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

  // 4. Citation traceability check: every cited ID must exist in verifiedEvidence
  const validEvidenceIds = new Set(verifiedEvidence.map((e) => e.id));
  for (const cite of analysis.citations || []) {
    if (!validEvidenceIds.has(cite.id)) {
      return {
        isValid: false,
        error: `Traceability violation: Cited evidence ID ${cite.id} does not exist in verified evidence records for this request.`,
      };
    }
  }

  // Check subclaims supporting/contradicting evidence IDs traceability
  for (const sub of analysis.subclaims || []) {
    for (const supId of sub.supportingEvidenceIds || []) {
      if (!validEvidenceIds.has(supId)) {
        return {
          isValid: false,
          error: `Traceability violation: Subclaim supporting evidence ID ${supId} does not exist in verified evidence records.`,
        };
      }
    }
    for (const conId of sub.contradictingEvidenceIds || []) {
      if (!validEvidenceIds.has(conId)) {
        return {
          isValid: false,
          error: `Traceability violation: Subclaim contradicting evidence ID ${conId} does not exist in verified evidence records.`,
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
      ['SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED'].includes(existingResult.verdict) &&
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

    if (options?.simulatedModelOutput) {
      analysis = options.simulatedModelOutput;
      const validation = validateVerdictAnalysis(analysis, verifiedEvidence);
      if (!validation.isValid) {
        console.warn(`[GovVerify AI] Simulated model output validation failed: ${validation.error}. Falling back to deterministic synthesis.`);
        analysis = evaluateEvidenceForSubclaims(claimText, subclaims, verifiedEvidence);
      }
    } else if (verifiedEvidence.length === 0 || options?.forceModelFailure) {
      analysis = evaluateEvidenceForSubclaims(claimText, subclaims, verifiedEvidence);
    } else {
      // Attempt Gemini structured verdict generation
      const geminiAnalysis = await generateGeminiStructuredVerdict(claimText, subclaims, verifiedEvidence);
      if (geminiAnalysis) {
        const validation = validateVerdictAnalysis(geminiAnalysis, verifiedEvidence);
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
    const finalValidation = validateVerdictAnalysis(analysis, verifiedEvidence);
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
